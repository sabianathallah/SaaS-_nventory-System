'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Attendance extends Model {
    static associate(models) {
      Attendance.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.Shift, {
        foreignKey: { name: 'shiftId', allowNull: true },
        as: 'shift',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.OfficeLocation, {
        foreignKey: { name: 'checkInLocationId', allowNull: true },
        as: 'checkInLocation',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.OfficeLocation, {
        foreignKey: { name: 'checkOutLocationId', allowNull: true },
        as: 'checkOutLocation',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.User, {
        foreignKey: { name: 'editedBy', allowNull: true },
        as: 'editor',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.User, {
        foreignKey: { name: 'lateExcuseReviewedBy', allowNull: true },
        as: 'lateExcuseReviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.belongsTo(models.LateExcuseRequest, {
        foreignKey: { name: 'lateExcuseRequestId', allowNull: true },
        as: 'lateExcuseRequest',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Attendance.hasMany(models.OvertimeRequest, {
        foreignKey: { name: 'attendanceId', allowNull: true },
        as: 'overtimeRequests',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Attendance.init({
    userId:             { type: DataTypes.INTEGER, allowNull: false },
    date:               { type: DataTypes.DATEONLY, allowNull: false },
    shiftId:            { type: DataTypes.INTEGER, allowNull: true },
    checkInAt:          { type: DataTypes.DATE, allowNull: true },
    checkInLat:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    checkInLng:         { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    checkInLocationId:  { type: DataTypes.INTEGER, allowNull: true },
    checkInPhoto:       { type: DataTypes.STRING, allowNull: true },
    checkOutAt:         { type: DataTypes.DATE, allowNull: true },
    checkOutLat:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    checkOutLng:        { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    checkOutLocationId: { type: DataTypes.INTEGER, allowNull: true },
    checkOutPhoto:      { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HALF_DAY'),
      allowNull: false,
      defaultValue: 'PRESENT',
    },
    workMode: {
      type: DataTypes.ENUM('ON_SITE', 'WFA', 'FIELD'),
      allowNull: false,
      defaultValue: 'ON_SITE',
    },
    checkOutWorkMode: {
      type: DataTypes.ENUM('ON_SITE', 'FIELD'),
      allowNull: true,
    },
    reviewStatus: {
      type: DataTypes.ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewNote: { type: DataTypes.TEXT, allowNull: true },
    lateExcuseStatus: {
      type: DataTypes.ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    lateExcuseReason:     { type: DataTypes.TEXT, allowNull: true },
    lateExcuseReviewedBy: { type: DataTypes.INTEGER, allowNull: true },
    lateExcuseReviewedAt: { type: DataTypes.DATE, allowNull: true },
    lateExcuseReviewNote: { type: DataTypes.TEXT, allowNull: true },
    lateExcuseRequestId:  { type: DataTypes.INTEGER, allowNull: true },
    note:      { type: DataTypes.TEXT, allowNull: true },
    editedBy:  { type: DataTypes.INTEGER, allowNull: true },
    editedAt:  { type: DataTypes.DATE, allowNull: true },
    editReason: { type: DataTypes.TEXT, allowNull: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Attendance',
  });
  return Attendance;
};
