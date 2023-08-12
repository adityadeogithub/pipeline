let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Profiles = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
    },
    avatar: {
      type: String,
    },
    about: {
      type: String,
      required: [true, 'About is required'],
    },
    status: {
      type: String,
      default: 'I am on wAnywhere Connect',
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER'],
      default: 'MEMBER',
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('Profile', Profiles);
