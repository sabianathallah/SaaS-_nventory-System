'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RolePermissions', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      role: { type: Sequelize.STRING, allowNull: false },
      permissions: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('RolePermissions', ['role', 'companyId'], {
      unique: true,
      name: 'role_permissions_role_companyid_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('RolePermissions');
  },
};
