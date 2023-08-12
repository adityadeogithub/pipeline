let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const notification = new Schema({
  type: {
    type: String,
    enum: ['NONE', 'WEB', 'EMAIL', 'ALL'],
    default: 'NONE',
  },
});

//Low
const basic_activity = new Schema({
  type: {
    type: String,
    enum: ['NONE', 'IDLE_TIME', 'COPY_PASTE'],
    default: 'IDLE_TIME',
  },
  interval_time: {
    type: Number,
    default: 60,
  },
  notifications: [notification],
});

const productivity = new Schema({
  app: {
    type: String,
    enum: ['NATIVE_AGENT', 'WEB_AGENT'],
    default: 'NATIVE_AGENT',
  },
  work_hours: {
    type: Number,
    default: 540,
  },
  notifications: [notification],
});

//Medium

const screen_grab = new Schema({
  type: {
    type: Boolean,
    enum: [true, false],
    default: false,
  },
  interval_time: {
    type: Number,
    default: 60,
  },
});

const screen_recording = new Schema({
  type: {
    type: Boolean,
    enum: [true, false],
    default: false,
  },
  interval_time: {
    type: Number,
    default: 60,
  },
});

const screen_streaming = new Schema({
  type: {
    type: Boolean,
    enum: [true, false],
    default: false,
  },
});

//High
const ai = new Schema({
  detection_type: {
    type: String,
    enum: [
      'NONE',
      'NOT_AT_DESK',
      'MOBILE_DETECTED',
      'MULTIPLE_PERSONS',
      'UNKNOWN_PERSON',
      'ALERTNESS_DETECTION',
      'PEN_DETECTION',
      'NOTE_BOOK_DETECTION',
    ],
    default: 'NONE',
  },
  save_image: {
    type: Boolean,
    default: false,
  },
  interval_time: {
    type: Number,
    default: 60,
  },
  action: {
    type: String,
    enum: ['NONE', 'BLACK_SCREEN', 'LOCK_SCREEN'],
    default: 'NONE',
  },
  notifications: [notification],
});

const Break = new Schema({
  allowed_no_of_breaks: {
    type: Number,
    default: 4,
  },
  minutes: {
    type: Number,
    default: 120,
  },
});

const Resources = new Schema({
  name: {
    type: String,
    required: [true, 'Name  is  required'],
  },
  type: {
    type: String,
    required: [true, 'Type  is  required'],
  },
  url: {
    type: String,
    required: [false, 'URl is optional'],
  },
});

const Configuration = new Schema(
  {
    organization: {
      type: String,
      default: 'DEFAULT',
    },
    department: {
      type: String,
      default: 'DEFAULT',
    },
    intrusiveness_level: {
      type: String,
      default: 'LOW',
    },
    //Backward Compatibility begins
    last_activity_update_interval: {
      type: Number,
      default: 10,
    },
    photo_sync_interval: {
      type: Number,
      default: 10,
    },
    screenshot_sync_interval: {
      type: Number,
      default: 10,
    },
    //Till Here Backward Compatibility
    productivity: productivity,
    basic_activity: [basic_activity],
    screen_grab: screen_grab,
    screen_recording: screen_recording,
    screen_streaming: screen_streaming,
    ai_detections: [ai],
    breaks: [Break],
    resources: [Resources],
    agent_current_version: {
      type: String,
    },
    agent_backward_compatibility: {
      type: String,
    },
    low_range_risky_user: {
      type: Number,
    },
    high_range_risky_user: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Configuration', Configuration);
