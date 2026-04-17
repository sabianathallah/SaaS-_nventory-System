'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Warehouse extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Warehouse.hasMany(models.Stock, {
        foreignKey: { name: 'WarehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Warehouse.hasMany(models.Stock_Movement, {
        foreignKey: { name: 'WearhouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Warehouse.hasMany(models.Stock_Opname_Session, {
        foreignKey: { name: 'warehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Warehouse.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } }
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Location is required' } }
    }
  }, {
    sequelize,
    modelName: 'Warehouse',
  });
  return Warehouse;
};