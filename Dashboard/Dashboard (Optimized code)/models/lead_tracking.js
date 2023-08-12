let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const LeadTracking = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    user_email: {
      type: String,
    },
    assigned_to: {
      type: String,
    },
    user_id: {
      type: String,
    },
    partner_id: {
      type: String,
    },
    partner_name: {
      type: String,
    },
    partner_address: {
      type: String,
    },
    partner_city: {
      type: String,
    },
    partner_state: {
      type: String,
    },
    partner_contact: {
      type: String,
    },
    partner_latitude: {
      type: String,
    },
    partner_longitude: {
      type: String,
    },
    partner_meeting_date: {
      type: Date,
    },
    created_on: {
      type: Date,
    },
    status: {
      type: String,
      default: 'OPEN',
    },
    email: {
      type: String,
    },
    comment: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
    meeting_start: {
      type: Date,
    },
    meeting_end: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LeadTracking', LeadTracking);
