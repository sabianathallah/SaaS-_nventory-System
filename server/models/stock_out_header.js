'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Out_Header extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_Out_Header.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Out_Header.belongsTo(models.User, {
        foreignKey: { name: 'updatedBy', allowNull: true },
        as: 'updater',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_Out_Header.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Out_Header.init({
    destination: { type: DataTypes.STRING, allowNull: true },
    WarehouseId: { type: DataTypes.INTEGER, allowNull: true },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    purpose: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Lainnya',
    },
    notes: DataTypes.STRING,
    // Sesi edit: 'closed' = terkunci (default), 'open' = item bisa diedit
    status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'closed' },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Creator is required' },
        notEmpty: { msg: 'Creator is required' }
      }
    },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Stock_Out_Header',
  });
  return Stock_Out_Header;
};