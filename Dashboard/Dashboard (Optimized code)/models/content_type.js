let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var content_type = new Schema(
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
      required: [true, 'User Email is  required'],
    },
    assigned_to: {
      type: String,
    },
    file_path: {
      type: String,
    },
    date: {
      type: Date,
    },
    title: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('content_type', content_type);
