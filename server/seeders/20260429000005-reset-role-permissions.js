'use strict';

// Clears all custom RolePermission overrides so every role falls back to
// the updated DEFAULT_PERMISSIONS in helpers/permissions.js
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkDelete('RolePermissions', null, {});
  },
  async down() {
    // No-op: permissions are re-created on demand when admin edits a role
  },
};
