const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
