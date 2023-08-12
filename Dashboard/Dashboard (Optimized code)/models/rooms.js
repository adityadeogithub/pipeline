let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Room = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
    },
    avatar: {
      type: String,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
    },
    type: {
      type: String, //Can be private or public
      enum: ['PRIVATE', 'PUBLIC'],
      required: [true, 'type is required'],
    },
    lastActivity: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER'],
      required: [true, 'Role is required'],
    },
    status: {
      type: String,
      default: 'OFFLINE',
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('Room', Room);
