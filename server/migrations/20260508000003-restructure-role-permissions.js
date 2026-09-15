'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Snapshot old RolePermissions data before dropping
    const oldRows = await queryInterface.sequelize.query(
      'SELECT role, permissions, "companyId" FROM "RolePermissions"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    // 2. Drop old table
    await queryInterface.dropTable('RolePermissions');

    // 3. Create new junction table
    await queryInterface.createTable('RolePermissions', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permissionKey: { type: Sequelize.STRING(100), allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('RolePermissions', ['roleId', 'permissionKey'], {
      unique: true,
      name: 'role_permissions_roleid_key_unique',
    });

    // 4. Migrate old data: for each old row, find or create the Role, then insert RolePermissions
    const now = new Date();
    for (const row of oldRows) {
      const perms = Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions ?? '[]');
      if (!perms.length) continue;

      // Find the matching Role row
      const [roleRows] = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND ("companyId" = :cid OR ("companyId" IS NULL AND :cid IS NULL))`,
        { replacements: { name: row.role, cid: row.companyId }, type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      let roleId;
      if (roleRows) {
        roleId = roleRows.id;
      } else {
        // Custom company role not yet in Roles table — create it
        await queryInterface.bulkInsert('Roles', [{
          name: row.role,
          displayName: row.role,
          companyId: row.companyId,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        }]);
        const [newRole] = await queryInterface.sequelize.query(
          `SELECT id FROM "Roles" WHERE name = :name AND "companyId" ${row.companyId ? '= :cid' : 'IS NULL'}`,
          { replacements: { name: row.role, cid: row.companyId }, type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        roleId = newRole.id;
      }

      // Insert RolePermissions rows (skip duplicates)
      for (const key of perms) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT DO NOTHING`,
          { replacements: { roleId, key, now } }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('RolePermissions');
    await queryInterface.createTable('RolePermissions', {
      id:          { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      role:        { type: Sequelize.STRING, allowNull: false },
      permissions: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      companyId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Companies', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('RolePermissions', ['role', 'companyId'], {
      unique: true, name: 'role_permissions_role_companyid_unique',
    });
  },
};
