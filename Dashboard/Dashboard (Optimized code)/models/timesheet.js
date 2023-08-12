let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var TimeSheet = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    user_email: {
      type: String,
      required: [true, 'User Email is  required'],
    },
    assigned_to: {
      type: String,
      required: [false, 'Assigned to is optional'],
    },
    taskTitle: {
      type: String,
      required: [true, 'Task title is required'],
    },
    taskDescription: {
      type: String,
    },
    assignBy: {
      type: String,
      required: [true, 'Assign by info is required'],
    },
    taskStartTime: {
      type: Date,
      required: [true, 'Task start time is required'],
    },
    taskEndTime: {
      type: Date,
      required: [true, 'Task end time is required'],
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TimeSheet', TimeSheet);
