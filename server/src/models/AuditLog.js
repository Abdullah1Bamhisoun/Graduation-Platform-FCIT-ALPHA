const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
