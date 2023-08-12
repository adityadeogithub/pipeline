let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Reaction = new Schema(
  {
    reacted_by: {
      type: String,
    },
    likeStatus: {
      type: Boolean,
      default: false,
    },
    dislikeStatus: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

var IdeationLikeDislikePost = new Schema(
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
    uuid: {
      type: String,
    },
    reaction: [Reaction],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'IdeationLikeDislikePost',
  IdeationLikeDislikePost
);
