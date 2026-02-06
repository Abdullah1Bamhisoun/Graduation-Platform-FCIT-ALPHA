const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
