let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Attendees = new Schema(
  {
    response: {
      type: String,
    },
    emailAddress: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

let OutlookMeeting = new Schema(
  {
    user_email: {
      type: String,
    },
    user_name: {
      type: String,
    },
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    assigned_to: {
      type: String,
    },
    organizer: {
      type: String,
    },
    organizer_email: {
      type: String,
    },
    timezone: {
      type: String,
    },
    subject: {
      type: String,
    },
    start: {
      type: Date,
    },
    end: {
      type: Date,
    },
    meetingType: {
      type: String,
    },
    attendees: [Attendees],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OutlookMeeting', OutlookMeeting);
