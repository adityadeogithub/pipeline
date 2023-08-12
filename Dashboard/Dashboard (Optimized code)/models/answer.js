let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Answer = new mongoose.Schema({
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
    required: [false, 'Assigned to is optional'],
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
  questionId: {
    type: String,
  },
  answer: {
    type: String,
  },
});

module.exports = mongoose.model('Answer', Answer);
