const express = require('express');
const router = express.Router();
const controller = require('../controllers/highlights.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * Highlight annotation routes
 *
 * GET    /api/highlights?documentId=<file_path>
 *   Returns all highlights + threaded comments for a document.
 *
 * POST   /api/highlights
 *   Creates a new highlight (with optional initial comment).
 *
 * DELETE /api/highlights/:id
 *   Deletes a highlight and all its comments (creator or admin only).
 *
 * POST   /api/highlights/:id/comments
 *   Adds a reply to a highlight thread.
 *
 * DELETE /api/highlights/:highlightId/comments/:commentId
 *   Deletes a single reply (author or admin only).
 */

router.get('/', authenticate, controller.getHighlights);
router.post('/', authenticate, controller.createHighlight);
router.delete('/:id', authenticate, controller.deleteHighlight);
router.post('/:id/comments', authenticate, controller.addHighlightComment);
router.delete('/:highlightId/comments/:commentId', authenticate, controller.deleteHighlightComment);

module.exports = router;
