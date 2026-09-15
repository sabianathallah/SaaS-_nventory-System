'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SubCategory extends Model {
    static associate(models) {
      SubCategory.hasMany(models.Product, {
        foreignKey: { name: 'SubCategoryId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  SubCategory.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Name is required' },
        notEmpty: { msg: 'Name is required' }
      }
    },
    companyId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'SubCategory',
  });
  return SubCategory;
};
