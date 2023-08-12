let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Authorized = new Schema({
  name: {
    type: String,
  },
  minutes: {
    type: Number,
    default: 0,
  },
});

var Unauthorized = new Schema({
  name: {
    type: String,
  },
  minutes: {
    type: Number,
    default: 0,
  },
});

var App_Web_Category = new Schema(
  {
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    user_email: {
      type: String,
    },
    assigned_to: {
      type: String,
    },
    type: {
      type: String,
      enum: ['APP', 'WEB'],
      default: 'APP',
    },
    category_name: {
      type: String,
    },
    authorized: [Authorized],
    unauthorized: [Unauthorized],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('App_Web_Category', App_Web_Category);
