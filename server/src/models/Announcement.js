const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
