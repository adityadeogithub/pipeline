let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var Activities = new Schema(
  {
    color: {
      type: String,
      default: 'BLACK',
    },
    time: {
      type: Date,
    },
    activity: {
      type: String,
      required: [true, 'Activity is  required'],
    },
    type: {
      type: String,
    },
    thumbnail_photo_url: {
      type: String,
    },
    photo_url: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
var ActiveApp = new Schema(
  {
    startTime: {
      type: Date,
      required: [false, 'Start Time is  required'],
    },
    endTime: {
      type: Date,
      required: [false, 'End Time is  optional'],
    },
    name: {
      type: String,
      required: [false, 'Name is  required'],
    },
    isAuthorized: {
      type: String,
      required: [false, 'Is Authorized is  required'],
    },
    category: {
      type: String,
    },
    is_productive: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);
var VisitedWeb = new Schema(
  {
    startTime: {
      type: Date,
      required: [false, 'Start Time is  required'],
    },
    endTime: {
      type: Date,
      required: [false, 'End Time is  optional'],
    },
    name: {
      type: String,
      required: [false, 'Name is  required'],
    },
    isAuthorized: {
      type: String,
      required: [false, 'Is Authorized is  required'],
    },
    category: {
      type: String,
    },
    is_productive: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);
var Break = new Schema(
  {
    no_of_breaks: {
      type: Number,
      default: 0,
    },
    minutes: {
      type: Number,
      required: [true, 'Minutes is  required'],
    },
    color: {
      type: String,
      default: 'YELLOW',
    },
  },
  {
    timestamps: true,
  }
);

let Meeting = new Schema(
  {
    no_of_meetings: {
      type: Number,
      default: 0,
    },
    minutes: {
      type: Number,
      required: [true, 'Minutes is  required'],
    },
    color: {
      type: String,
      default: 'YELLOW',
    },
  },
  {
    timestamps: true,
  }
);

var Activity = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'User email is  required'],
    },
    assigned_to: {
      type: String,
      required: [true, 'Assigned to is required'],
    },
    assigned_to_name: {
      type: String,
    },
    loginTime: {
      type: Date,
      required: [true, 'Login time is  required'],
    },
    subsequentLoginTime: {
      type: Date,
      required: [true, 'Subsequent Login Time is  required'],
    },
    loginHoursNotToCalculate: {
      type: Boolean,
      default: false,
    },
    logoutTime: {
      type: Date,
    },
    systemLogoutTime: {
      type: Date,
    },
    lastSessionLogout: {
      type: Date,
    },
    loginHours: {
      type: Number,
      default: 0,
    },
    lastLoginTime: {
      type: Date,
    },
    isIdle: {
      type: Boolean,
      default: false,
    },
    isAuxManagement: {
      type: Boolean,
      default: false,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
    idleTime: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      required: [true, 'Date is  required'],
    },
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    latitude: {
      type: String,
    },
    longitude: {
      type: String,
    },
    forceLogout: {
      type: Boolean,
    },
    login_type: {
      type: String,
    },
    is_am_alive: {
      type: Date,
    },
    activities: [Activities],
    activeApps: [ActiveApp],
    visitedWeb: [VisitedWeb],
    breaks: [Break],
    meetings: [Meeting],
    name: {
      type: String,
    },
    auxCode: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Activity', Activity);
