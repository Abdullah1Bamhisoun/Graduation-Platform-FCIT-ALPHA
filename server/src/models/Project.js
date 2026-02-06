const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
