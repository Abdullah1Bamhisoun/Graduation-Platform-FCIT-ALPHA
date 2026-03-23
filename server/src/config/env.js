require('dotenv').config();
const Joi = require('joi');

const schema = Joi.object({
  // ── Server ────────────────────────────────────────────────────────────────
  PORT:     Joi.number().integer().min(1).max(65535).default(5000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  // ── Supabase (all required) ───────────────────────────────────────────────
  SUPABASE_URL:              Joi.string().uri().required(),
  SUPABASE_ANON_KEY:         Joi.string().min(50).required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(50).required(),

  // ── CORS ─────────────────────────────────────────────────────────────────
  // Comma-separated list of allowed origins, e.g. "https://app.example.com,http://localhost:5173"
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:5173'),

  // ── App URL (used in email links) ─────────────────────────────────────────
  APP_URL: Joi.string().uri().default('http://localhost:5173'),

  // ── Email / SMTP ─────────────────────────────────────────────────────────
  SMTP_HOST: Joi.string().hostname().required(),
  SMTP_PORT: Joi.number().integer().default(587),
  SMTP_USER: Joi.string().email({ tlds: { allow: false } }).required(),
  SMTP_PASS: Joi.string().min(1).required(),
  EMAIL_FROM: Joi.string().required(),

  // ── Redis (optional — used by BullMQ job queue) ───────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().default(6379),

  // ── MinIO (optional — used for file storage if enabled) ──────────────────
  MINIO_ENDPOINT:   Joi.string().optional().allow(''),
  MINIO_PORT:       Joi.number().integer().optional(),
  MINIO_ACCESS_KEY: Joi.string().optional().allow(''),
  MINIO_SECRET_KEY: Joi.string().optional().allow(''),
  MINIO_BUCKET:     Joi.string().optional().allow(''),
  MINIO_USE_SSL:    Joi.boolean().default(false),

  // ── JWT (kept for future use; Supabase currently manages tokens) ──────────
  JWT_SECRET:     Joi.string().min(32).optional().allow(''),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
})
  .unknown(true)  // allow OS/Node env vars (PATH, HOME, etc.)
  .options({ convert: true });

const { error, value } = schema.validate(process.env);

if (error) {
  // Print every failing field clearly before crashing — makes CI failures obvious
  const missing = error.details.map((d) => `  ✗ ${d.path.join('.')}: ${d.message}`).join('\n');
  console.error(`\n❌  Server cannot start — invalid environment variables:\n${missing}\n`);
  console.error('Copy server/.env.example → server/.env and fill in the required values.\n');
  process.exit(1);
}

module.exports = value;
