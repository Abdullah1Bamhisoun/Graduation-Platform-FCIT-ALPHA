const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('FileVersion', fileVersionSchema);
