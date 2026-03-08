// Vercel serverless entry point — wraps the Express app.
// All /api/* requests are routed here by vercel.json rewrites.
const app = require('../server/src/app');

module.exports = app;
