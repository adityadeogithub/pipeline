let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Member = new Schema({
  user_email: {
    type: String,
  },
});

const Interest_And_Hobbies = new Schema({
  name: {
    type: String,
  },
});

const Skills = new Schema({
  skill_name: {
    type: String,
  },
  rating: {
    type: Number,
  },
});

const PasswordArr = new Schema({
  password: {
    type: String,
  },
});

const User = new Schema(
  {
    user_name: {
      type: String,
      required: [false, 'User Name is  required'],
    },
    user_email: {
      type: String,
      required: [true, 'User Email is  required'],
    },
    uid: {
      type: String,
    },
    first_name: {
      type: String,
      default: 'Not Updated',
      required: [false, 'First name is  required'],
    },
    last_name: {
      type: String,
      default: 'Not Updated',
      required: [false, 'Last name is  required'],
    },
    gender: {
      type: String,
      required: [false, 'Gender is  required'],
    },

    phone: {
      type: String,
      required: [false, 'Phone is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },
    password: {
      type: String,
      required: [true, 'Password is  required'],
    },
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    created_on: {
      type: Date,
      required: [true, 'Created On is  required'],
    },
    updated_on: {
      type: Date,
      required: [true, 'Updated On is  required'],
    },
    is_superadmin: {
      type: Boolean,
      required: [true, 'Super Admin is  required'],
    },
    is_admin: {
      type: Boolean,
      required: [true, 'Admin is  required'],
    },
    is_auditor: {
      type: Boolean,
      required: [true, 'Auditor is  required'],
    },
    is_super_audit: {
      type: Boolean,
      default: false,
    },
    is_manager: {
      type: Boolean,
      required: [true, 'Manager is  required'],
    },
    is_member: {
      type: Boolean,
      required: [true, 'Member  is  required'],
    },
    is_client: {
      type: Boolean,
    },
    is_report_manager: {
      type: Boolean,
      default: false,
    },
    //Parent
    assigned_to: {
      type: String,
      required: [false, 'Assigned to is optional'],
    },
    assigned_to_email: {
      type: String,
    },
    face_id: {
      type: String,
      required: [false, 'Face Id is optional'],
    },
    photo_url: {
      type: String,
      required: [false, 'Photo url is optional'],
    },
    subordinates: [Member],
    managers: [Member],
    password_arr: [PasswordArr],
    time_zone: {
      type: String,
      default: 'Asia/Calcutta',
    },
    login_counter: {
      type: Number,
    },
    force_update_status: {
      type: Boolean,
      required: [true, 'Force update status is required'],
    },
    web_access_time: {
      type: Date,
      required: [false, 'Web access time  optional'],
    },
    app_access_time: {
      type: Date,
      required: [false, 'App access time  optional'],
    },
    is_web_login: {
      type: Boolean,
      required: [false],
    },
    is_agent_login: {
      type: Boolean,
      required: [false],
    },
    face_auth_status: {
      type: String,
    },
    email_auth_status: {
      type: String,
    },
    web_login_confidence: {
      type: Number,
    },
    app_login_confidence: {
      type: Number,
    },
    is_system_manager: {
      type: Boolean,
    },
    push_device_token: {
      type: String,
    },
    debug_mode: {
      type: Boolean,
      default: false,
    },
    screenshot: {
      type: Boolean,
      default: false,
    },
    city: {
      type: String,
    },
    is_licensed: {
      type: Boolean,
      default: true,
    },
    uuid: {
      type: String,
    },
    country: {
      type: String,
    },
    countryCode: {
      type: String,
    },
    address: {
      type: String,
    },
    registered_email: {
      type: String,
    },
    dob: {
      type: Date,
      default: '',
    },
    reset_password: {
      type: Boolean,
      default: false,
    },
    interest_and_hobbies: [Interest_And_Hobbies],
    skills: [Skills],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Users', User);
