const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
