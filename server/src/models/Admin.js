const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
