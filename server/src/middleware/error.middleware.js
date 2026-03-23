/**
 * Global Express error handler.
 *
 * Rules:
 *  - 4xx errors (client mistakes): always return the message — it's safe and useful.
 *  - 5xx errors in production: return a generic message so internals never leak.
 *  - 5xx errors in development: include message + stack for fast debugging.
 *  - All 5xx errors are logged server-side with full context.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.statusCode || err.status || 500;
  const isProd  = process.env.NODE_ENV === 'production';
  const isClient = status >= 400 && status < 500;

  // Always log server errors with enough context to debug
  if (!isClient) {
    console.error('[ERROR]', {
      method:  req.method,
      path:    req.path,
      status,
      userId:  req.user?.id ?? 'unauthenticated',
      message: err.message,
      stack:   err.stack,
    });
  }

  const message = isClient
    ? err.message                                           // safe to expose
    : isProd
      ? 'An internal error occurred. Please try again.'    // hide internals
      : err.message;                                        // show in dev

  const body = { success: false, error: message };

  // In development, attach stack trace to the response for easier debugging
  if (!isProd && !isClient && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { errorHandler };
