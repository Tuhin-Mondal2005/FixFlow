'use strict';

const mongoose = require('mongoose');
const env = require('./env');

async function connectDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  // eslint-disable-next-line no-console
  console.log(`[db] MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
  return mongoose.connection;
}

module.exports = connectDB;
