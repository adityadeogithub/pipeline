let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var IdeationPost = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    user_email: {
      type: String,
    },
    message: {
      type: String,
    },
    uuid: {
      type: String,
    },
    likeStatus: {
      type: Number,
    },
    dislikeStatus: {
      type: Number,
    },
    file_path: {
      type: String,
    },
    file_type: {
      type: String,
    },
    like_count: {
      type: Number,
      default: 0,
    },
    dislike_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('IdeationPost', IdeationPost);
