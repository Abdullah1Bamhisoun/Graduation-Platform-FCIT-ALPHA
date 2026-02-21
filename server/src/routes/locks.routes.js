const express = require('express');
const router = express.Router();
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { getLocks, setLock, removeLock } = require('../controllers/locks.controller');

// GET /api/locks — fetch all lock records
router.get('/', authenticate, requireCoordinatorOrAdmin, getLocks);

// POST /api/locks — create or update a lock
router.post('/', authenticate, requireCoordinatorOrAdmin, setLock);

// DELETE /api/locks/:entityType — remove a lock record
router.delete('/:entityType', authenticate, requireCoordinatorOrAdmin, removeLock);

module.exports = router;
