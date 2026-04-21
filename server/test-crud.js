require('dotenv').config();
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let token = '';
let results = { pass: 0, fail: 0 };

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(method, path, body = null, useToken = true) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (useToken && token) options.headers['Authorization'] = `Bearer ${token}`;
        if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

        const url = new URL(BASE_URL + path);
        options.hostname = url.hostname;
        options.port = url.port;
        options.path = url.pathname;

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

// ── Test suites ───────────────────────────────────────────────────────────────

async function testLogin() {
    console.log('\n─── LOGIN ───');
    const res = await request('POST', '/login', { email: 'superadmin@inventory.local', password: 'password123' }, false);
    assert('POST /login → 200', res.status === 200, `status=${res.status}`);
    assert('Returns access_token', !!res.body.access_token);
    token = res.body.access_token;

    const bad = await request('POST', '/login', { email: 'wrong@test.com', password: 'wrong' }, false);
    assert('POST /login wrong creds → 401', bad.status === 401, `status=${bad.status}`);
}

async function testCRUD(label, path, createPayload, updatePayload, extraChecks = {}) {
    console.log(`\n─── ${label} ───`);
    let createdId;

    // GET all
    const all = await request('GET', path);
    assert(`GET ${path} → 200`, all.status === 200, `status=${all.status}`);
    assert(`GET ${path} → array`, Array.isArray(all.body), typeof all.body);

    // POST create
    const created = await request('POST', path, createPayload);
    assert(`POST ${path} → 201`, created.status === 201, `status=${created.status} body=${JSON.stringify(created.body)}`);
    if (created.status === 201) {
        createdId = created.body.id;
        assert(`POST ${path} → has id`, !!createdId);
        if (extraChecks.onCreate) extraChecks.onCreate(created.body);
    }

    if (!createdId) return;

    // GET by id
    const one = await request('GET', `${path}/${createdId}`);
    assert(`GET ${path}/${createdId} → 200`, one.status === 200, `status=${one.status}`);

    // PUT update
    const updated = await request('PUT', `${path}/${createdId}`, updatePayload);
    assert(`PUT ${path}/${createdId} → 200`, updated.status === 200, `status=${updated.status} body=${JSON.stringify(updated.body)}`);

    // GET not found
    const notFound = await request('GET', `${path}/99999`);
    assert(`GET ${path}/99999 → 404`, notFound.status === 404, `status=${notFound.status}`);

    // DELETE
    const deleted = await request('DELETE', `${path}/${createdId}`);
    assert(`DELETE ${path}/${createdId} → 200`, deleted.status === 200, `status=${deleted.status}`);

    // Confirm deleted
    const gone = await request('GET', `${path}/${createdId}`);
    assert(`GET ${path}/${createdId} after delete → 404`, gone.status === 404, `status=${gone.status}`);

    return createdId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== CRUD TEST SUITE ===');

    // 1. Login
    await testLogin();
    if (!token) { console.log('\nLogin gagal, test dihentikan.'); process.exit(1); }

    // 2. Categories
    const catAll = await request('GET', '/categories');
    const catId = catAll.body[0]?.id;
    await testCRUD('CATEGORIES', '/categories',
        { name: 'Test Category' },
        { name: 'Updated Category' }
    );

    // 3. Warehouses
    const whAll = await request('GET', '/warehouses');
    const whId = whAll.body[0]?.id;
    await testCRUD('WAREHOUSES', '/warehouses',
        { name: 'Test Warehouse', location: 'Jakarta' },
        { name: 'Updated Warehouse', location: 'Bandung' }
    );

    // 4. Suppliers
    await testCRUD('SUPPLIERS', '/suppliers',
        { name: 'Test Supplier', contact: '08123456789' },
        { name: 'Updated Supplier', contact: '08987654321' }
    );

    // 5. Products — butuh CategoryId yang valid
    if (catId) {
        await testCRUD('PRODUCTS', '/products',
            { name: 'Test Product', sku: 'SKU-TEST-001', barcode: 'BAR-TEST-001', qrString: 'QR-TEST-001', unit: 'pcs', CategoryId: catId },
            { name: 'Updated Product', unit: 'box' }
        );
    } else {
        console.log('\n─── PRODUCTS ───');
        console.log('  ⚠ Skipped — tidak ada category di database');
    }

    // 6. Stocks — butuh ProductId + WarehouseId yang valid
    const prodAll = await request('GET', '/products');
    const prodId = prodAll.body[0]?.id;
    if (prodId && whId) {
        await testCRUD('STOCKS', '/stocks',
            { ProductId: prodId, WarehouseId: whId, quantity: 100 },
            { quantity: 150 }
        );
    } else {
        console.log('\n─── STOCKS ───');
        console.log(`  ⚠ Skipped — prodId=${prodId}, warehouseId=${whId}`);
    }

    // 7. Stock In Headers — butuh SupplierId yang valid
    const supAll = await request('GET', '/suppliers');
    const supId = supAll.body[0]?.id;
    if (supId) {
        await testCRUD('STOCK IN HEADERS', '/stock-in-headers',
            { SupplierId: supId, date: new Date().toISOString(), note: 'Test stock in' },
            { note: 'Updated note' }
        );
    } else {
        console.log('\n─── STOCK IN HEADERS ───');
        console.log('  ⚠ Skipped — tidak ada supplier di database');
    }

    // 8. Stock Out Headers — createdBy diambil dari token
    await testCRUD('STOCK OUT HEADERS', '/stock-out-headers',
        { destination: 'Test Destination', date: new Date().toISOString(), notes: 'Test stock out' },
        { destination: 'Updated Destination' }
    );

    // 9. Stock Movements — butuh ProductId + WarehouseId
    if (prodId && whId) {
        await testCRUD('STOCK MOVEMENTS', '/stock-movements',
            { ProductId: prodId, WarehouseId: whId, type: 'IN', quantity: 50, note: 'Test movement' },
            null  // no update for movements
        );
    } else {
        console.log('\n─── STOCK MOVEMENTS ───');
        console.log(`  ⚠ Skipped — prodId=${prodId}, warehouseId=${whId}`);
    }

    // 10. Stock Opname Sessions — butuh warehouseId
    let sessionId;
    if (whId) {
        console.log('\n─── STOCK OPNAME SESSIONS ───');
        const all = await request('GET', '/stock-opname-sessions');
        assert('GET /stock-opname-sessions → 200', all.status === 200);
        assert('GET /stock-opname-sessions → array', Array.isArray(all.body));

        const created = await request('POST', '/stock-opname-sessions', {
            warehouseId: whId, started_at: new Date().toISOString(), status: 'open', notes: 'Test opname'
        });
        assert('POST /stock-opname-sessions → 201', created.status === 201, `status=${created.status} body=${JSON.stringify(created.body)}`);
        sessionId = created.body?.id;
        if (sessionId) {
            assert('POST → has id', !!sessionId);
            const one = await request('GET', `/stock-opname-sessions/${sessionId}`);
            assert(`GET /stock-opname-sessions/${sessionId} → 200`, one.status === 200);
            const updated = await request('PUT', `/stock-opname-sessions/${sessionId}`, { status: 'closed', finished_at: new Date().toISOString() });
            assert(`PUT /stock-opname-sessions/${sessionId} → 200`, updated.status === 200);
        }
    } else {
        console.log('\n─── STOCK OPNAME SESSIONS ───');
        console.log('  ⚠ Skipped — tidak ada warehouse di database');
    }

    // 11. Stock Opname Items — butuh sessionId + productId
    if (sessionId && prodId) {
        await testCRUD('STOCK OPNAME ITEMS', '/stock-opname-items',
            { SessionId: sessionId, ProductId: prodId, scanned_qty: 10, system_qty: 10, difference: 0 },
            { scanned_qty: 12, difference: 2 }
        );
    } else {
        console.log('\n─── STOCK OPNAME ITEMS ───');
        console.log(`  ⚠ Skipped — sessionId=${sessionId}, prodId=${prodId}`);
    }

    // Clean up opname session after items test
    if (sessionId) {
        const del = await request('DELETE', `/stock-opname-sessions/${sessionId}`);
        assert(`DELETE /stock-opname-sessions/${sessionId} → 200`, del.status === 200);
        const gone = await request('GET', `/stock-opname-sessions/${sessionId}`);
        assert(`GET /stock-opname-sessions/${sessionId} after delete → 404`, gone.status === 404);
    }

    // 12. Users (admin only)
    await testCRUD('USERS (admin only)', '/users',
        { name: 'Test User', role: 'STAFF', email: 'testuser@inventory.local', password: 'password123' },
        { name: 'Updated Test User' }
    );

    // 13. Auth guard test
    console.log('\n─── AUTH GUARD ───');
    const noToken = await request('GET', '/categories', null, false);
    assert('GET /categories without token → 401', noToken.status === 401, `status=${noToken.status}`);

    // ── Summary ──
    const total = results.pass + results.fail;
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`HASIL: ${results.pass}/${total} passed  |  ${results.fail} failed`);
    console.log('═'.repeat(40));
    process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
