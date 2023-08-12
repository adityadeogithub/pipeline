let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var User_Course = new Schema(
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
    start_date: {
      type: Date,
    },
    enrolled: {
      type: Boolean,
    },
    course_uuid: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User_Course', User_Course);
