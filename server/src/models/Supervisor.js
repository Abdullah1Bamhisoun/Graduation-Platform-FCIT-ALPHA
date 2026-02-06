const mongoose = require('mongoose');

const supervisorSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Supervisor', supervisorSchema);
