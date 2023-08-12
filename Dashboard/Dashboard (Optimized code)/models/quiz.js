let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Quiz = new mongoose.Schema(
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
    courseName: {
      type: String,
    },
    courseId: {
      type: String,
    },
    quizId: {
      type: String,
    },
    passingScore: {
      type: Number,
      default: 35,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Quiz', Quiz);
