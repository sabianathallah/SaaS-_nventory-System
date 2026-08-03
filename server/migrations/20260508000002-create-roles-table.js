'use strict';
const { DEFAULT_PERMISSIONS, SYSTEM_ROLES } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Roles', {
      id:          { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name:        { type: Sequelize.STRING(100), allowNull: false },
      displayName: { type: Sequelize.STRING(200), allowNull: false },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      isSystem:  { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('Roles', ['name', 'companyId'], {
      unique: true,
      name: 'roles_name_companyid_unique',
    });

    // Seed system + default roles (companyId=null, accessible to all companies)
    const now = new Date();
    const DISPLAY_NAMES = {
      SUPER_ADMIN:   'Super Admin',
      ADMIN:         'Admin',
      COMPANY_ADMIN: 'Company Admin',
      OPERASIONAL:   'Operasional',
      HEAD_PACKING:  'Head Packing',
      TIM_PACKING:   'Tim Packing',
      HR:            'HR',
      CEO:           'CEO',
    };

    const allDefaultKeys = Object.keys(DEFAULT_PERMISSIONS);
    await queryInterface.bulkInsert('Roles',
      allDefaultKeys.map(name => ({
        name,
        displayName: DISPLAY_NAMES[name] ?? name,
        companyId:   null,
        isSystem:    SYSTEM_ROLES.includes(name),
        createdAt:   now,
        updatedAt:   now,
      }))
    );
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Roles');
  },
};
