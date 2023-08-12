let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const Task_Project = new Schema(
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
    project_name: {
      type: String,
    },
    description: {
      type: String,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    name: {
      type: String,
    },
    project_id: {
      type: String,
    },
    project_visibility: {
      type: String,
      enum: ['PRIVATE', 'PUBLIC'],
    },
    private_type: {
      type: String,
    },
    assigned_members: [
      {
        assigned_to_member: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task_Project', Task_Project);
