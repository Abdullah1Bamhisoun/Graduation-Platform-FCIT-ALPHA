const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const groupsRoutes = require('./routes/groups.routes');
const projectsRoutes = require('./routes/projects.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const milestonesRoutes = require('./routes/milestones.routes');
const evaluationsRoutes = require('./routes/evaluations.routes');
const announcementsRoutes = require('./routes/announcements.routes');
const reportsRoutes = require('./routes/reports.routes');
const importantFilesRoutes = require('./routes/importantFiles.routes');
const calendarEventsRoutes = require('./routes/calendarEvents.routes');
const rolesRoutes = require('./routes/roles.routes');
const coursesRoutes = require('./routes/courses.routes');
const locksRoutes = require('./routes/locks.routes');
const settingsRoutes = require('./routes/settings.routes');
const weekStatusesRoutes = require('./routes/weekStatuses.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/important-files', importantFilesRoutes);
app.use('/api/calendar-events', calendarEventsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/locks', locksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/week-statuses', weekStatusesRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;
