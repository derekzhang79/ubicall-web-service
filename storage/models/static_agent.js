/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('static_agent', { 
    id: {
      type: DataTypes.INTEGER(16),
      allowNull: false,
    },
    agent_id: {
      type: DataTypes.INTEGER(16),
      allowNull: false,
    },
    queue_id: {
      type: DataTypes.INTEGER(16),
      allowNull: false,
    }
  });
};
