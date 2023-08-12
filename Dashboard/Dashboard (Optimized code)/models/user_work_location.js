let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let UserWorkLocation = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'User Email is  required'],
    },
    organization: {
      type: String,
      required: [true, 'Organization  is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department  is required'],
    },
    assigned_to: {
      type: String,
      required: [true, 'assigned to  is required'],
    },
    work_location: {
      type: String,
      required: [true, 'Work location is required'],
    },
    location_update_counter: {
      type: Number,
      required: [false, 'location update counter is required'],
    },
    date: {
      type: Date,
      required: [true, 'date is required'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'UserWorkLocation',
  UserWorkLocation,
  'user_work_location'
);
