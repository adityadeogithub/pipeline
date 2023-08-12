let mongoose = require('mongoose');
let Schema = mongoose.Schema;

var DeviceInformation = new Schema(
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
    host_name: {
      type: String,
      required: [false, 'Host name is required'],
    },
    mac_address: {
      type: String,
      required: [false, 'Mac address is required'],
    },
    ip_address: {
      type: String,
      required: [false, 'Ip address is required'],
    },
    camera_status: {
      type: String,
      required: [false, 'Camera status is required'],
    },
    mic_status: {
      type: String,
      required: [false, 'Mic status is required'],
    },
    usb_port_status: {
      type: String,
      required: [false, 'Usb Port Status is required'],
    },
    agent_current_version: {
      type: String,
      required: [true, 'Agent current version is required'],
    },
    wifi_name: {
      type: String,
    },
    latitude: {
      type: String,
    },
    longitude: {
      type: String,
    },
    city: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeviceInformation', DeviceInformation);
