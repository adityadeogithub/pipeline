let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let DeviceBreach = new Schema(
  {
    organization: {
      type: String,
      required: [true, 'Organization is required'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
    },
    user_email: {
      type: String,
      required: [true, 'User Email is required'],
    },
    assigned_to: {
      type: String,
      required: [true, 'Assigned To is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date at is required'],
    },
    status: {
      type: Boolean,
      required: [true, 'status is required'],
    },
    connectivityType: {
      type: String,
    },
    deviceType: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeviceBreach', DeviceBreach);
