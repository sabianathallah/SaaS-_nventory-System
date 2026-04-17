'use strict';
const bcrypt = require('bcryptjs');
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.hasMany(models.Stock_Out_Header, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.Stock_Opname_Session, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  User.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } }
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Role is required' } }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Email is required' },
        isEmail: { msg: 'Invalid email format' }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Password is required' } }
    }
  }, {
    sequelize,
    modelName: 'User',
    hooks: {
      beforeCreate: (user) => {
        if (user.password) {
          user.password = bcrypt.hashSync(user.password, 10);
        }
      },
      beforeUpdate: (user) => {
        if (user.changed('password')) {
          user.password = bcrypt.hashSync(user.password, 10);
        }
      }
    }
  });
  return User;
};