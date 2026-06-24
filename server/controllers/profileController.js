'use strict';
const { User } = require('../models');
const { compare } = require('../helpers/bcrypt');
const { destroyByUrl } = require('../helpers/cloudinary');

class ProfileController {
  // GET /me — current user profile
  static async get(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role', 'companyId', 'avatar', 'divisi', 'isActive'],
      });
      if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
      res.json(user);
    } catch (err) { next(err); }
  }

  // PATCH /me — update name and/or avatar
  static async update(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

      if (req.body.name?.trim()) user.name = req.body.name.trim();
      if (req.body.divisi !== undefined) user.divisi = req.body.divisi?.trim() || null;

      if (req.file) {
        // Delete old avatar from Cloudinary if exists
        if (user.avatar) await destroyByUrl(user.avatar);
        user.avatar = req.file.path;
      }

      await user.save();
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, avatar: user.avatar, divisi: user.divisi });
    } catch (err) { next(err); }
  }

  // DELETE /me/avatar — remove avatar
  static async deleteAvatar(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
      if (user.avatar) {
        await destroyByUrl(user.avatar);
        user.avatar = null;
        await user.save();
      }
      res.json({ message: 'Foto profil dihapus' });
    } catch (err) { next(err); }
  }

  // PATCH /me/password — change password (requires current password)
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Password lama dan password baru wajib diisi' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

      const valid = compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: 'Password lama salah' });

      user.password = newPassword; // model hook will hash it
      await user.save();
      res.json({ message: 'Password berhasil diubah' });
    } catch (err) { next(err); }
  }
}

module.exports = ProfileController;
