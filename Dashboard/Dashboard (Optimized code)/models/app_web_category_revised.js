let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Categories = new Schema(
  {
    category_name: {
      type: String,
    },
    date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

var App_Web_Category_Revised = new Schema(
  {
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    categories: [Categories],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'App_Web_Category_Revised',
  App_Web_Category_Revised
);
