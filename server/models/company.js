'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    static associate(models) {
      Company.hasMany(models.User, {
        foreignKey: { name: 'companyId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  Company.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Company name is required' },
        notEmpty: { msg: 'Company name is required' }
      }
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { msg: 'Slug already exists' },
      validate: {
        notNull: { msg: 'Slug is required' },
        notEmpty: { msg: 'Slug is required' }
      }
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'inactive', 'suspended']],
          msg: 'Status must be active, inactive, or suspended'
        }
      }
    },
    subscriptionExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    legalName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Company',
  });
  return Company;
};
