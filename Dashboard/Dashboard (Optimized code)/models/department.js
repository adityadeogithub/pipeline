let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const notification = new Schema({
  notification_email: {
    type: String,
  },
});

const department = new Schema({
  name: {
    type: String,
    required: [true, 'Department  is required'],
  },
  notifications: [notification],
});

var Department = new Schema(
  {
    organization: {
      type: String,
      required: [true, 'Organization is required'],
    },
    department_array: [department],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('Department', Department);
