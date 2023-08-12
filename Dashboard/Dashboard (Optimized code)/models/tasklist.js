let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const TaskList = new Schema(
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
    task_status: {
      type: String,
    },
    order: {
      type: Number,
    },
    delete: {
      type: Boolean,
    },
    project_id: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TaskList', TaskList);
