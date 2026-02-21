const express = require('express');
const router = express.Router();
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const controller = require('../controllers/courses.controller');

// Public — registration form fetches active courses without auth
router.get('/active', controller.getActiveCourses);

// Admin or coordinator — full course list
router.get('/', authenticate, requireCoordinatorOrAdmin, controller.getAllCourses);

module.exports = router;
