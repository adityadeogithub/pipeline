let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Streaming = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'User email is  required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is  required'],
    },
    time: {
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
    assigned_to: {
      type: String,
    },
    topic: {
      type: String,
    },
    description: {
      type: String,
    },
    duration: {
      type: String,
    },
    timezone: {
      type: String,
    },
    participants: {
      type: Array,
    },
    meeting_id: {
      type: String,
    },
    meeting_link: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Streaming', Streaming);
