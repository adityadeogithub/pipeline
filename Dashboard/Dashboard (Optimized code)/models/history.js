let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const UserHistory = new Schema({
  user_id: {
    //This is the Profile _id
    type: String,
    required: [true, 'User ID is required'],
  },
  user: {
    type: String,
    required: [true, 'User is required'],
  },
  avatar: {
    type: String,
    required: [true, 'Avatar is required'],
  },
});

let History = new Schema(
  {
    user: UserHistory,
    room: {
      type: String,
      required: [true, 'Room is required'],
    },
    text: {
      type: String,
      required: [true, 'Text is required'],
    },
    type: {
      type: String,
      required: [false, 'Type is required'],
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('History', History);
