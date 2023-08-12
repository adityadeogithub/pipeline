let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Feedback = new mongoose.Schema(
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
    name: {
      type: String,
    },
    courseId: {
      type: String,
    },
    form: [
      {
        text: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('Feedback', Feedback);
