const express = require('express');
const router = express.Router();
const controller = require('../controllers/students.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

/**
 * GET /api/students/my-grades
 * Student-only (admin also allowed). Returns full grade data for the
 * logged-in student's own group. Backend enforces group resolution from identity.
 */
router.get('/my-grades', authenticate, requireRole(['student', 'admin']), controller.getMyGrades);

module.exports = router;
