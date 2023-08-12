let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const UserFeedback = new mongoose.Schema({
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

  courseId: {
    type: String,
  },
  name: {
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
});

module.exports = mongoose.model('UserFeedback', UserFeedback);
