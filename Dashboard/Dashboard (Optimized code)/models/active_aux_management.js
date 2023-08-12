let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Aux_Management = new Schema(
  {
    no_of_meetings: {
      type: Number,
      default: 0,
    },
    minutes: {
      type: Number,
      required: [true, 'Minutes is  required'],
    },
    color: {
      type: String,
      default: 'YELLOW',
    },
    name: {
      type: String,
      default: 'Training',
    },
    startTime: {
      type: Date,
      required: [false, 'Start Time is  optional'],
    },
    endTime: {
      type: Date,
      required: [false, 'End Time is  optional'],
    },
  },
  {
    timestamps: true,
  }
);
var Active_Aux_Management = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'User email is  required'],
    },
    assigned_to: {
      type: String,
      required: [true, 'Assigned to is required'],
    },
    assigned_to_name: {
      type: String,
    },
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    date: {
      type: Date,
    },
    name: {
      type: String,
    },
    assigned_to_name: {
      type: String,
    },
    aux_management: [Aux_Management],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Active_Aux_Management', Active_Aux_Management);
