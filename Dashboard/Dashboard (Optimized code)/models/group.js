let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let Group = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
    },
    avatar: {
      type: String,
    },
    groupName: {
      type: String,
      required: [true, 'Group Name is required'],
    },
    type: {
      type: String, //Can be private or public
      enum: ['PRIVATE', 'PUBLIC'],
      required: [true, 'type is required'],
    },
    groupStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('Group', Group);
