let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let collection = 'users_leave';

const UserLeave = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'User Email is  required'],
    },
    leave_from: {
      type: Date,
      required: [true, 'Leave from date required'],
    },
    leave_to: {
      type: Date,
      required: [true, 'leave to is  required'],
    },
    leave_subject: {
      type: String,
      required: [false, 'leave to is  optional'],
    },
    leave_message: {
      type: String,
      required: [true, 'leave to is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    assigned_to: {
      type: String,
      required: [true, 'Assigned to is required'],
    },
    application_status: {
      type: String,
      required: [true, 'Application status to is required'],
    },
    no_of_days: {
      type: Number,
    },
    leave_status: {
      type: Boolean,
    },
    approved_date: {
      type: Date,
    },
    reject_reason: {
      type: String,
    },
    date_array: {
      type: Array,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UserLeave', UserLeave, collection);
