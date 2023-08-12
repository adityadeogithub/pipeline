let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Module = new Schema({
  description: {
    type: String,
  },
  name: {
    type: String,
  },
  url: {
    type: String,
  },
  star: {
    type: Boolean,
    default: false,
  },
});

const Category = new Schema(
  {
    category_name: {
      type: String,
    },
    reports: [Module],
  },
  {
    timestamps: true,
  }
);

const ReportCategory = new Schema(
  {
    user_email: {
      type: String,
    },
    assigned_to: {
      type: String,
    },
    organization: {
      type: String,
    },
    department: {
      type: String,
    },
    language: {
      type: String,
      default: 'es',
    },
    category: [Category],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ReportCategory', ReportCategory);
