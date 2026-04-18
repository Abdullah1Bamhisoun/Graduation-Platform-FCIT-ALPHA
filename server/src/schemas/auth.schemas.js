const Joi = require('joi');

// KAU email validator — accepts both student and staff domains
const kauEmail = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .custom((value, helpers) => {
    if (!value.endsWith('@kau.edu.sa') && !value.endsWith('@stu.kau.edu.sa')) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({ 'any.invalid': 'Must be a valid KAU email address (@kau.edu.sa or @stu.kau.edu.sa)' });

/**
 * POST /api/auth/submit-registration
 */
const submitRegistrationSchema = Joi.object({
  accountType:           Joi.string().valid('student', 'supervisor').required(),
  name:                  Joi.string().min(2).max(100).trim().required(),
  email:                 kauEmail.required(),
  department:            Joi.string().min(1).max(100).trim().allow('', null).optional(),
  gender:                Joi.string().valid('male', 'female', 'M', 'F').allow('', null).optional(),
  studentId:             Joi.string().max(20).trim().allow('', null).optional(),
  course:                Joi.string().max(50).trim().allow('', null).optional(),
  courseId:              Joi.string().uuid().allow('', null).optional(),
  term:                  Joi.string().valid('First', 'Second').allow('', null).optional(),
  groupId:               Joi.string().uuid().allow('', null).optional(),
  projectName:           Joi.string().max(200).trim().allow('', null).optional(),
  projectIdea:           Joi.string().max(2000).trim().allow('', null).optional(),
  teammateSubmittedIdea: Joi.boolean().default(false),
  employeeNumber:        Joi.string().max(20).trim().allow('', null).optional(),
});

/**
 * POST /api/auth/approve-registration
 * POST /api/auth/reject-registration
 */
const registrationActionSchema = Joi.object({
  registrationId: Joi.string().uuid().required(),
});

module.exports = {
  submitRegistrationSchema,
  registrationActionSchema,
};
