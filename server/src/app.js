const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { errorHandler } = require('./middleware/error.middleware');

// Route imports
const healthRoutes         = require('./routes/health.routes');
const authRoutes           = require('./routes/auth.routes');
const usersRoutes          = require('./routes/users.routes');
const groupsRoutes         = require('./routes/groups.routes');
const projectsRoutes       = require('./routes/projects.routes');
const submissionsRoutes    = require('./routes/submissions.routes');
const milestonesRoutes     = require('./routes/milestones.routes');
const evaluationsRoutes    = require('./routes/evaluations.routes');
const announcementsRoutes  = require('./routes/announcements.routes');
const reportsRoutes        = require('./routes/reports.routes');
const importantFilesRoutes = require('./routes/importantFiles.routes');
const calendarEventsRoutes = require('./routes/calendarEvents.routes');
const rolesRoutes          = require('./routes/roles.routes');
const coursesRoutes        = require('./routes/courses.routes');
const locksRoutes          = require('./routes/locks.routes');
const settingsRoutes       = require('./routes/settings.routes');
const weekStatusesRoutes   = require('./routes/weekStatuses.routes');
const presentationsRoutes  = require('./routes/presentations.routes');
const gradingRoutes        = require('./routes/grading.routes');
const studentsRoutes       = require('./routes/students.routes');
const highlightsRoutes     = require('./routes/highlights.routes');
const groupFilesRoutes     = require('./routes/groupFiles.routes');

const app = express();

// ── Trust proxy (needed for rate-limiter behind Codespaces/VSCode forwarding) ─
app.set('trust proxy', 1);

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet());

// ── CORS — restrict to explicitly allowed origins ────────────────────────────
const rawOrigins    = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
const allowedOrigins = rawOrigins.map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (origin === undefined) and listed origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Active-Role', 'Idempotency-Key'],
}));

// ── Request logging ──────────────────────────────────────────────────────────
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));        // reject abnormally large JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Global rate limiter (protects every route) ───────────────────────────────
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,  // 15 minutes
  max:             300,              // 300 requests per window per IP
  standardHeaders: true,             // Return rate limit info in RateLimit-* headers
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Please slow down and try again later.' },
  skip: (req) => req.path === '/health', // health checks are exempt
});
app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check — no auth, no rate limit (excluded above)
app.use('/health', healthRoutes);

// API routes
app.use('/api/auth',            authRoutes);
app.use('/api/users',           usersRoutes);
app.use('/api/groups',          groupsRoutes);
app.use('/api/projects',        projectsRoutes);
app.use('/api/submissions',     submissionsRoutes);
app.use('/api/milestones',      milestonesRoutes);
app.use('/api/evaluations',     evaluationsRoutes);
app.use('/api/announcements',   announcementsRoutes);
app.use('/api/reports',         reportsRoutes);
app.use('/api/important-files', importantFilesRoutes);
app.use('/api/calendar-events', calendarEventsRoutes);
app.use('/api/roles',           rolesRoutes);
app.use('/api/courses',         coursesRoutes);
app.use('/api/locks',           locksRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/week-statuses',   weekStatusesRoutes);
app.use('/api/presentations',   presentationsRoutes);
app.use('/api/grading',         gradingRoutes);
app.use('/api/students',        studentsRoutes);
app.use('/api/highlights',      highlightsRoutes);
app.use('/api/groups',          groupFilesRoutes);

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
