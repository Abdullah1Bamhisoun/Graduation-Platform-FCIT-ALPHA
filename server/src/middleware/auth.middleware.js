const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Verify Supabase JWT, load full user profile + all roles from user_roles table.
 * Attaches req.user with:
 *   id, email, name, role (primary), roles[] (all), activeRole, coordinatorCourseId
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // 1. Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 2. Fetch base profile (use supabaseAdmin to bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // 3. Fetch all roles from user_roles (use supabaseAdmin to bypass RLS)
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('coordinator_course_id, roles(name)')
      .eq('user_id', user.id);

    const roles = (userRoles || []).map((ur) => ur.roles?.name).filter(Boolean);
    const allRoles = roles.length > 0 ? roles : [profile.role];

    // 4. Determine coordinatorCourseId
    //    Priority: user_roles.coordinator_course_id → profiles.coordinator_course_id → platform_locks
    //    (matches the same fallback chain used in the frontend AuthContext)
    const coordinatorEntry = (userRoles || []).find((ur) => ur.roles?.name === 'coordinator');
    let coordinatorCourseId = coordinatorEntry?.coordinator_course_id
      ?? profile.coordinator_course_id
      ?? null;

    // Fallback: check platform_locks (for coordinators assigned via the lock system)
    if (!coordinatorCourseId) {
      const { data: lockRow } = await supabaseAdmin
        .from('platform_locks')
        .select('entity_id')
        .eq('entity_type', 'coordinator_assignment')
        .eq('locked_by', user.id)
        .eq('is_locked', true)
        .limit(1)
        .maybeSingle();
      coordinatorCourseId = lockRow?.entity_id ?? null;
    }

    // 5. Determine active role
    //    Client sends X-Active-Role header when the user has switched roles.
    //    Validate it against the user's actual roles to prevent spoofing.
    const requestedRole = req.headers['x-active-role'];
    const activeRole =
      requestedRole && allRoles.includes(requestedRole)
        ? requestedRole
        : profile.role;

    // 6. Attach to request
    req.user = {
      id:                  profile.id,
      email:               profile.email,
      name:                profile.name,
      role:                profile.role,       // primary role (profiles table)
      roles:               allRoles,           // all roles (user_roles table)
      activeRole,                              // currently active role
      coordinatorCourseId,                     // null unless coordinator
      studentId:           profile.student_id,
      employeeNumber:      profile.employee_number,
      department:          profile.department,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Check if user has ALL required roles or at least one of the required roles.
 * @param {string|string[]} roles
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const hasAccess = allowed.some((r) => req.user.roles.includes(r));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

/** Admin-only shortcut */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/** Supervisor or admin shortcut */
function requireSupervisorOrAdmin(req, res, next) {
  return requireRole(['supervisor', 'admin'])(req, res, next);
}

/** Coordinator or admin shortcut */
function requireCoordinatorOrAdmin(req, res, next) {
  return requireRole(['coordinator', 'admin'])(req, res, next);
}

/**
 * Enforce that the coordinator's active course matches a specified field.
 * Must be used AFTER authenticate.
 * Usage: router.post('/', authenticate, requireCoordinatorOrAdmin, enforceCourseScope('course_id'));
 */
function enforceCourseScope(courseIdField = 'course_id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    // Admins bypass course scope
    if (req.user.roles.includes('admin')) return next();

    if (req.user.activeRole !== 'coordinator') {
      return res.status(403).json({ error: 'Coordinator role required for this action' });
    }

    const requestedCourse =
      req.body?.[courseIdField] ||
      req.query?.[courseIdField] ||
      req.params?.[courseIdField];

    if (!req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'No course assigned to your coordinator account' });
    }

    if (requestedCourse && requestedCourse !== req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'Access denied: course scope mismatch' });
    }

    next();
  };
}

/** Optional authentication — doesn't fail if no token provided */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        const { data: userRoles } = await supabaseAdmin
          .from('user_roles')
          .select('coordinator_course_id, roles(name)')
          .eq('user_id', user.id);

        const roles = (userRoles || []).map((ur) => ur.roles?.name).filter(Boolean);

        req.user = {
          id:             profile.id,
          email:          profile.email,
          name:           profile.name,
          role:           profile.role,
          roles:          roles.length > 0 ? roles : [profile.role],
          activeRole:     profile.role,
          coordinatorCourseId: null,
          studentId:      profile.student_id,
          employeeNumber: profile.employee_number,
          department:     profile.department,
        };
      }
    }
    next();
  } catch {
    next(); // silently fail for optional auth
  }
}

/**
 * Validate that coordinator's assigned course matches the requested courseType.
 * Maps the coordinator's course UUID to courseType ('498' or '499') from the courses table.
 * Admins bypass this check.
 * Must be used AFTER authenticate.
 *
 * Usage: router.get('/coordinator-grades', authenticate, requireCoordinatorOrAdmin, validateCoordinatorCourseType)
 *
 * The courseType is expected to be in: req.query.courseType, req.body.courseType, or req.params.courseType
 */
async function validateCoordinatorCourseType(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins bypass this check
    if (req.user.roles.includes('admin')) {
      return next();
    }

    // Only applies to coordinators
    if (req.user.activeRole !== 'coordinator') {
      return res.status(403).json({ error: 'Coordinator role required' });
    }

    // Get requested courseType from query, body, or params
    const requestedCourseType =
      req.query?.courseType ||
      req.body?.courseType ||
      req.params?.courseType;

    if (!requestedCourseType) {
      return res.status(400).json({ error: 'courseType parameter required' });
    }

    // Validate courseType format
    if (!['498', '499'].includes(requestedCourseType)) {
      return res.status(400).json({ error: 'Invalid courseType. Must be 498 or 499' });
    }

    // Get coordinator's assigned course UUID
    if (!req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'No course assigned to your coordinator account' });
    }

    // Map coordinator's course UUID to courseType from courses table
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('code')
      .eq('id', req.user.coordinatorCourseId)
      .single();

    if (courseError || !course?.code) {
      console.error('Failed to fetch coordinator course:', courseError);
      return res.status(500).json({ error: 'Failed to verify course access' });
    }

    // Extract courseType from course code (e.g., "CPIS-498" → "498")
    const match = course.code.match(/(\d{3})$/);
    const assignedCourseType = match ? match[1] : null;

    if (!assignedCourseType) {
      console.error('Could not parse course code:', course.code);
      return res.status(500).json({ error: 'Invalid course code format' });
    }

    // Verify requested courseType matches assigned courseType
    if (requestedCourseType !== assignedCourseType) {
      return res.status(403).json({
        error: `Access denied. You are assigned to CPIS-${assignedCourseType}. Requested: CPIS-${requestedCourseType}`,
      });
    }

    // Attach to request for use in handlers
    req.coordinatorCourseType = assignedCourseType;

    next();
  } catch (error) {
    console.error('Course type validation error:', error);
    return res.status(500).json({ error: 'Course access validation failed' });
  }
}

module.exports = {
  authenticate,
  requireRole,
  requireAdmin,
  requireSupervisorOrAdmin,
  requireCoordinatorOrAdmin,
  enforceCourseScope,
  optionalAuth,
  validateCoordinatorCourseType,
};
