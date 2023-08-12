let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var Category = new Schema(
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
    name: {
      type: String,
    },
    course_category: {
      type: String,
      default: 'Sample',
    },
    code: {
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Category', Category);
