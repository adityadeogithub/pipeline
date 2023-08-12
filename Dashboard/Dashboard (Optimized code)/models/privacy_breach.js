let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var PrivacyBreach = new Schema(
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
      required: [true, 'user email is required'],
    },
    assigned_to: {
      type: String,
    },
    date: {
      type: Date,
      required: [true, 'Date at is required'],
    },
    detected_at: {
      type: Date,
      required: [true, 'Detected at is required'],
    },
    breach_type: {
      type: String,
      required: [true, 'Breach type is required'],
    },
    photo_url: {
      type: String,
    },
    thumbnail_photo_url: {
      type: String,
    },
    remediation: {
      type: String,
    },
    second_remediation: {
      type: String,
    },
    second_note: {
      type: String,
    },
    retain: {
      type: Boolean,
    },
    compliance: {
      type: Boolean,
    },
    super_audit_compliance: {
      type: Boolean,
    },
    non_compliance: {
      type: Boolean,
    },
    super_audit_non_compliance: {
      type: Boolean,
    },
    audit_done: {
      type: Boolean,
    },
    super_audit_done: {
      type: Boolean,
    },
    purge: {
      type: Boolean,
    },
    note: {
      type: String,
    },
    image_save: {
      type: Boolean,
    },
    audit_done_by: {
      type: String,
    },
    super_audit_done_by: {
      type: String,
    },
    breach_id: {
      type: String,
    },
    status: {
      type: String,
      enum: ['N/A', 'VALID_DISPUTE', 'INVALID_DISPUTE', 'DISPUTE'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PrivacyBreach', PrivacyBreach);
