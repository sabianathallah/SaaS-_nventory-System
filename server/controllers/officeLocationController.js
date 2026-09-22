'use strict';
const { Op } = require('sequelize');
const { OfficeLocation, Attendance } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

class OfficeLocationController {
    static async list(req, res, next) {
        try {
            const locations = await OfficeLocation.findAll({ where: { ...companyFilter(req) }, order: [['name', 'ASC']] });
            res.json(locations);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { name, address, latitude, longitude, radiusMeters } = req.body;
            if (!name || latitude === undefined || longitude === undefined) {
                throw { name: 'BadRequest', message: 'name, latitude, dan longitude wajib diisi' };
            }
            const location = await OfficeLocation.create({
                name, address: address || null, latitude, longitude,
                radiusMeters: radiusMeters || 150,
                companyId: companyId(req),
            });
            res.status(201).json(location);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const location = await OfficeLocation.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!location) throw { name: 'NotFound', message: 'Lokasi tidak ditemukan' };
            const { name, address, latitude, longitude, radiusMeters } = req.body;
            await location.update({
                name: name ?? location.name,
                address: address ?? location.address,
                latitude: latitude ?? location.latitude,
                longitude: longitude ?? location.longitude,
                radiusMeters: radiusMeters ?? location.radiusMeters,
            });
            res.json(location);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const location = await OfficeLocation.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!location) throw { name: 'NotFound', message: 'Lokasi tidak ditemukan' };
            const usageCount = await Attendance.count({
                where: { [Op.or]: [{ checkInLocationId: location.id }, { checkOutLocationId: location.id }] },
            });
            if (usageCount > 0) {
                throw { name: 'BadRequest', message: `Lokasi ini sudah dipakai di ${usageCount} data presensi — hapus akan menghilangkan jejak lokasi dari histori tersebut. Ganti nama/radius saja kalau lokasinya sudah tidak relevan, tidak perlu dihapus` };
            }
            await location.destroy();
            res.json({ message: 'Lokasi dihapus' });
        } catch (err) { next(err); }
    }
}

module.exports = OfficeLocationController;
