require('dotenv').config();
const http = require('http');

const results = { pass: 0, fail: 0 };

let superToken   = '';
let packWorkerId = null; // TIM_PACKING user id

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(method, path, body = null, token = superToken) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            method,
            hostname: '127.0.0.1',
            port:     3000,
            path,
            headers:  { 'Content-Type': 'application/json' },
        };
        // token=null → no header (unauthenticated). token=undefined → use superToken default
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Convenience wrappers — token arg=undefined → use superToken; token=null → no auth
const api = {
    get:    (path, token)       => request('GET',    path, null, token === undefined ? superToken : token),
    post:   (path, body, token) => request('POST',   path, body, token === undefined ? superToken : token),
    put:    (path, body, token) => request('PUT',    path, body, token === undefined ? superToken : token),
    delete: (path, token)       => request('DELETE', path, null, token === undefined ? superToken : token),
};

// ── Assertion helpers ─────────────────────────────────────────────────────────

function assert(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✓ ${label}`);
        results.pass++;
    } else {
        console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
        results.fail++;
    }
}

function assertField(label, obj, field, expectedVal = undefined) {
    const exists  = obj !== null && obj !== undefined && field in obj;
    const correct = expectedVal === undefined ? exists : (exists && obj[field] === expectedVal);
    assert(label, correct, `got: ${JSON.stringify(obj?.[field])}, expected: ${expectedVal ?? '(exists)'}`);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

async function testSetup() {
    console.log('\n─── SETUP: LOGIN & TEST USERS ───');

    const res = await request('POST', '/login', { email: 'superadmin@inventory.local', password: 'password123' }, null);
    assert('Login as SUPER_ADMIN → 200', res.status === 200, `status=${res.status}`);
    superToken = res.body.access_token;
    assert('Got access_token', !!superToken);
    if (!superToken) { console.log('\nLogin gagal, test dihentikan.'); process.exit(1); }

    // Buat user TIM_PACKING untuk test packing job assignment
    const ts = Date.now();
    const workerRes = await api.post('/users', {
        name:     'Test Packer',
        role:     'TIM_PACKING',
        email:    `packer.${ts}@test.local`,
        password: 'password123',
    });
    assert('Buat user TIM_PACKING → 201', workerRes.status === 201, `status=${workerRes.status} ${JSON.stringify(workerRes.body)}`);
    packWorkerId = workerRes.body?.id;
    assert('TIM_PACKING user punya id', !!packWorkerId, `id=${packWorkerId}`);
    console.log(`  → TIM_PACKING user id = ${packWorkerId}`);
}

// ── Error handler ─────────────────────────────────────────────────────────────

async function testErrorHandler() {
    console.log('\n─── ERROR HANDLER ───');

    // 401 tanpa token
    const noAuth = await api.get('/incoming-goods', null);
    assert('Request tanpa token → 401', noAuth.status === 401, `status=${noAuth.status}`);
    assertField('Response punya field message', noAuth.body, 'message');

    // 401 token invalid
    const badToken = await api.get('/incoming-goods', 'invalid.token.abc');
    assert('Token invalid → 401', badToken.status === 401, `status=${badToken.status}`);

    // 404
    const nf = await api.get('/incoming-goods/99999');
    assert('GET tidak ada → 404', nf.status === 404, `status=${nf.status}`);
    assertField('404 punya message', nf.body, 'message');

    // 400 — body kosong tanpa items
    const emptyBody = await api.post('/incoming-goods', { VendorId: 1, receivedDate: '2026-04-22' });
    assert('POST tanpa items → 400', emptyBody.status === 400, `status=${emptyBody.status}`);
    assertField('400 punya message', emptyBody.body, 'message');

    // 400 — items array kosong
    const emptyItems = await api.post('/incoming-goods', { VendorId: 1, receivedDate: '2026-04-22', items: [] });
    assert('POST items=[] → 400', emptyItems.status === 400, `status=${emptyItems.status}`);

    // 409 — unique constraint akan ditest di vendor CRUD
}

// ── Vendor CRUD ───────────────────────────────────────────────────────────────

async function testVendorCRUD() {
    console.log('\n─── VENDOR CRUD ───');
    const code = `VND-TEST-${Date.now()}`;

    const all = await api.get('/vendors');
    assert('GET /vendors → 200', all.status === 200, `status=${all.status}`);
    assert('Response shape: punya data',       Array.isArray(all.body?.data));
    assert('Response shape: punya pagination', !!all.body?.pagination);

    const created = await api.post('/vendors', { name: 'PT Test Vendor', vendorCode: code, contact: 'Budi' });
    assert('POST /vendors → 201', created.status === 201, `status=${created.status} ${JSON.stringify(created.body)}`);
    assertField('Vendor punya id',          created.body, 'id');
    assertField('Vendor name sesuai',       created.body, 'name',       'PT Test Vendor');
    assertField('Vendor vendorCode sesuai', created.body, 'vendorCode', code);
    const vid = created.body.id;

    const one = await api.get(`/vendors/${vid}`);
    assert('GET /vendors/:id → 200', one.status === 200);

    // 409 duplicate vendorCode
    const dup = await api.post('/vendors', { name: 'Dup', vendorCode: code });
    assert('Duplicate vendorCode → 409', dup.status === 409, `status=${dup.status}`);
    assertField('409 punya message', dup.body, 'message');

    const upd = await api.put(`/vendors/${vid}`, { name: 'PT Test Vendor Updated' });
    assert('PUT /vendors/:id → 200', upd.status === 200, `status=${upd.status}`);
    assertField('Name terupdate', upd.body, 'name', 'PT Test Vendor Updated');

    const nf = await api.get('/vendors/99999');
    assert('GET /vendors/99999 → 404', nf.status === 404);

    const del = await api.delete(`/vendors/${vid}`);
    assert('DELETE /vendors/:id → 200', del.status === 200);

    const gone = await api.get(`/vendors/${vid}`);
    assert('GET setelah delete → 404', gone.status === 404);
}

// ── Full packing flow ─────────────────────────────────────────────────────────

async function testPackingFlow() {
    console.log('\n─── INCOMING GOODS + PACKING FLOW ───');

    // Ambil product dari database
    const products = await api.get('/products');
    assert('GET /products tersedia', products.status === 200);
    const productId = products.body?.data?.[0]?.id;
    if (!productId) { console.log('  ⚠ Tidak ada product, skip'); return; }
    console.log(`  → ProductId = ${productId}`);

    // Buat vendor untuk test ini
    const vendor = await api.post('/vendors', {
        name: 'Vendor Flow Test',
        vendorCode: `VND-FLOW-${Date.now()}`,
    });
    assert('Setup vendor → 201', vendor.status === 201);
    const vendorId = vendor.body.id;

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 1] Create IncomingGoods (DRAFT)');
    const igRes = await api.post('/incoming-goods', {
        VendorId:           vendorId,
        receivedDate:       '2026-04-22',
        vendorDeliveryNote: 'SJ-EXT-9999',
        notes:              'Test barang masuk',
        items: [
            { ProductId: productId, qtyOrdered: 100, qtyReceived: 95, unit: 'pcs', notes: '5 rusak transit' },
        ],
    });
    assert('POST /incoming-goods → 201', igRes.status === 201, `status=${igRes.status} ${JSON.stringify(igRes.body)}`);
    assertField('Punya docNumber',         igRes.body, 'docNumber');
    assertField('Status = DRAFT',          igRes.body, 'status', 'DRAFT');
    assert('docNumber format BM-',         igRes.body.docNumber?.startsWith('BM-'));
    assertField('totalItems = 1',          igRes.body, 'totalItems', 1);
    assertField('totalQty = 95',           igRes.body, 'totalQty',   95);
    const igId = igRes.body.id;

    // Validasi GET list
    const allIg = await api.get('/incoming-goods');
    assert('GET /incoming-goods → 200', allIg.status === 200);
    assert('Response punya data[]',     Array.isArray(allIg.body?.data));
    assert('Response punya pagination', !!allIg.body?.pagination);

    // GET detail
    const igDetail = await api.get(`/incoming-goods/${igId}`);
    assert('GET /incoming-goods/:id → 200', igDetail.status === 200);
    assert('Detail punya items[]',       Array.isArray(igDetail.body?.items));
    assertField('Detail punya suratJalan',  igDetail.body, 'suratJalan');
    assertField('Detail punya packingJobs', igDetail.body, 'packingJobs');

    // PUT update boleh di DRAFT
    const upd = await api.put(`/incoming-goods/${igId}`, { notes: 'Note diupdate' });
    assert('PUT DRAFT → 200', upd.status === 200, `status=${upd.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 2] Confirm Vendor → SuratJalan generated');
    const confirmRes = await api.post(`/incoming-goods/${igId}/confirm-vendor`, { notes: 'Qty OK' });
    assert('POST confirm-vendor → 200', confirmRes.status === 200, `status=${confirmRes.status} ${JSON.stringify(confirmRes.body)}`);
    assertField('Status = VENDOR_CONFIRMED', confirmRes.body.incomingGoods, 'status', 'VENDOR_CONFIRMED');
    assertField('vendorConfirmedAt diisi',   confirmRes.body.incomingGoods, 'vendorConfirmedAt');
    assertField('SuratJalan digenerate',     confirmRes.body, 'suratJalan');
    assertField('SJ punya sjNumber',         confirmRes.body.suratJalan, 'sjNumber');
    assert('SJ nomor format SJ-',            confirmRes.body.suratJalan?.sjNumber?.startsWith('SJ-'));
    const sjId = confirmRes.body.suratJalan?.id;

    // PUT setelah confirm → 400
    const updLocked = await api.put(`/incoming-goods/${igId}`, { notes: 'Coba edit' });
    assert('PUT setelah confirm → 400 (locked)', updLocked.status === 400, `status=${updLocked.status}`);

    // Confirm lagi → 400
    const dupConfirm = await api.post(`/incoming-goods/${igId}/confirm-vendor`, {});
    assert('Confirm vendor lagi → 400', dupConfirm.status === 400, `status=${dupConfirm.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 3] Surat Jalan');
    const allSj = await api.get('/surat-jalan');
    assert('GET /surat-jalan → 200', allSj.status === 200);
    assert('SJ punya data[]', Array.isArray(allSj.body?.data));

    const sjDetail = await api.get(`/surat-jalan/${sjId}`);
    assert('GET /surat-jalan/:id → 200', sjDetail.status === 200, `status=${sjDetail.status}`);
    assertField('SJ punya sjNumber',      sjDetail.body, 'sjNumber');
    assertField('SJ punya snapshotItems', sjDetail.body, 'snapshotItems');
    assert('snapshotItems tidak kosong',  (sjDetail.body?.snapshotItems?.length || 0) > 0);
    assert('snapshot punya productName',  !!sjDetail.body?.snapshotItems?.[0]?.productName);

    const printRes = await api.post(`/surat-jalan/${sjId}/print`);
    assert('POST /surat-jalan/:id/print → 200', printRes.status === 200);
    assertField('printedAt diisi', printRes.body, 'printedAt');

    const printAgain = await api.post(`/surat-jalan/${sjId}/print`);
    assert('Print lagi idempoten → 200', printAgain.status === 200);
    assert('printedAt tidak berubah', printAgain.body.printedAt === printRes.body.printedAt);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 4] Notify Production');
    const notifyRes = await api.post(`/incoming-goods/${igId}/notify-production`, {});
    assert('POST notify-production → 200', notifyRes.status === 200, `status=${notifyRes.status}`);
    assertField('Status = PRODUCTION_NOTIFIED', notifyRes.body.incomingGoods, 'status', 'PRODUCTION_NOTIFIED');
    assertField('productionNotifiedAt diisi',   notifyRes.body.incomingGoods, 'productionNotifiedAt');

    // Notify lagi → 400
    const dupNotify = await api.post(`/incoming-goods/${igId}/notify-production`, {});
    assert('Notify production lagi → 400', dupNotify.status === 400, `status=${dupNotify.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 5] Create PackingJob');
    // Coba assign ke non-TIM_PACKING user → 400
    const badRole = await api.post('/packing-jobs', { IncomingGoodsId: igId, assignedTo: 1 }); // id=1 = SUPER_ADMIN
    assert('Assign ke non-TIM_PACKING → 400', badRole.status === 400, `status=${badRole.status}`);

    const jobRes = await api.post('/packing-jobs', {
        IncomingGoodsId: igId,
        assignedTo:      packWorkerId,
        notes:           'Job packing test',
    });
    assert('POST /packing-jobs → 201', jobRes.status === 201, `status=${jobRes.status} ${JSON.stringify(jobRes.body)}`);
    assertField('Job status = PENDING', jobRes.body, 'status', 'PENDING');
    assertField('Job punya assignedTo', jobRes.body, 'assignedTo', packWorkerId);
    const jobId = jobRes.body.id;
    if (!jobId) { console.log('  ⚠ Job creation failed, skip steps 6+'); return; }

    // IG status berubah ke PACKING_IN_PROGRESS
    const igAfterJob = await api.get(`/incoming-goods/${igId}`);
    assert('IG status = PACKING_IN_PROGRESS', igAfterJob.body?.status === 'PACKING_IN_PROGRESS', `status=${igAfterJob.body?.status}`);

    // GET list jobs
    const allJobs = await api.get('/packing-jobs');
    assert('GET /packing-jobs → 200', allJobs.status === 200);
    assert('Jobs punya data[]', Array.isArray(allJobs.body?.data));

    // GET job detail
    const jobDetail = await api.get(`/packing-jobs/${jobId}`);
    assert('GET /packing-jobs/:id → 200', jobDetail.status === 200, `status=${jobDetail.status}`);
    assert('Job detail punya incomingGoods', !!jobDetail.body?.incomingGoods);
    assert('Job detail punya results[]',     Array.isArray(jobDetail.body?.results));

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 6] Start PackingJob');
    const startRes = await api.post(`/packing-jobs/${jobId}/start`);
    assert('POST /packing-jobs/:id/start → 200', startRes.status === 200, `status=${startRes.status}`);
    assertField('startedAt diisi', startRes.body, 'startedAt');

    // Start lagi → idempoten
    const startAgain = await api.post(`/packing-jobs/${jobId}/start`);
    assert('Start lagi idempoten → 200', startAgain.status === 200, `status=${startAgain.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 7] Submit PackingResult');
    const igWithItems = await api.get(`/incoming-goods/${igId}`);
    const itemId = igWithItems.body?.items?.[0]?.id;
    assert('Ada IncomingGoodsItem', !!itemId, `itemId=${itemId}`);

    // Validasi: results kosong → 400
    const emptySubmit = await api.post(`/packing-jobs/${jobId}/submit`, { results: [] });
    assert('Submit results=[] → 400', emptySubmit.status === 400, `status=${emptySubmit.status}`);

    // Validasi: qtyReject tanpa rejectReason → 400
    const noReason = await api.post(`/packing-jobs/${jobId}/submit`, {
        results: [{ IncomingGoodsItemId: itemId, qtyReady: 80, qtyReject: 5, rejectReason: null }],
    });
    assert('qtyReject tanpa alasan → 400', noReason.status === 400, `status=${noReason.status}`);

    // Validasi: qtyReady + qtyReject = 0 → 400
    const zeroQty = await api.post(`/packing-jobs/${jobId}/submit`, {
        results: [{ IncomingGoodsItemId: itemId, qtyReady: 0, qtyReject: 0 }],
    });
    assert('qtyReady+qtyReject=0 → 400', zeroQty.status === 400, `status=${zeroQty.status}`);

    // Submit valid
    const submitRes = await api.post(`/packing-jobs/${jobId}/submit`, {
        results: [{
            IncomingGoodsItemId: itemId,
            qtyReady:       88,
            qtyReject:       7,
            rejectReason:   'Jahitan tidak rapi',
            scannedBarcode: '899100000011',
        }],
    });
    assert('POST submit → 200', submitRes.status === 200, `status=${submitRes.status} ${JSON.stringify(submitRes.body)}`);
    assertField('Status = SUBMITTED', submitRes.body.packingJob, 'status', 'SUBMITTED');
    assertField('submittedAt diisi',  submitRes.body.packingJob, 'submittedAt');
    assert('Results tidak kosong',    (submitRes.body.results?.length || 0) > 0);

    // Submit lagi → 400 (status bukan IN_PROGRESS)
    const resubmit = await api.post(`/packing-jobs/${jobId}/submit`, {
        results: [{ IncomingGoodsItemId: itemId, qtyReady: 80, qtyReject: 0 }],
    });
    assert('Submit ulang → 400 (sudah SUBMITTED)', resubmit.status === 400, `status=${resubmit.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 8] Verify PackingJob → FormAnakPacking generated');
    const verifyRes = await api.post(`/packing-jobs/${jobId}/verify`, { notes: 'Hasil OK' });
    assert('POST verify → 200', verifyRes.status === 200, `status=${verifyRes.status} ${JSON.stringify(verifyRes.body)}`);
    assertField('Status = VERIFIED',          verifyRes.body.packingJob, 'status', 'VERIFIED');
    assertField('verifiedAt diisi',           verifyRes.body.packingJob, 'verifiedAt');
    assertField('FormAnakPacking digenerate', verifyRes.body, 'formAnakPacking');
    assertField('FAP punya formNumber',       verifyRes.body.formAnakPacking, 'formNumber');
    assert('FAP nomor format FAP-',           verifyRes.body.formAnakPacking?.formNumber?.startsWith('FAP-'));
    const fapId = verifyRes.body.formAnakPacking?.id;

    // Verify lagi → 400
    const reverify = await api.post(`/packing-jobs/${jobId}/verify`, {});
    assert('Verify lagi → 400', reverify.status === 400, `status=${reverify.status}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 9] Form Anak Packing');
    const allFap = await api.get('/form-anak-packing');
    assert('GET /form-anak-packing → 200', allFap.status === 200);
    assert('FAP punya data[]', Array.isArray(allFap.body?.data));

    const fapDetail = await api.get(`/form-anak-packing/${fapId}`);
    assert('GET /form-anak-packing/:id → 200', fapDetail.status === 200, `status=${fapDetail.status}`);
    assertField('FAP punya formNumber',      fapDetail.body, 'formNumber');
    assertField('FAP punya totalQtyPacked',  fapDetail.body, 'totalQtyPacked');
    assertField('FAP punya snapshotResults', fapDetail.body, 'snapshotResults');
    assert('snapshotResults tidak kosong',   (fapDetail.body?.snapshotResults?.length || 0) > 0);
    assert('totalQtyPacked = 95 (88+7)',     fapDetail.body.totalQtyPacked === 95, `got=${fapDetail.body.totalQtyPacked}`);
    assert('totalQtyReady = 88',             fapDetail.body.totalQtyReady  === 88, `got=${fapDetail.body.totalQtyReady}`);
    assert('totalQtyReject = 7',             fapDetail.body.totalQtyReject === 7,  `got=${fapDetail.body.totalQtyReject}`);

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n  [Step 10] Complete IncomingGoods');

    // Coba complete sebelum semua job VERIFIED → tidak mungkin karena sudah verified
    // Complete valid
    const completeRes = await api.post(`/incoming-goods/${igId}/complete`);
    assert('POST complete → 200', completeRes.status === 200, `status=${completeRes.status} ${JSON.stringify(completeRes.body)}`);
    assertField('Status = COMPLETED',    completeRes.body.incomingGoods, 'status', 'COMPLETED');
    assertField('completedAt diisi',     completeRes.body.incomingGoods, 'completedAt');
    assertField('Summary ada',           completeRes.body, 'summary');
    assert('summary.totalReady = 88',    completeRes.body.summary?.totalReady   === 88, `got=${completeRes.body.summary?.totalReady}`);
    assert('summary.totalReject = 7',    completeRes.body.summary?.totalReject  === 7,  `got=${completeRes.body.summary?.totalReject}`);
    assert('summary.totalReceived = 95', completeRes.body.summary?.totalReceived === 95, `got=${completeRes.body.summary?.totalReceived}`);

    // Complete lagi → 400
    const completeAgain = await api.post(`/incoming-goods/${igId}/complete`);
    assert('Complete lagi → 400', completeAgain.status === 400, `status=${completeAgain.status}`);

    // qtyReady & qtyReject terupdate di item
    const igFinal = await api.get(`/incoming-goods/${igId}`);
    const finalItem = igFinal.body?.items?.[0];
    assert('qtyReady terupdate di item',  finalItem?.qtyReady  === 88, `got=${finalItem?.qtyReady}`);
    assert('qtyReject terupdate di item', finalItem?.qtyReject === 7,  `got=${finalItem?.qtyReject}`);

    // Cleanup
    await api.delete(`/vendors/${vendorId}`);
}

// ── Role enforcement ─────────────────────────────────────────────────────────

async function testRoleEnforcement() {
    console.log('\n─── ROLE ENFORCEMENT ───');

    // 401 tanpa token
    const noToken = await api.get('/incoming-goods', null);
    assert('GET tanpa token → 401', noToken.status === 401, `status=${noToken.status}`);

    // 401 token invalid
    const badToken = await api.get('/packing-jobs', 'bad.token.xyz');
    assert('Token invalid → 401', badToken.status === 401, `status=${badToken.status}`);

    // 404 — resource tidak ada
    const nfVendor = await api.get('/vendors/99999');
    assert('GET vendor tidak ada → 404', nfVendor.status === 404);

    const nfJob = await api.get('/packing-jobs/99999');
    assert('GET job tidak ada → 404', nfJob.status === 404);

    // 403 — assign job ke non-TIM_PACKING (pakai SUPER_ADMIN id=1)
    // Buat IG dummy dulu untuk tes ini
    const products = await api.get('/products');
    const productId = products.body?.data?.[0]?.id;
    if (productId) {
        const vendor = await api.post('/vendors', { name: 'Vendor Guard Test', vendorCode: `VND-GUARD-${Date.now()}` });
        const vendorId = vendor.body.id;

        const ig = await api.post('/incoming-goods', {
            VendorId: vendorId, receivedDate: '2026-04-22',
            items: [{ ProductId: productId, qtyOrdered: 10, qtyReceived: 10, unit: 'pcs' }],
        });
        const igId = ig.body.id;

        await api.post(`/incoming-goods/${igId}/confirm-vendor`, {});
        await api.post(`/incoming-goods/${igId}/notify-production`, {});

        // Assign ke SUPER_ADMIN (bukan TIM_PACKING) → 400
        const badAssign = await api.post('/packing-jobs', { IncomingGoodsId: igId, assignedTo: 1 });
        assert('Assign ke non-TIM_PACKING → 400', badAssign.status === 400, `status=${badAssign.status}`);
        assert('Pesan error jelas', badAssign.body?.message?.toLowerCase().includes('tim_packing'));

        // Cleanup
        await api.delete(`/vendors/${vendorId}`);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║  PACKING MODULE TEST SUITE           ║');
    console.log('╚══════════════════════════════════════╝');

    await testSetup();
    await testErrorHandler();
    await testVendorCRUD();
    await testPackingFlow();
    await testRoleEnforcement();

    const total = results.pass + results.fail;
    console.log('\n' + '═'.repeat(42));
    console.log(`HASIL: ${results.pass}/${total} passed  |  ${results.fail} failed`);
    console.log('═'.repeat(42));
    process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
