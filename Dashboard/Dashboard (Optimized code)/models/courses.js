let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var time_options = new Schema(
  {
    start_date: {
      type: Date,
    },
    expiration_date: {
      type: Date,
    },
  },

  {
    timestamps: true,
  }
);

var Courses = new Schema(
  {
    uuid: {
      type: String,
    },
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    user_email: {
      type: String,
    },
    assign_to: {
      type: String,
    },
    course_name: {
      type: String,
    },
    course_category: {
      type: String,
      default: 'Sample',
    },
    description: {
      type: String,
    },
    course_code: {
      type: String,
    },

    upload_image_file_path: {
      type: String,
    },
    course_capacity: {
      type: Number,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    course_duration: {
      type: String,
    },
    level: {
      type: String,
      //enum: ["Beginner", "Intermediate", "Advanced"]
    },
    certification: {
      type: String,
      // enum: ["Simple", "Classic"]
    },
    enrolled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Courses', Courses);
