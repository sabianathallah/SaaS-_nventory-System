'use strict';
/**
 * Backfill sinkronisasi nomor resi antara ManualShipment dan Request (Pengajuan).
 *
 * Aturan (non-destruktif — tidak pernah mengosongkan/menghapus data):
 *  - Shipment punya resi  → Request.trackingNumber disamakan (shipment = sumber kebenaran).
 *  - Shipment tanpa resi, Request punya trackingNumber → resi shipment diisi dari Request.
 *  - Dua-duanya kosong → dilewati.
 *
 * Jalankan:  node scripts/backfill-resi-sync.js            (dry-run, hanya laporan)
 *            node scripts/backfill-resi-sync.js --apply    (tulis perubahan)
 */
const { sequelize, ManualShipment, Request } = require('../models');

const APPLY = process.argv.includes('--apply');

async function main() {
  const shipments = await ManualShipment.findAll({
    where: { sourceRequestId: { [require('sequelize').Op.ne]: null } },
    attributes: ['id', 'invoiceNumber', 'courierResiNumber', 'sourceRequestId'],
    order: [['id', 'ASC']],
  });
  console.log(`Ditemukan ${shipments.length} shipping manual yang berasal dari pengajuan.\n`);

  let fixRequest = 0, fixShipment = 0, skipped = 0;

  for (const s of shipments) {
    const request = await Request.findByPk(s.sourceRequestId, {
      attributes: ['id', 'trackingNumber'],
    });
    if (!request) { skipped++; continue; }

    const shipResi = s.courierResiNumber?.trim() || null;
    const reqResi  = request.trackingNumber?.trim() || null;

    if (shipResi && shipResi !== reqResi) {
      console.log(`[Request #${request.id}] trackingNumber: ${JSON.stringify(reqResi)} -> ${JSON.stringify(shipResi)}  (dari shipment ${s.invoiceNumber})`);
      if (APPLY) await request.update({ trackingNumber: shipResi });
      fixRequest++;
    } else if (!shipResi && reqResi) {
      console.log(`[Shipment ${s.invoiceNumber}] courierResiNumber: null -> ${JSON.stringify(reqResi)}  (dari Request #${request.id})`);
      if (APPLY) await s.update({ courierResiNumber: reqResi });
      fixShipment++;
    } else {
      skipped++;
    }
  }

  console.log(`\nRingkasan: ${fixRequest} pengajuan disamakan, ${fixShipment} shipment diisi, ${skipped} sudah sinkron/dilewati.`);
  console.log(APPLY ? 'Perubahan SUDAH ditulis ke database.' : 'DRY-RUN — tidak ada yang ditulis. Jalankan dengan --apply untuk menerapkan.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => sequelize.close());
