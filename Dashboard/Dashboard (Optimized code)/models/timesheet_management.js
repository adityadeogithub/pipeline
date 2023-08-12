let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var TimeSheetManagement = new Schema(
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
    assigned_to: {
      type: String,
    },
    price: {
      type: Number,
    },
    onboard_resource: {
      type: Boolean,
    },
    name: {
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TimeSheetManagement', TimeSheetManagement);
