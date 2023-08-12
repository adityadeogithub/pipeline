let mongoose = require('mongoose');
let Schema = mongoose.Schema;

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
  },
  {
    timestamps: true,
  }
);

const Discussions = new Schema(
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
    reply: [Reply],
  },
  {
    timestamps: true,
  }
);

const Discussion = new Schema(
  {
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    uuid: {
      type: String,
    },
    discussions: [Discussions],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Discussion', Discussion);
