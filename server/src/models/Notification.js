const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
