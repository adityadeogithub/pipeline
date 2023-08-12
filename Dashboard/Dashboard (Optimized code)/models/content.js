let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Content = new Schema(
  {
    uuid: {
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
    user_email: {
      type: String,
      required: [true, 'User Email is  required'],
    },
    assigned_to: {
      type: String,
    },
    title: {
      type: String,
    },
    content_type: {
      type: String,
    },
    content: {
      type: String,
    },
    date: {
      type: Date,
    },
    file_path: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Content', Content);
