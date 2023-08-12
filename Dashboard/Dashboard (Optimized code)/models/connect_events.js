let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let ConnectEvents = new Schema(
  {
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
      required: [true, 'User email is  required'],
    },
    event_type: {
      type: String,
      enum: ['SCREEN_SHARING', 'WHITEBOARD_SHARING'],
    },
    start_time: {
      type: Date,
    },
    end_time: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ConnectEvents', ConnectEvents);
