'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TaskAttachments', {
      id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      taskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tasks', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('IMAGE', 'VIDEO_LINK'),
        allowNull: false,
      },
      url:  { type: Sequelize.TEXT, allowNull: false },
      caption: { type: Sequelize.STRING(255), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('TaskAttachments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TaskAttachments_type";');
  },
};
