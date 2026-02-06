const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
