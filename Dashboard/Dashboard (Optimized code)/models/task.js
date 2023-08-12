let mongoose = require('mongoose');
let Schema = mongoose.Schema;

const subTask = new Schema(
  {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    completionDate: {
      type: Date,
    },
    priority: {
      type: String,
      default: 'LOW',
    },
    assigned_to: {
      type: String,
    },
    subTaskUniqueID: {
      type: String,
      default: 'TC-sample',
    },
    subTask_status: {
      type: String,
      default: 'TO-DO',
    },
    subTask_dependency: {
      type: String,
    },
    subTask_dependency_title: {
      type: String,
    },
    subTask_progress: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Comment = new Schema(
  {
    member_email: {
      type: String,
    },
    message: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const InterimReview = new Schema(
  {
    date: {
      type: Date,
    },
    message: {
      type: String,
    },
    delayed: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const History = new Schema(
  {
    action_performed_by: {
      type: String,
    },
    message: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Task = new Schema(
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
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    start_time: {
      type: Date,
    },
    completion_date: {
      type: Date,
    },
    priority: {
      type: String,
      default: 'LOW',
    },
    assigned_members: [
      {
        assigned_to_member: {
          type: String,
        },
      },
    ],
    comment: [Comment],
    subTask: [subTask],
    history: [History],
    interimReview: [InterimReview],
    name: {
      type: String,
    },
    task_status: {
      type: String,
    },
    taskUniqueID: {
      type: String,
    },
    progress: {
      type: Number,
      default: 0,
    },
    attachment: [
      {
        file_path: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', Task);
