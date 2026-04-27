'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Article extends Model {
    static associate(models) {
      Article.hasMany(models.Product, {
        foreignKey: { name: 'ArticleId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Article.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Article name is required' },
        notEmpty: { msg: 'Article name is required' },
      },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Article',
  });
  return Article;
};
