'use strict';

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true },
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Atomic sequence generator. First call returns start + 1 (request numbers start at 1001,
 * support tickets at 5001). Uses an aggregation-pipeline update so initialisation and
 * increment happen in ONE atomic operation (MongoDB >= 4.2).
 */
Counter.next = async function next(name, start = 1000) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    [{ $set: { seq: { $add: [{ $ifNull: ['$seq', start] }, 1] } } }],
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = Counter;
