let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Management = new Schema({
  name: {
    type: String,
    default: 'Training',
  },
  camera_release: {
    type: Boolean,
    enum: [true, false],
    default: false,
  },
  duration: {
    type: Number,
    default: 10,
  },
  notification: {
    type: Boolean,
    default: false,
  },
});

const Aux_Management = new Schema(
  {
    organization: {
      type: String,
      required: [true, 'Organization is  required'],
    },
    department: {
      type: String,
      required: [true, 'Department is  required'],
    },

    management: [Management],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Aux_Management', Aux_Management);
