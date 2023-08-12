const mongoose = require('mongoose');

const pointsSchema = new mongoose.Schema({
  breakTime: { type: Number, default: 0, required: true },
  utilizations: { type: Number, default: 0, required: true },
  attendance: { type: Number, default: 0, required: true },
  idleTime: { type: Number, default: 0, required: true },
  violations: { type: Number, default: 0, required: true },
});

const pointDistributionSchema = new mongoose.Schema(
  {
    user_email: {
      type: String,
      required: true,
    },
    assigned_to: {
      type: String,
      required: false,
    },
    denotation: {
      type: String,
      enum: ['STAR', 'BADGE', 'HEART', 'LIKE', 'HATS'],
      required: true,
    },
    organization: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    points: {
      type: pointsSchema,
      required: true,
    },
    total_points: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const pointDistribution = mongoose.model(
  'pointDistribution',
  pointDistributionSchema
);

module.exports = pointDistribution;
