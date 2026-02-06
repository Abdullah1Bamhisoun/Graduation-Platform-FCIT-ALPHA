const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
