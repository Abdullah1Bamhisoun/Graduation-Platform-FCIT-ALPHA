const Joi = require('joi');

/**
 * Returns Express middleware that validates req.body against a Joi schema.
 * On failure: 400 with structured field-level errors.
 * On success:  req.body is replaced with the sanitized/coerced value.
 *
 * Usage:
 *   const { validate } = require('../middleware/validate.middleware');
 *   const { mySchema }  = require('../schemas/my.schemas');
 *   router.post('/', validate(mySchema), controller.handler);
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // collect all errors, not just the first
      stripUnknown: true,  // drop fields not in schema (security)
      convert: true,       // coerce types (string → number, etc.)
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''), // remove Joi quote noise
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }

    req.body = value; // use sanitized data downstream
    next();
  };
}

/**
 * Validates req.query against a Joi schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return res.status(400).json({ error: 'Invalid query parameters', details });
    }

    req.query = value;
    next();
  };
}

module.exports = { validate, validateQuery };
