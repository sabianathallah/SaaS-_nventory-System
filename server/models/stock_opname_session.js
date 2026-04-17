'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Opname_Session extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_Opname_Session.belongsTo(models.Warehouse, {
        foreignKey: { name: 'warehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Opname_Session.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Opname_Session.hasMany(models.Stock_Opname_Item, {
        foreignKey: { name: 'SessionId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Opname_Session.init({
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Warehouse is required' },
        notEmpty: { msg: 'Warehouse is required' }
      }
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        notNull: { msg: 'Started at is required' },
        notEmpty: { msg: 'Started at is required' }
      }
    },
    finished_at: DataTypes.DATE,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Status is required' },
        notEmpty: { msg: 'Status is required' }
      }
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Creator is required' },
        notEmpty: { msg: 'Creator is required' }
      }
    },
    notes: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Stock_Opname_Session',
  });
  return Stock_Opname_Session;
};