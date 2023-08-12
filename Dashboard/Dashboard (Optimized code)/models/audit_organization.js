let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const department = new Schema({
  name: {
    type: String,
  },
});

const organization = new Schema({
  name: {
    type: String,
    required: [true, 'Organization  is required'],
  },
  departments: [department],
});

var audit_Organization = new Schema(
  {
    user_email: {
      type: String,
      required: [true, 'Admin user email is required'],
    },
    organization_array: [organization],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('audit_Organization', audit_Organization);
