'use strict';
const { Model } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', allowNull: true },
        as: 'company',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
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
      User.hasMany(models.Attendance, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'attendances',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.LeaveRequest, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'leaveRequests',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.LeaveRequest, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewedLeaveRequests',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.LeaveBalance, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'leaveBalances',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.belongsToMany(models.Task, {
        through: models.TaskAssignee,
        foreignKey: 'userId',
        otherKey: 'taskId',
        as: 'assignedTasks',
      });
      User.hasMany(models.Task, {
        foreignKey: { name: 'createdBy', allowNull: false },
        as: 'createdTasks',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.TaskComment, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'taskComments',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.TaskList, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'taskLists',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.Notification, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'notifications',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.OvertimeRequest, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'overtimeRequests',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.OvertimeRequest, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewedOvertimeRequests',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      User.belongsTo(models.Shift, {
        foreignKey: { name: 'shiftId', allowNull: true },
        as: 'shift',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.WfaRequest, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'wfaRequests',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.WfaRequest, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewedWfaRequests',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.WfaQuota, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'wfaQuotas',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.PaymentAdjustment, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'paymentAdjustments',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasOne(models.SalaryProfile, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'salaryProfile',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      User.hasMany(models.Payslip, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'payslips',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  User.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Name is required' },
        notEmpty: { msg: 'Name is required' }
      }
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Role is required' },
        notEmpty: { msg: 'Role is required' }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { msg: 'Email already exists' },
      validate: {
        notNull: { msg: 'Email is required' },
        notEmpty: { msg: 'Email is required' },
        isEmail: { msg: 'Invalid email format' }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Password is required' },
        notEmpty: { msg: 'Password is required' }
      }
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    divisi: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Kept in sync as divisis[0] for old single-divisi code paths (reports,
    // task/request defaulting) — divisis is the source of truth for access
    // control, since a user can now belong to more than one.
    divisis: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    shiftId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nik: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'User',
    hooks: {
      beforeCreate: (user) => {
        if (user.password) {
          user.password = hashPassword(user.password);
        }
      },
      beforeUpdate: (user) => {
        if (user.changed('password')) {
          user.password = hashPassword(user.password);
        }
      }
    }
  });
  return User;
};