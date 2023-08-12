let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var App_Category = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    app_name: {
      type: String,
    },
    category_name: {
      type: String,
    },
    type: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('App_Category', App_Category);
