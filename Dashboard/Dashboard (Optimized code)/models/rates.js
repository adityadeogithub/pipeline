let mongoose = require('mongoose');

let Schema = mongoose.Schema;

var Rates = new Schema(
  {
    rates: {
      type: Object,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Rates', Rates);
