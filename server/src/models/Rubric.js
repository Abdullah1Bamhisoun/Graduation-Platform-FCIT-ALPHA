const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Rubric', rubricSchema);
