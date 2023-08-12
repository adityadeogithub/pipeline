let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Question = new mongoose.Schema(
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
    quizId: {
      type: String,
    },

    description: {
      type: String,
    },
    alternatives: [
      {
        text: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Question', Question);
