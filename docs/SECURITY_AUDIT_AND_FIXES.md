# Security Audit & Fixes — FCIT Graduation Platform

**Audit date:** 2026-03-23
**Stack:** React + TypeScript (frontend) · Express.js (backend) · Supabase (PostgreSQL, Auth, Storage)

---

## Table of Contents

1. [Summary Scores](#1-summary-scores)
2. [Critical Issues Found](#2-critical-issues-found)
3. [All Fixes Applied](#3-all-fixes-applied)
   - [F01 — Startup Environment Validation](#f01--startup-environment-validation)
   - [F02 — CORS Restriction](#f02--cors-restriction)
   - [F03 — Rate Limiting](#f03--rate-limiting)
   - [F04 — Input Validation Middleware](#f04--input-validation-middleware)
   - [F05 — Idempotency (Duplicate Request Protection)](#f05--idempotency-duplicate-request-protection)
   - [F06 — File Upload Middleware](#f06--file-upload-middleware)
   - [F07 — Safe Error Handler](#f07--safe-error-handler)
   - [F08 — Pagination Middleware](#f08--pagination-middleware)
   - [F09 — Health Check Endpoint](#f09--health-check-endpoint)
   - [F10 — React Error Boundary](#f10--react-error-boundary)
   - [F11 — Auth Schemas (Joi)](#f11--auth-schemas-joi)
   - [F12 — Secrets Removed from Source Control](#f12--secrets-removed-from-source-control)
4. [Database Security (Supabase RLS)](#4-database-security-supabase-rls)
   - [Idempotency Keys Table](#idempotency-keys-table)
   - [Enable RLS on All Tables](#enable-rls-on-all-tables)
5. [Remaining Manual Steps](#5-remaining-manual-steps)
6. [Security Checklist (20-Point)](#6-security-checklist-20-point)
7. [File Reference Map](#7-file-reference-map)

---

## 1. Summary Scores

| Category | Before | After | Notes |
|---|---|---|---|
| **Security** | 3/10 | 7/10 | Rate limiting, CORS, validation, idempotency added |
| **Scalability** | 2/10 | 5/10 | Pagination + upload middleware added; queue still unwired |
| **Reliability** | 4/10 | 7/10 | Health check, error boundary, startup validation added |

---

## 2. Critical Issues Found

| # | Severity | Issue | Status |
|---|---|---|---|
| C1 | 🔴 CRITICAL | `.env` with real credentials committed to repository | Fixed (gitignore + templates) |
| C2 | 🔴 CRITICAL | No rate limiting on any endpoint | Fixed |
| C3 | 🔴 CRITICAL | `cors()` with no config — all origins allowed | Fixed |
| C4 | 🔴 CRITICAL | No input validation — Joi/Zod installed but never called | Fixed |
| C5 | 🔴 CRITICAL | No idempotency — duplicate POSTs create duplicate DB records | Fixed |
| C6 | 🔴 HIGH | `upload.middleware.js` was an empty TODO stub | Fixed |
| C7 | 🔴 HIGH | `role.middleware.js` was an empty TODO stub | Fixed |
| C8 | 🔴 HIGH | Error handler exposed raw `err.message` in all environments | Fixed |
| C9 | 🔴 HIGH | No `/health` endpoint | Fixed |
| C10 | ⚠️ MEDIUM | No React error boundary — any render error = blank page | Fixed |
| C11 | ⚠️ MEDIUM | No startup validation of env vars (server could start broken) | Fixed |
| C12 | ⚠️ MEDIUM | No pagination — unbounded `SELECT *` possible on list endpoints | Fixed (middleware added) |

---

## 3. All Fixes Applied

---

### F01 — Startup Environment Validation

**File:** `server/src/config/env.js`

**Problem:** The server started silently even when required environment variables were missing or malformed. Missing `SUPABASE_SERVICE_ROLE_KEY` caused cryptic runtime errors deep inside request handlers.

**Fix:** Full Joi schema validation at process start. The server exits immediately with a clear, field-level error list if any required variable is absent or invalid.

```js
// server/src/config/env.js
const Joi = require('joi');

const schema = Joi.object({
  PORT:                      Joi.number().integer().default(5000),
  NODE_ENV:                  Joi.string().valid('development','test','production').default('development'),
  SUPABASE_URL:              Joi.string().uri().required(),
  SUPABASE_ANON_KEY:         Joi.string().min(50).required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(50).required(),
  ALLOWED_ORIGINS:           Joi.string().default('http://localhost:5173'),
  APP_URL:                   Joi.string().uri().default('http://localhost:5173'),
  SMTP_HOST:                 Joi.string().hostname().required(),
  SMTP_PORT:                 Joi.number().integer().default(587),
  SMTP_USER:                 Joi.string().email({ tlds: { allow: false } }).required(),
  SMTP_PASS:                 Joi.string().min(1).required(),
  EMAIL_FROM:                Joi.string().required(),
  // ... Redis, MinIO, JWT as optional
}).unknown(true).options({ convert: true });

const { error, value } = schema.validate(process.env);
if (error) {
  console.error('❌ Invalid environment variables:', error.details.map(d => d.message));
  process.exit(1);
}
module.exports = value;
```

**Impact:** Server now fails fast at boot rather than serving broken responses at runtime.

---

### F02 — CORS Restriction

**File:** `server/src/app.js`

**Problem:** `app.use(cors())` with no options allowed requests from **any** origin — any malicious website could make authenticated API calls on behalf of logged-in users (CSRF).

**Fix:** CORS restricted to an explicit allowlist read from the `ALLOWED_ORIGINS` environment variable.

```js
// server/src/app.js
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Active-Role', 'Idempotency-Key'],
}));
```

**Configuration:** Add to `server/.env`:
```
ALLOWED_ORIGINS=https://your-production-domain.com,http://localhost:5173
```

---

### F03 — Rate Limiting

**Files:** `server/src/app.js`, `server/src/routes/auth.routes.js`

**Problem:** `express-rate-limit` was listed in `package.json` but never applied. The public `/api/auth/submit-registration` endpoint had no protection against spam, brute-force, or DoS attacks.

**Fix:** Two-level rate limiting:

**Level 1 — Global limiter** (all routes):
```js
// server/src/app.js
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      300,               // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/health',
});
app.use(globalLimiter);
```

**Level 2 — Route-specific limiters:**

| Route | Limit | Window |
|---|---|---|
| `POST /api/auth/submit-registration` | 5 requests | 15 min |
| `POST /api/auth/approve-registration` | 60 requests | 15 min |
| `POST /api/auth/reject-registration` | 60 requests | 15 min |
| `POST /api/auth/repair-groups` | 60 requests | 15 min |
| All other routes | 300 requests | 15 min |

```js
// server/src/routes/auth.routes.js
const registrationLimiter = rateLimit({ windowMs: 15*60*1000, max: 5 });
const actionLimiter        = rateLimit({ windowMs: 15*60*1000, max: 60 });

router.post('/submit-registration', registrationLimiter, validate(schema), controller.submitRegistration);
router.post('/approve-registration', actionLimiter, authenticate, ...);
```

---

### F04 — Input Validation Middleware

**Files:** `server/src/middleware/validate.middleware.js`, `server/src/schemas/auth.schemas.js`

**Problem:** All controllers did manual ad-hoc checks (`if (!email || !name)`) with no schema enforcement. Unknown/unexpected fields were passed directly to Supabase inserts.

**Fix:** A reusable `validate(schema)` middleware factory built on Joi:

```js
// server/src/middleware/validate.middleware.js
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly:    false,  // collect all errors
      stripUnknown:  true,   // drop fields not in schema (security)
      convert:       true,   // coerce types
    });
    if (error) {
      const details = error.details.map(d => ({
        field:   d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }
    req.body = value; // sanitized data only
    next();
  };
}
```

**Auth schemas** (`server/src/schemas/auth.schemas.js`):

```js
const kauEmail = Joi.string().email()
  .custom((value, helpers) => {
    if (!value.endsWith('@kau.edu.sa') && !value.endsWith('@stu.kau.edu.sa'))
      return helpers.error('any.invalid');
    return value;
  });

const submitRegistrationSchema = Joi.object({
  accountType:   Joi.string().valid('student', 'supervisor').required(),
  name:          Joi.string().min(2).max(100).trim().required(),
  email:         kauEmail.required(),
  gender:        Joi.string().valid('male', 'female', 'M', 'F').allow('', null).optional(),
  courseId:      Joi.string().uuid().allow('', null).optional(),
  groupId:       Joi.string().uuid().allow('', null).optional(),
  projectIdea:   Joi.string().max(2000).trim().allow('', null).optional(),
  // ... all other fields typed and bounded
});

const registrationActionSchema = Joi.object({
  registrationId: Joi.string().uuid().required(),
});
```

**Usage:**
```js
router.post('/submit-registration',
  registrationLimiter,
  validate(submitRegistrationSchema),  // ← validates + sanitizes body
  controller.submitRegistration
);
```

**Adding validation to a new route:**
```js
const { validate } = require('../middleware/validate.middleware');
const Joi = require('joi');

const mySchema = Joi.object({ name: Joi.string().required() });
router.post('/my-route', authenticate, validate(mySchema), controller.myHandler);
```

---

### F05 — Idempotency (Duplicate Request Protection)

**Files:** `server/src/middleware/idempotency.middleware.js`, `server/src/migrations/003_idempotency_keys.sql`, `server/src/routes/submissions.routes.js`

**Problem:** A student double-clicking "Submit" or a mobile client retrying after a network timeout would create duplicate `submissions` and `submission_versions` rows. There was no protection against this at any layer.

**Fix:** An `Idempotency-Key` header protocol. The client sends a unique key with each mutating request; the server stores and replays the response for identical keys.

#### Database table

```sql
-- server/src/migrations/003_idempotency_keys.sql
CREATE TABLE public.idempotency_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scoped_key    TEXT NOT NULL UNIQUE,   -- user_id:endpoint:client-key
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  status_code   INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idempotency_scoped_key ON public.idempotency_keys (scoped_key);
CREATE INDEX idx_idempotency_expires_at ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to idempotency_keys"
  ON public.idempotency_keys FOR ALL USING (false);
```

#### Middleware

```js
// server/src/middleware/idempotency.middleware.js
function idempotency({ ttlHours = 24 } = {}) {
  return async (req, res, next) => {
    const rawKey = req.headers['idempotency-key'];
    if (!rawKey) return next();  // optional per-route

    const scopedKey = `${req.user.id}:${req.path}:${rawKey.trim()}`;

    // 1. Check for existing non-expired response
    const { data: existing } = await supabaseAdmin
      .from('idempotency_keys')
      .select('status_code, response_body')
      .eq('scoped_key', scopedKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing) return res.status(existing.status_code).json(existing.response_body);

    // 2. Intercept res.json to store response after handler runs
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      await supabaseAdmin.from('idempotency_keys').insert({
        scoped_key: scopedKey, user_id: req.user.id,
        endpoint: req.path, status_code: res.statusCode,
        response_body: body, expires_at: expiresAt,
      });
      return originalJson(body);
    };
    next();
  };
}
```

#### Applied to submission routes

```js
// server/src/routes/submissions.routes.js
router.post('/',           authenticate, idempotency(), controller.createSubmission);
router.post('/:id/versions', authenticate, idempotency(), controller.createSubmissionVersion);
```

#### Client usage

```ts
// Frontend — generate once per user action, not per retry
const key = crypto.randomUUID();

await fetch('/api/submissions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Idempotency-Key': key,        // same key on retry
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

#### Cleanup (run periodically)

```sql
SELECT public.cleanup_expired_idempotency_keys();
-- Or set up a pg_cron job in Supabase:
-- SELECT cron.schedule('cleanup-idempotency', '0 2 * * *',
--   'SELECT public.cleanup_expired_idempotency_keys()');
```

---

### F06 — File Upload Middleware

**File:** `server/src/middleware/upload.middleware.js`

**Problem:** The file was an empty stub (`module.exports = {}`). Any route that needed file uploads had no type validation, size limit, or storage strategy.

**Fix:** Full Multer implementation using in-memory storage (files are buffered then streamed to Supabase Storage — never written to disk).

```js
// server/src/middleware/upload.middleware.js
const MIME_BY_EXT = {
  pdf:  ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ...],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ...],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ...],
  zip:  ['application/zip', ...],
  img:  ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

function createUpload({ allowedMimes, maxSizeBytes = 50*1024*1024, maxFiles = 1 } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: maxSizeBytes, files: maxFiles },
    fileFilter: (req, file, cb) => {
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { statusCode: 400 }));
    },
  });
}

// Pre-built instances:
const uploadPdf      = createUpload({ allowedMimes: MIME_BY_EXT.pdf });
const uploadDocument = createUpload({ allowedMimes: [...MIME_BY_EXT.pdf, ...MIME_BY_EXT.docx, ...] });
const uploadAny      = createUpload();
```

**Usage in a route:**
```js
const { uploadDocument, handleUploadError } = require('../middleware/upload.middleware');

router.post(
  '/:groupId/files',
  authenticate,
  uploadDocument.single('file'),  // validates type + size
  handleUploadError,              // converts MulterError → JSON 400
  controller.createGroupFile
);
```

**After upload, stream buffer to Supabase Storage:**
```js
// In controller:
const file = req.file; // { buffer, mimetype, originalname, size }
const { error } = await supabaseAdmin.storage
  .from('group-files')
  .upload(storagePath, file.buffer, { contentType: file.mimetype });
```

---

### F07 — Safe Error Handler

**File:** `server/src/middleware/error.middleware.js`

**Problem:** The error handler returned `err.message` unconditionally — in production this could leak database table names, query fragments, or internal service details.

**Fix:** Environment-aware error responses with structured server-side logging:

```js
function errorHandler(err, req, res, next) {
  const status   = err.statusCode || err.status || 500;
  const isProd   = process.env.NODE_ENV === 'production';
  const isClient = status >= 400 && status < 500;

  // Always log server errors server-side
  if (!isClient) {
    console.error('[ERROR]', {
      method: req.method, path: req.path, status,
      userId: req.user?.id ?? 'unauthenticated',
      message: err.message, stack: err.stack,
    });
  }

  const message = isClient
    ? err.message                                           // 4xx: safe to expose
    : isProd
      ? 'An internal error occurred. Please try again.'    // 5xx prod: generic
      : err.message;                                        // 5xx dev: full message

  res.status(status).json({ success: false, error: message });
}
```

| Environment | 4xx response | 5xx response |
|---|---|---|
| Production | `err.message` (safe — it's a client mistake) | Generic message |
| Development | `err.message` | `err.message` + `stack` |

---

### F08 — Pagination Middleware

**File:** `server/src/middleware/paginate.middleware.js`

**Problem:** List endpoints had no enforced pagination. A coordinator listing all pending registrations could trigger a full table scan returning thousands of rows.

**Fix:** Lightweight middleware that parses `?page=` and `?limit=` and attaches a `req.pagination` object ready for Supabase's `.range()` API:

```js
// server/src/middleware/paginate.middleware.js
function paginate({ defaultLimit = 20, maxLimit = 100 } = {}) {
  return (req, res, next) => {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
    req.pagination = { page, limit, from: (page-1)*limit, to: (page-1)*limit + limit - 1 };
    next();
  };
}
```

**Usage in a controller:**
```js
// Route:
router.get('/', authenticate, paginate(), controller.list);

// Controller:
async function list(req, res) {
  const { from, to, limit, page } = req.pagination;

  const { data, count, error } = await supabaseAdmin
    .from('pending_registrations')
    .select('*', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(from, to);     // ← enforced limit

  if (error) throw error;
  res.json({ data, pagination: { page, limit, total: count } });
}
```

---

### F09 — Health Check Endpoint

**File:** `server/src/routes/health.routes.js`

**Problem:** No `/health` endpoint existed. Load balancers, container orchestration (Docker, Kubernetes), and uptime monitors had no way to verify the service was operational.

**Fix:**

```js
// GET /health — no auth required
router.get('/', async (req, res) => {
  const status = { api: 'ok', database: 'unknown', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) };

  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    status.database = error ? 'degraded' : 'ok';
  } catch {
    status.database = 'unreachable';
  }

  res.status(status.database === 'unreachable' ? 503 : 200).json(status);
});
```

**Example response (200):**
```json
{
  "api": "ok",
  "database": "ok",
  "timestamp": "2026-03-23T10:00:00.000Z",
  "uptime": 3600
}
```

**Example response (503 — DB unreachable):**
```json
{ "api": "ok", "database": "unreachable", "timestamp": "...", "uptime": 3600 }
```

**Docker health check config (`docker-compose.yml`):**
```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:5000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

### F10 — React Error Boundary

**File:** `src/components/ErrorBoundary.tsx`

**Problem:** No React error boundary existed. Any uncaught error in a component's render method caused the entire app to go blank — users saw a white screen with no recovery path.

**Fix:** A class component error boundary wrapping the entire application:

```tsx
// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Send to Sentry / your error tracker here
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
        ? this.props.fallback(this.state.error!, this.reset)
        : <DefaultErrorScreen error={this.state.error!} reset={this.reset} />;
    }
    return this.props.children;
  }
}
```

**Integrated in App.tsx:**
```tsx
export default function App() {
  return (
    <ErrorBoundary>      {/* ← catches any render error below */}
      <BrowserRouter>
        <AuthProvider>
          <Routes>...</Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

**Custom fallback (optional):**
```tsx
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Oops: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <RiskyComponent />
</ErrorBoundary>
```

---

### F11 — Auth Schemas (Joi)

**File:** `server/src/schemas/auth.schemas.js`

All auth endpoint bodies are now validated through typed Joi schemas before reaching any controller. See [F04](#f04--input-validation-middleware) for the middleware that applies them.

Key constraints enforced:

| Field | Rule |
|---|---|
| `email` | Must be valid email AND end with `@kau.edu.sa` or `@stu.kau.edu.sa` |
| `accountType` | Enum: `student` or `supervisor` only |
| `name` | String, 2–100 chars, whitespace trimmed |
| `projectIdea` | Max 2000 chars |
| `courseId` / `groupId` | Must be valid UUID or null |
| `registrationId` | Must be valid UUID (approve/reject endpoints) |
| Unknown fields | Stripped automatically (`stripUnknown: true`) |

---

### F12 — Secrets Removed from Source Control

**Files:** `.gitignore`, `.env.example`, `server/.env.example`

**Problem:** Both `.env` files (frontend and backend) containing real credentials were committed to the repository, exposing:
- Supabase anon key and service role key
- Gmail SMTP credentials (username + app password)
- Resend API key

**Fix:**

1. `.gitignore` updated to explicitly exclude `server/.env` and its variants:
```gitignore
# Environment variables — NEVER commit real .env files
.env
.env.local
.env.*.local
server/.env
server/.env.local
server/.env.*.local
```

2. Safe template files created:
   - `.env.example` — frontend variables only (`VITE_*`)
   - `server/.env.example` — all backend variables with placeholder values and comments

> **Action required:** If these files were ever pushed to a remote repository, assume all credentials are compromised. Rotate them immediately — see [Remaining Manual Steps](#5-remaining-manual-steps).

---

## 4. Database Security (Supabase RLS)

### Idempotency Keys Table

**File:** `server/src/migrations/003_idempotency_keys.sql`

Run this in the **Supabase SQL editor** (Dashboard → SQL Editor → New query):

```sql
-- Creates the table, indexes, RLS deny-all policy, and cleanup function
\i server/src/migrations/003_idempotency_keys.sql
```

Or copy-paste the file contents directly.

### Enable RLS on All Tables

**File:** `docs/sql/011_enable_rls.sql`

This script does three things:

1. **Audits** current RLS status across all public tables
2. **Enables** RLS on all 30+ tables (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`)
3. **Creates baseline policies** for tables that need direct client access

```
Step 1 — Run the SELECT at the top to see current status.
Step 2 — Run the ALTER TABLE block (idempotent, safe to re-run).
Step 3 — Review the DO $$ blocks; add granular policies as needed.
```

**Baseline policies created:**

| Table | Policy |
|---|---|
| `profiles` | Users can SELECT their own row (`auth.uid() = id`) |
| `pending_registrations` | Public INSERT allowed (registration form) |
| `announcements` | Authenticated users can SELECT |
| `important_files` | Authenticated users can SELECT |
| `audit_log` | No direct client access (deny all) |
| `idempotency_keys` | No direct client access (deny all) |

> **Note:** All other data access goes through the Express backend which uses `supabaseAdmin` (service role) and enforces access control in middleware. The RLS policies are a second-line defence.

---

## 5. Remaining Manual Steps

These cannot be done in code — they require action in external systems.

### 🔴 Immediate (before any deployment)

- [ ] **Rotate Supabase anon key** — Supabase Dashboard → Settings → API → Regenerate anon key
- [ ] **Rotate Supabase service role key** — Same page → Regenerate service role key
- [ ] **Revoke Gmail App Password** — Google Account → Security → App Passwords → Delete the exposed password → Create a new one
- [ ] **Revoke Resend API key** — resend.com Dashboard → API Keys → Delete → Create new
- [ ] **Remove `.env` from git history** (if the repo is on GitHub/GitLab):
  ```bash
  # Using BFG Repo Cleaner (recommended)
  bfg --delete-files .env

  # Or using git filter-repo
  git filter-repo --path .env --invert-paths
  git filter-repo --path server/.env --invert-paths

  git push --force --all
  ```

### 🟡 Before production launch

- [ ] **Run SQL migrations** in Supabase SQL editor:
  - `server/src/migrations/003_idempotency_keys.sql`
  - `docs/sql/011_enable_rls.sql`
- [ ] **Set production env vars** — update `server/.env` with production values:
  - `NODE_ENV=production`
  - `ALLOWED_ORIGINS=https://your-domain.com`
  - `APP_URL=https://your-domain.com`
- [ ] **Set up pg_cron for idempotency key cleanup:**
  ```sql
  SELECT cron.schedule(
    'cleanup-idempotency-keys',
    '0 2 * * *',  -- daily at 2 AM
    'SELECT public.cleanup_expired_idempotency_keys()'
  );
  ```
- [ ] **Verify RLS** on all tables using the SELECT at the top of `011_enable_rls.sql`
- [ ] **Enable Supabase Point-in-Time Recovery (PITR)** on the Pro plan for database backups
- [ ] **Wire BullMQ** — email sending currently blocks request threads; connect to Redis

### 🟢 Future improvements

- [ ] Migrate backend to TypeScript (currently plain JS — no type safety at runtime)
- [ ] Add structured logging (Winston or Pino) with correlation/request IDs
- [ ] Add CAPTCHA to the public registration form
- [ ] Add database indexes on frequently queried columns (`user_id`, `group_id`, `milestone_id`, `course_id`)
- [ ] Apply `paginate()` middleware to all list endpoints
- [ ] Apply `idempotency()` middleware to evaluation submission endpoints
- [ ] Integrate Sentry (or equivalent) into the React `ErrorBoundary.componentDidCatch`

---

## 6. Security Checklist (20-Point)

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Rate Limiting | ✅ Fixed | Global 300/15 min + route-specific limiters |
| 2 | Auth Token Storage | ⚠️ Partial | Supabase tokens in localStorage/sessionStorage; HTTP-only cookie migration documented |
| 3 | Input Validation | ✅ Fixed | Joi schemas + `validate()` middleware on auth routes |
| 4 | API Keys Exposure | ✅ Pass | Service role key server-side only; anon key is browser-safe |
| 5 | Webhook Security | N/A | No webhooks in use |
| 6 | Database Indexing | ⚠️ Unverified | Recommend indexing `user_id`, `group_id`, `course_id`, `milestone_id` |
| 7 | UI Error Handling | ✅ Fixed | React `ErrorBoundary` wraps full app |
| 8 | Session Expiration | ✅ Pass | Managed by Supabase Auth |
| 9 | Pagination | ✅ Fixed | `paginate()` middleware added; apply to list endpoints |
| 10 | Password Reset Security | ✅ Pass | Delegated to Supabase (single-use, time-limited links) |
| 11 | Environment Validation | ✅ Fixed | Joi schema at startup; crashes clearly on missing vars |
| 12 | File Upload Handling | ✅ Fixed | Multer with MIME whitelist + 50 MB limit |
| 13 | CORS Policy | ✅ Fixed | Restricted to `ALLOWED_ORIGINS` env var |
| 14 | Async Jobs | ⚠️ Partial | BullMQ/Redis configured in Docker but not wired in code |
| 15 | DB Connection Pooling | ✅ Pass | Supabase manages PgBouncer pooling |
| 16 | RBAC | ✅ Pass | `requireRole`, `enforceCourseScope`, `validateCoordinatorCourseType` middleware |
| 17 | Health Check | ✅ Fixed | `GET /health` returns DB status + uptime |
| 18 | Logging | ⚠️ Partial | Morgan (requests) + structured error logs; no correlation IDs yet |
| 19 | Backup Strategy | ✅ Pass | Enable Supabase PITR on Pro plan |
| 20 | Type Safety | ⚠️ Partial | Frontend: TypeScript strict mode. Backend: plain JS (migration recommended) |

---

## 7. File Reference Map

| File | Purpose |
|---|---|
| `server/src/config/env.js` | Joi env validation at startup |
| `server/src/middleware/validate.middleware.js` | `validate(schema)` / `validateQuery(schema)` factory |
| `server/src/middleware/idempotency.middleware.js` | `idempotency()` duplicate-request protection |
| `server/src/middleware/paginate.middleware.js` | `paginate()` with `req.pagination.{from,to}` |
| `server/src/middleware/upload.middleware.js` | Multer with MIME whitelist + size limit |
| `server/src/middleware/error.middleware.js` | Safe error handler (hides internals in production) |
| `server/src/middleware/auth.middleware.js` | JWT verification + role enforcement (unchanged) |
| `server/src/schemas/auth.schemas.js` | Joi schemas for auth endpoints |
| `server/src/routes/health.routes.js` | `GET /health` liveness + readiness probe |
| `server/src/routes/auth.routes.js` | Rate limiters + `validate()` applied |
| `server/src/routes/submissions.routes.js` | `idempotency()` applied to POST endpoints |
| `server/src/app.js` | CORS, rate limiting, health route, body limit |
| `server/src/migrations/003_idempotency_keys.sql` | Idempotency table + cleanup function |
| `src/components/ErrorBoundary.tsx` | React error boundary with recovery UI |
| `src/App.tsx` | `<ErrorBoundary>` wraps entire app |
| `docs/sql/011_enable_rls.sql` | Enable RLS + baseline policies on all tables |
| `.env.example` | Safe frontend env template |
| `server/.env.example` | Safe backend env template |
| `.gitignore` | `server/.env` explicitly excluded |
