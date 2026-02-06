const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);
