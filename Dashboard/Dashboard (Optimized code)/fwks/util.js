let mongoose = require('mongoose');

function findUser(name, query, cb) {
  mongoose.connection.db.collection(name, function (err, collection) {
    collection.find(query).toArray(cb);
  });
}

module.exports = {
  findUser: findUser,
};
