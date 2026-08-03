'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Attendances', {
      id:               { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:           { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date:             { type: Sequelize.DATEONLY, allowNull: false },
      shiftId:          { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Shifts', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      checkInAt:        { type: Sequelize.DATE, allowNull: true },
      checkInLat:       { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      checkInLng:       { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      checkInLocationId:{ type: Sequelize.INTEGER, allowNull: true, references: { model: 'OfficeLocations', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      checkOutAt:       { type: Sequelize.DATE, allowNull: true },
      checkOutLat:      { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      checkOutLng:      { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      checkOutLocationId:{ type: Sequelize.INTEGER, allowNull: true, references: { model: 'OfficeLocations', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      status:           { type: Sequelize.ENUM('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HALF_DAY'), allowNull: false, defaultValue: 'PRESENT' },
      note:             { type: Sequelize.TEXT, allowNull: true },
      editedBy:         { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      companyId:        { type: Sequelize.INTEGER, allowNull: true },
      createdAt:        { type: Sequelize.DATE, allowNull: false },
      updatedAt:        { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('Attendances', ['userId', 'date'], { unique: true, name: 'attendances_user_date_unique' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Attendances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_status";');
  },
};
