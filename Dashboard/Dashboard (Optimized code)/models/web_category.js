let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Web_Category = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    web_name: {
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

module.exports = mongoose.model('Web_Category', Web_Category);
