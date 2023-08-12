let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Shortcut = new Schema(
  {
    user_email: {
      type: String,
    },
    organization: {
      type: String,
    },
    taskManager: {
      type: Boolean,
      enum: [true, false],
      default: true,
    },
    leaveManagement: {
      type: Boolean,
      enum: [true, false],
      default: true,
    },
    note: {
      type: Boolean,
      enum: [true, false],
      default: true,
    },
    reminder: {
      type: Boolean,
      enum: [true, false],
      default: true,
    },

    asset: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    drive: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    daily_reflection: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    time_sheet: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    google_calender: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    ideationZone: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Shortcut', Shortcut);
