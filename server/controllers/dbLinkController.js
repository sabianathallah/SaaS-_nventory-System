'use strict';
const { DbFolder, DbLink, User } = require('../models');

const CREATOR_INCLUDE = { model: User, as: 'Creator', attributes: ['id', 'name'] };

// ── Folders ───────────────────────────────────────────────────────────────────

exports.listFolders = async (req, res, next) => {
  try {
    const folders = await DbFolder.findAll({
      include: [
        CREATOR_INCLUDE,
        { model: DbLink, as: 'links', attributes: ['id'] },
      ],
      order: [['position', 'ASC'], ['createdAt', 'ASC']],
    });
    const data = folders.map(f => ({
      ...f.toJSON(),
      linkCount: f.links?.length ?? 0,
      links: undefined,
    }));
    res.json({ data });
  } catch (err) { next(err); }
};

exports.createFolder = async (req, res, next) => {
  try {
    const { name, color, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Nama folder wajib diisi' });
    const maxPos = await DbFolder.max('position') ?? 0;
    const folder = await DbFolder.create({
      name: name.trim(), color: color || '#6366f1',
      description: description?.trim() || null,
      position: maxPos + 1,
      createdBy: req.user.id,
    });
    const result = await DbFolder.findByPk(folder.id, { include: [CREATOR_INCLUDE] });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
};

exports.updateFolder = async (req, res, next) => {
  try {
    const folder = await DbFolder.findByPk(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder tidak ditemukan' });
    const { name, color, description } = req.body;
    await folder.update({
      name:        name?.trim()        ?? folder.name,
      color:       color               ?? folder.color,
      description: description?.trim() ?? folder.description,
    });
    const result = await DbFolder.findByPk(folder.id, { include: [CREATOR_INCLUDE] });
    res.json({ data: result });
  } catch (err) { next(err); }
};

exports.deleteFolder = async (req, res, next) => {
  try {
    const folder = await DbFolder.findByPk(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder tidak ditemukan' });
    await folder.destroy();
    res.json({ message: 'Folder dihapus' });
  } catch (err) { next(err); }
};

// ── Links ─────────────────────────────────────────────────────────────────────

exports.listLinks = async (req, res, next) => {
  try {
    const folder = await DbFolder.findByPk(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder tidak ditemukan' });
    const links = await DbLink.findAll({
      where: { folderId: folder.id },
      include: [CREATOR_INCLUDE],
      order: [['position', 'ASC'], ['createdAt', 'ASC']],
    });
    res.json({ data: links });
  } catch (err) { next(err); }
};

exports.createLink = async (req, res, next) => {
  try {
    const folder = await DbFolder.findByPk(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder tidak ditemukan' });
    const { title, url, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Judul wajib diisi' });
    if (!url?.trim())   return res.status(400).json({ message: 'URL wajib diisi' });
    const maxPos = await DbLink.max('position', { where: { folderId: folder.id } }) ?? 0;
    const link = await DbLink.create({
      title: title.trim(), url: url.trim(),
      description: description?.trim() || null,
      position: maxPos + 1,
      folderId: folder.id,
      createdBy: req.user.id,
    });
    const result = await DbLink.findByPk(link.id, { include: [CREATOR_INCLUDE] });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
};

exports.updateLink = async (req, res, next) => {
  try {
    const link = await DbLink.findByPk(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Link tidak ditemukan' });
    const { title, url, description } = req.body;
    await link.update({
      title:       title?.trim()       ?? link.title,
      url:         url?.trim()         ?? link.url,
      description: description !== undefined ? (description?.trim() || null) : link.description,
    });
    const result = await DbLink.findByPk(link.id, { include: [CREATOR_INCLUDE] });
    res.json({ data: result });
  } catch (err) { next(err); }
};

exports.deleteLink = async (req, res, next) => {
  try {
    const link = await DbLink.findByPk(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'Link tidak ditemukan' });
    await link.destroy();
    res.json({ message: 'Link dihapus' });
  } catch (err) { next(err); }
};
