let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Reaction = new Schema({
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
  name: {
    type: String,
  },
});

const Reply = new Schema(
  {
    member_email: {
      type: String,
    },
    message: {
      type: String,
    },
    name: {
      type: String,
    },
    time: {
      type: Date,
    },
    like_count: {
      type: Number,
      default: 0,
    },
    dislike_count: {
      type: Number,
      default: 0,
    },
    reaction: [Reaction],
  },
  {
    timestamps: true,
  }
);

const Comment = new Schema(
  {
    member_email: {
      type: String,
    },
    message: {
      type: String,
    },
    name: {
      type: String,
    },
    time: {
      type: Date,
    },
    like_count: {
      type: Number,
      default: 0,
    },
    dislike_count: {
      type: Number,
      default: 0,
    },
    reply: [Reply],
    reaction: [Reaction],
  },
  {
    timestamps: true,
  }
);

var IdeationComment = new Schema(
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
    likeStatus: {
      type: Number,
      default: 0,
    },
    dislikeStatus: {
      type: Number,
      default: 0,
    },
    comment: [Comment],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('IdeationComment', IdeationComment);
