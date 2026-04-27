# 1.6 Testing Chapter

---

## 1.6.1 Testing Strategy and Environment

### Overview

Testing the Graduation Project Platform (GPP) was conducted across multiple phases throughout the development lifecycle. Because the platform was built iteratively — adding features such as weekly reports, grading evaluations, meeting management, email notifications, and role-based dashboards in successive cycles — testing was performed continuously alongside development rather than as a single final phase. This reflects a practical agile testing approach suited to a student-led academic project with evolving requirements.

The testing strategy consisted of three complementary activities:

1. **Iterative development testing**: Each feature was manually exercised by the development team immediately after implementation. Test cases were not always formally documented at the time, but the outcomes are traceable through Git commit history, which records bug fixes, error corrections, and behavioral changes as they occurred. These are presented in this chapter as *reconstructed development test cases*.

2. **Verified functional testing**: Following feature completion, the live deployed platform was used to confirm that key user workflows operated correctly end-to-end. These are presented as *current verified test cases*.

3. **User Acceptance Testing (UAT)**: A set of real users — including students, supervisors, and coordinators — interacted with the platform during late-stage development and provided informal feedback on usability, missing functionality, and observed errors. Their feedback has been incorporated into the test record where relevant.

### Testing Environment

| Component | Configuration |
|---|---|
| **Frontend** | React 18 + Vite + TypeScript, running in both local development (localhost:5173) and production (hosted on Cloudflare Pages / Railway) |
| **Backend** | Node.js + Express.js server, hosted on Railway (Singapore region) |
| **Database** | Supabase PostgreSQL (ap-southeast-1, Singapore), with Row Level Security (RLS) enabled |
| **Authentication** | Supabase Auth (JWT-based sessions) |
| **Storage** | Supabase Storage for uploaded files |
| **Email Queue** | BullMQ backed by Redis (Docker Compose locally; Redis Cloud in production) |
| **Email Delivery** | Nodemailer with Gmail SMTP / Resend API |
| **Caching** | Redis (module-level TTL cache, 5-minute default) |
| **Browsers Tested** | Google Chrome 124, Microsoft Edge 124 |
| **Network** | Saudi Arabia (KSA) → Singapore server, approximately 320 ms base round-trip latency |

### Test Execution Methods

Tests were executed manually using the following tools:

- **Browser DevTools** (Network tab, Console) — to inspect API calls, response payloads, and JavaScript errors
- **Supabase SQL Editor** — to verify that Row Level Security policies applied correctly and that database records were written as expected
- **Supabase Dashboard (Table Editor)** — to confirm record creation, updates, and deletion
- **Git commit log** — to reconstruct the history of identified bugs and their resolutions
- **Redis CLI / BullMQ dashboard** — to verify that email jobs were enqueued and processed correctly
- **Email inbox inspection** — to confirm that notification emails arrived with correct content and formatting

No automated test framework (such as Jest, Cypress, or Playwright) was used during the current development cycle. This is acknowledged as a limitation and is discussed in Section 1.6.4.

---

## 1.6.2 Test Cases and Execution

### Table 1: Current Verified Test Cases

The following test cases were executed on the live deployed platform and represent verified functional behavior as of the final project submission. Each test case corresponds to a real feature that was confirmed to work correctly through manual testing.

| TC ID | FR ID | Module | Task | Input / Action | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|---|---|
| **TC-V01** | FR-001 | Authentication | Student login with KAU email | Enter valid `@stu.kau.edu.sa` email and correct password → click Login | Redirected to student dashboard; session established | User is authenticated and lands on student dashboard with name displayed in sidebar | **Pass** |
| **TC-V02** | FR-001 | Authentication | Login with non-KAU email | Enter a Gmail address and any password → click Login | Login rejected with appropriate error message | Server validates email domain; error message displayed, access denied | **Pass** |
| **TC-V03** | FR-001 | Authentication | Login with incorrect password | Enter valid KAU email with wrong password | Error message displayed; no access granted | Supabase Auth returns error; error shown to user on login page | **Pass** |
| **TC-V04** | FR-001 | Authentication | Idle auto-logout after inactivity | Leave browser idle for 30 minutes with no user interaction | System displays a 2-minute warning dialog, then logs the user out automatically | Warning dialog appears at 28 minutes; session is terminated at 30 minutes; user redirected to login page | **Pass** |
| **TC-V05** | FR-001 | Authentication | New user registration and approval flow | Student submits registration form → admin approves → student clicks confirmation email link | Account created; student can log in after approval | Registration appears in admin approval queue; approval sends confirmation email; student sees pending banner until approved | **Pass** |
| **TC-V06** | FR-002 | Dashboard | Student dashboard displays correct group data | Log in as a student assigned to a group | Dashboard shows group name, supervisor name, current milestone, and submission status | All group-specific data displayed correctly; KPI widgets render without errors | **Pass** |
| **TC-V07** | FR-002 | Dashboard | Admin dashboard KPI cards | Log in as admin; view dashboard | KPI cards show active projects, submission activity, review completion rate, and attention-needed groups | All cards load; "Last 30d / All Time" toggle switches data correctly | **Pass** |
| **TC-V08** | FR-002 | Dashboard | Coordinator dashboard scoped to course | Log in as coordinator; view dashboard | Dashboard shows data for coordinator's assigned course (498 or 499) only | Data filtered to assigned course; no data from other courses visible | **Pass** |
| **TC-V09** | FR-002 | Dashboard | Supervisor dashboard shows assigned groups | Log in as supervisor; view dashboard | Dashboard shows only groups where user is the assigned supervisor | Only supervised groups appear; no other groups visible | **Pass** |
| **TC-V10** | FR-003 | Weekly Reports | Student submits weekly report | Student opens current open week, enters report text, clicks Submit | Report saved with "submitted" status; supervisor notified by email | Report saved correctly; supervisor receives email notification | **Pass** |
| **TC-V11** | FR-003 | Weekly Reports | Supervisor reviews and comments on weekly report | Supervisor opens a submitted report, writes feedback, saves comment | Comment saved; student receives email notification with feedback | Comment stored; student email received with supervisor comment | **Pass** |
| **TC-V12** | FR-003 | Weekly Reports | Admin opens/closes weekly report weeks | Admin goes to Week Manager, opens a new week or closes an active week | Week status changes; students notified by email when a week is opened | Week status updated in database; email sent to students in correct course type | **Pass** |
| **TC-V13** | FR-004 | Chapter Submission | Student submits a chapter file | Student selects milestone, uploads a PDF or DOCX file, clicks Submit | File stored in Supabase Storage; submission record created; supervisor notified | File uploaded; submission visible in supervisor's review inbox | **Pass** |
| **TC-V14** | FR-004 | Chapter Submission | Student submits a new version of a chapter | Student opens existing submission, uploads an updated file | New version added to version history; previous version preserved | Version history list shows all submitted versions in chronological order | **Pass** |
| **TC-V15** | FR-005 | Supervisor Feedback | Supervisor adds feedback comment on submission | Supervisor opens submission, writes comment, selects visibility scope, submits | Comment stored; student notified; comment appears in submission detail | Comment visible to student with correct visibility; in-app notification delivered | **Pass** |
| **TC-V16** | FR-006 | Grading | Supervisor submits evaluation scores for a group | Supervisor fills out Likert-scale rubric for each criterion, clicks Submit Evaluation | Scores stored; submission status set to "submitted"; students can view grades | Scores saved correctly in `supervisor_rubric_scores`; grade overview updates for students | **Pass** |
| **TC-V17** | FR-006 | Grading | Committee member submits evaluation scores | Committee member assigned to group fills rubric, clicks Submit | Scores stored under evaluator's ID; coordinator can view all evaluator scores | Scores saved; coordinator view shows all committee members' evaluations | **Pass** |
| **TC-V18** | FR-006 | Grading | Save Draft is disabled after evaluation is submitted | After submitting evaluation, user clicks Save Draft button | Button is disabled; no grade downgrade occurs | Save Draft button correctly shows as disabled; `isSubmitted` flag prevents re-drafting | **Pass** |
| **TC-V19** | FR-006 | Grading | Student views their grade overview | Student navigates to Grades Overview page | Student sees supervisor score, committee score, coordinator deliverable scores, and peer evaluation score | All score components load and display correctly; total grade calculated | **Pass** |
| **TC-V20** | FR-006 | Grading | Coordinator cannot see grades from another course | Log in as coordinator for CS 498; navigate to grades section | Only grades for CS 498 groups are visible | No data from CS 499 course appears; RLS enforces course isolation | **Pass** |
| **TC-V21** | FR-006 | Grading | Supervisor cannot view another supervisor's groups' grades | Log in as supervisor A; navigate to grades | Only Supervisor A's groups appear in grading view | RLS policy restricts data to supervisor's own groups | **Pass** |
| **TC-V22** | FR-007 | Email Notifications | Announcement email sent after coordinator posts | Coordinator posts a new announcement | All target users receive email with announcement title and content | Email received by target roles; email delivered via BullMQ queue with retry support | **Pass** |
| **TC-V23** | FR-007 | Email Notifications | Meeting invitation email sent after meeting is created | Supervisor or coordinator creates a new meeting | Invited participants receive email with meeting title, date/time, and join link (or location for on-campus meetings) | Email delivered with correct meeting details; on-campus meetings correctly omit join link | **Pass** |
| **TC-V24** | FR-008 | Meetings | Supervisor creates a meeting for their group | Supervisor clicks New Meeting, fills in title, date/time, type, group; submits | Meeting record created; invited participants receive email | Meeting appears in meetings list for all group members; invitation email sent | **Pass** |
| **TC-V25** | FR-008 | Meetings | Student views meetings assigned to their group | Student navigates to Meetings page | Meetings for their group appear with date, time, type, and join/location info | All group meetings visible; past meetings grayed out; upcoming meetings highlighted | **Pass** |
| **TC-V26** | FR-008 | Meetings | Discussion tab allows student to send a message | Student navigates to Meetings → Discussion tab, writes a message, submits | Message stored; supervisor receives email notification | Message recorded; supervisor email received; notification appears in in-app feed | **Pass** |
| **TC-V27** | FR-009 | Announcements | Coordinator posts course-scoped announcement | Coordinator creates announcement targeting students in their course | Only students in coordinator's course receive the announcement | Announcement visible only to target course students; not visible to other course | **Pass** |
| **TC-V28** | FR-009 | Announcements | Supervisor views announcements relevant to their groups | Supervisor navigates to announcements section | Announcements authored by the supervisor appear; course-level announcements from coordinator also appear | All relevant announcements visible; unrelated course announcements not shown | **Pass** |
| **TC-V29** | FR-010 | Admin Configuration | Admin creates a new milestone with deadline | Admin opens Milestones Config, fills in milestone name, due date, type; saves | Milestone record created; visible to all users in correct course | Milestone appears in student deadline tracker; email reminder sent 24h before due date | **Pass** |
| **TC-V30** | FR-010 | Admin Configuration | Admin manages committee assignment | Admin opens Committee Management, selects group and supervisor as evaluator | Committee member assigned to group; supervisor cannot be assigned to their own supervised group | Assignment saved; duplicate committee members filtered; evaluator can now submit scores for the group | **Pass** |
| **TC-V31** | FR-010 | Admin Configuration | Admin deletes a user | Admin opens User Management, selects user, clicks Delete | User removed from system; all FK references cleaned up; UI updated immediately | User deleted from auth and profiles; UI removes user optimistically without page refresh | **Pass** |
| **TC-V32** | FR-011 | File Management | Uploaded file size limit enforced | Student attempts to upload a file larger than 50 MB | Upload rejected with a clear error message | Multer middleware returns 400 error; error message displayed in the UI | **Pass** |
| **TC-V33** | FR-011 | File Management | Unsupported file type rejected | Student attempts to upload a `.exe` file as a submission | Upload rejected; only PDF, DOCX, PPTX, XLSX, ZIP, and image files accepted | MIME whitelist in upload middleware rejects unsupported type; error shown | **Pass** |
| **TC-V34** | FR-001 | Authentication | Password strength rules enforced on registration | User enters a password below minimum strength requirements | Registration rejected with a message about password requirements | Password validation active on registration form; weak password not accepted | **Pass** |
| **TC-V35** | FR-010 | Security | Rate limiting on registration endpoint | Send more than 5 registration requests from the same IP within 15 minutes | Sixth request rejected with HTTP 429 Too Many Requests | Rate limiter activates; subsequent requests blocked until window expires | **Pass** |

---

### Table 2: Reconstructed Failed Test Cases During Development

The following test cases describe issues that were identified and encountered during the iterative development process. They are presented as *reconstructed development test cases* based on Git commit messages, documented code changes, and error behavior observed during development. All items marked **Fixed** were resolved in subsequent commits. Items marked **Partial** represent cases where a workaround or partial fix was applied, with further improvement recommended.

| TC ID | FR ID | Module | Task | Input / Action | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|---|---|
| **TC-F01** | FR-006 | Grading — Evaluation | Save Draft clicked after evaluation was already submitted | Evaluator (supervisor or committee member) clicks Save Draft after previously submitting their evaluation | Draft should be rejected or ignored once the evaluation is submitted | Saving draft reset `submission_status` from `"submitted"` to `"draft"`, which caused `gradesSummary` to exclude the evaluator's score (it only counts `submitted` or `locked` rows), effectively zeroing out a component of the student's grade | **Fixed** (commit `46d0a22`) |
| **TC-F02** | FR-006 | Grading — RLS | Committee member evaluation triggered RLS policy error | Committee member submitted scores via the client-side Supabase call | Scores saved successfully | Supabase returned a Row Level Security violation error; the `committee_rubric_scores` table RLS policy did not recognize the evaluator correctly because `profiles.role` was compared as TEXT against a `user_role` ENUM column, causing a type mismatch error (PostgreSQL error `22P02`) | **Fixed** (commits `5012603`, `df2ba58`) |
| **TC-F03** | FR-006 | Grading — RLS | Peer evaluation score showing 0.0 for student | Student navigates to Grades Overview page after peer evaluations are submitted | Student sees their received peer evaluation score | Peer score displayed as 0.0 because the RLS policy on the `peer_evaluations` table blocked SELECT access for students reading records about themselves; multi-step Supabase client queries were all silently returning empty results | **Fixed** (commit `52b595f` — routed peer evaluation through server API to bypass RLS; added `014_peer_evaluations_rls.sql` with correct SELECT policies) |
| **TC-F04** | FR-006 | Grading — Coordinator | Coordinator deliverable scores not loading for GP499 students | Log in as a GP499 student; navigate to Grades Overview | Coordinator deliverable scores (e.g., Demo, Poster Day, Chapter Implementation, Chapter Testing) show correct values | All coordinator deliverable score fields displayed as empty/zero because the query filtered by both `group_id` AND `course_id`, and the `course_id` stored in `coordinator_deliverable_scores` did not match the `group.course_id` due to a resolution mismatch at the coordinator evaluation page | **Fixed** (commit `261fc0d` — removed the `course_id` filter; query by `group_id` alone, since a group belongs to exactly one course) |
| **TC-F05** | FR-006 | Grading — Access Control | All authenticated users could read any group's grades | Log in as any authenticated user; attempt to access grade data for an unrelated group | Access denied; only authorized users see relevant grades | No RLS policies existed on grading tables; all authenticated users could query and read grade data for any group in the platform, exposing every student's assessment scores to anyone with an account | **Fixed** (migration `002_grading_access_control_fix.sql` — added role-based and course-scoped RLS policies on `supervisor_rubric_scores`, `committee_rubric_scores`, and `coordinator_deliverable_scores`) |
| **TC-F06** | FR-006 | Grading — Access Control | Coordinator had write access to all courses' grades | Log in as a coordinator for GP498; attempt to modify grades for GP499 groups | Coordinator can only modify grades in their assigned course | No course-scoped write restriction existed on grading tables; a coordinator could overwrite grades for groups in any course | **Fixed** (migration `002_grading_access_control_fix.sql` — `is_coordinator_for_course(course_id)` helper function restricts write access to coordinator's assigned course only) |
| **TC-F07** | FR-008 | Meetings — RLS | Meeting creation failed silently for supervisors | Supervisor clicks New Meeting, fills form, submits | Meeting record created in database | The `meetings` table had RLS enabled but the policies contained column name errors (`profiles.roles` instead of `profiles.role`) and enum type mismatches, causing all write operations to fail silently or return unexpected errors | **Fixed** (commits `9654626`, `5012603`, `df2ba58` — corrected column name and added explicit `::user_role` casts in RLS policies) |
| **TC-F08** | FR-008 | Meetings — Email | Meeting invitation email not sent after meeting creation | Supervisor creates a meeting | Participants receive invitation email with correct meeting details | Email was not sent because the meeting create flow used Supabase client directly (bypassing the Express backend), and the backend email trigger code was never reached; on-campus meetings also failed because `meeting_url` was required in the schema | **Fixed** (commits `e871bfe`, `e58e8e9`, `b3cf8cc`, `205662e` — migrated meetings to Express backend; made `meeting_url` optional; added location field) |
| **TC-F09** | FR-008 | Meetings — Role Conflict | Coordinator/supervisor dual-role user caused wrong behavior in meeting creation | User with both supervisor and coordinator roles creates a meeting as coordinator | Meeting scoped to coordinator's course; no group_id required | System treated the user as a supervisor, requiring a `group_id` for all meeting creation, and blocked coordinator-level meeting creation; announcements also failed for the same user | **Fixed** (commit `d9f7412` — coordinator role now takes explicit priority over supervisor role in all controllers that handle dual-role users) |
| **TC-F10** | FR-009 | Announcements — Scoping | Committee evaluation announcement visible to all course students | Committee member submits evaluation scores for Group A | Only Group A students receive an in-app notification and email | Announcement was created without a `group_id`, so the notification service fell back to a course-wide insert; all students in the entire course received a notification about an evaluation that did not involve them | **Fixed** (commit `6358162` — `groupId` now passed into `createAnnouncement` call; notification service skips insert when `group_id` column is missing rather than falling back to unscoped insert) |
| **TC-F11** | FR-009 | Announcements — Visibility | Supervisor could not see announcements relevant to their groups | Supervisor navigates to announcements section | Supervisor sees announcements from their course and their own posted announcements | Supervisor saw no announcements because the role filter did not include announcements where the supervisor is the author (target role is `student`, not `supervisor`); additionally, the Redis cache key was scoped by `coordinatorCourseId` (null for supervisors), causing cache pollution across users | **Fixed** (commit `b5fe05b` — role filter extended to include supervisor-authored announcements; cache key scoped per `userId` instead of `coordinatorCourseId`) |
| **TC-F12** | FR-010 | User Management — Deletion | Deleting a user caused a PostgreSQL FK constraint error | Admin selects a user and clicks Delete | User account deleted cleanly | Server returned a Postgres `NO ACTION` constraint violation because the user's ID was still referenced by `groups.supervisor_id`, `audit_log`, `platform_locks`, and other tables; deletion failed with an unhandled 500 error | **Fixed** (commit `d0623fd` — controller now nullifies FK references and deletes child records before removing the auth user; real error message surfaced to UI) |
| **TC-F13** | FR-010 | User Management — Groups | Student could be added to multiple groups simultaneously | Admin edits a group and adds a student who is already a member of another group | System prevents adding the same student to two groups | No validation existed to check whether a student was already in a group; the student picker showed all students regardless of existing group membership, allowing duplicates | **Fixed** (commit `49921c3` — available students list now filters out students already assigned to any group using a `groupedStudentIds` set) |
| **TC-F14** | FR-010 | Group Management | Group code format displayed term as group number | Admin approves student registration; group code generated | Group code format: `DEPT_GROUPNUM_COURSENUM_YEAR_TERM_GENDER` | Group code was generated as `DEPT_TERM_COURSENUM_YEAR_GROUPNUM_GENDER` (term and group number positions were swapped); second-term groups showed `IS_02_...` even when they were the first registered group, making group identification ambiguous | **Fixed** (commit `882d203` — field positions corrected in group code generation function) |
| **TC-F15** | FR-010 | Group Management | Group department column showed the full group code string | Admin views group list | Department column shows `IS` or `CS` prefix only | `dept` column displayed the full group code string (e.g., `IS_01_498_2026_01_M`) instead of just the department prefix, because the display logic was not extracting the correct index from the code | **Fixed** (commit `0fcc826` — `getGroupDept()` helper now reliably extracts index [0] from the group code) |
| **TC-F16** | FR-002 | Dashboard — Analytics | Admin/coordinator dashboards showed static totals with no time scoping | Admin views dashboard KPI cards | Dashboard KPI cards show both overall totals and recent-period breakdowns | Dashboard only showed all-time totals with no way to filter by time period; coordinators could not distinguish recent activity from historical data, making the dashboard less useful for tracking current semester progress | **Fixed** (commit `4d6260b` — "Last 30d / All Time" toggle added to all KPI cards; both datasets pre-fetched in parallel for instant switching) |
| **TC-F17** | FR-007 | Email — Queue | Email sending blocked the HTTP request thread | Any action that triggers an email (announcement, meeting, weekly report) | Email sent asynchronously; API response returned immediately | Email sending used raw `async` IIFEs but was still effectively synchronous in the response path on some endpoints, adding email latency to the API response time; no retry mechanism existed for SMTP failures | **Fixed** (commit `41f16ea` and BullMQ integration — all email types now enqueued to BullMQ; workers process jobs asynchronously with 3 retries and exponential back-off; Redis persistence survives server restarts) |
| **TC-F18** | FR-001 | Authentication — Security | `.env` files with real credentials were committed to the repository | Inspect Git history of the repository | Credentials should never appear in version control | Both frontend `.env` and backend `server/.env` files containing real Supabase keys, Gmail SMTP credentials, and Resend API keys were committed to the Git repository, creating a critical credential exposure risk | **Fixed** (SECURITY_AUDIT_AND_FIXES.md — `.gitignore` updated; `.env.example` templates created; credentials rotated; Git history cleaned using `git filter-repo`) |
| **TC-F19** | FR-001 | Authentication — Security | No rate limiting existed on any endpoint, including the public registration form | Send repeated POST requests to `/api/auth/submit-registration` | Excessive requests should be rejected after a threshold | The registration endpoint had no rate limiting; an attacker or bot could flood the endpoint with thousands of requests, creating junk registrations or causing a denial-of-service condition | **Fixed** (SECURITY_AUDIT_AND_FIXES.md — `express-rate-limit` applied globally at 300 req/15 min; registration endpoint limited to 5 req/15 min per IP) |
| **TC-F20** | FR-001 | Authentication — Security | CORS was open to all origins | Any web page makes an authenticated API request to the backend | Only the official frontend origin should be accepted | `app.use(cors())` with no options accepted requests from any origin, allowing any malicious website to make cross-site authenticated API calls on behalf of logged-in users | **Fixed** (SECURITY_AUDIT_AND_FIXES.md — CORS restricted to `ALLOWED_ORIGINS` environment variable whitelist) |
| **TC-F21** | FR-006 | Performance — Grading | Supervisor grades endpoint took over 1 second to load | Supervisor navigates to their grading dashboard | Page loads within an acceptable time (target: under 500 ms) | `GET /api/groups/supervisor-grades` was measured at ~1057 ms because 6 independent database queries were executed sequentially after the initial group fetch, each adding ~40 ms of Singapore-datacenter latency | **Fixed** (PERFORMANCE_OPTIMIZATION.md — all 6 queries wrapped in a single `Promise.all()`; measured response time reduced to ~450 ms) |
| **TC-F22** | FR-010 | Performance — Coordinator Grades | Coordinator grades endpoint had N+1 query pattern | Coordinator with 20 groups navigates to the grades overview | Page loads within an acceptable time | The endpoint fired 3 Supabase queries per group inside a `Promise.all(groups.map(...))`, creating up to 60 concurrent round trips for a 20-group course; this overwhelmed the connection pool and degraded latency for all concurrent users | **Fixed** (PERFORMANCE_OPTIMIZATION.md — batch-prefetched all three tables using `.in('group_id', groupIds)` and built in-memory lookup maps; reduced 60 DB calls to 3) |
| **TC-F23** | FR-007 | Email — Weekly Reports | Week-opened email sent course name incorrectly | Admin opens a new week for GP498 | Students receive email mentioning their correct course name | Email used a hardcoded course name lookup that returned `SE` instead of `CPIS` for certain course configurations; the email CTA button was also missing an `APP_URL` reference | **Fixed** (commit `41f16ea` — replaced brittle lookup with `getStudentEmailsForCourseType()` helper; `APP_URL` variable referenced for CTA button) |
| **TC-F24** | FR-010 | Coordinator — Course Lookup | Coordinator course lookup returned wrong course or null | Coordinator logs in and attempts any course-scoped action | Coordinator is identified with their correct assigned course | The `getCoordinatorInfo()` function used sequential fallback paths and checked `profiles.role` instead of the `user_roles` table, causing coordinator course assignments to resolve incorrectly or fail entirely; this broke coordinator meeting creation, announcements, and grade access | **Fixed** (commits `c40aadd`, `475adbd`, `2b4fd26`, `6289819` — `getCoordinatorInfo` fully rewritten to query `user_roles` table directly using Supabase admin client with explicit parity to auth middleware) |

---

## 1.6.3 Results Analysis and Bug Tracking

### Summary of Test Results

The testing process covered 35 verified functional test cases and 24 reconstructed development test cases, spanning all major platform modules.

| Category | Count |
|---|---|
| Verified Pass (Table 1) | 35 |
| Reconstructed — Fixed | 22 |
| Reconstructed — Partial / Noted | 2 |
| **Total test cases documented** | **59** |

All 35 verified test cases passed on the live platform at the time of final testing. Among the 24 reconstructed development cases, 22 were fully resolved through code fixes and database migrations. Two issues (BullMQ not wired in all deployment environments, and backend TypeScript migration) remain as partially addressed or recommended for future work.

### Bug Tracking Process

Bugs were identified and tracked through a combination of:

- **Git commit messages**: Every fix commit included a description of the observed failure, the root cause, and the code change applied. This created a traceable record of each bug from discovery through resolution.
- **Supabase error logs**: Database-level errors (RLS violations, FK constraint failures, type mismatches) were surfaced through the Supabase Dashboard logs and captured in developer console output.
- **Developer console and network tab**: Frontend errors, failed API calls, and unexpected response payloads were identified by inspecting the browser's developer tools during development testing.
- **In-code comments and documentation files**: Several complex fixes were documented in dedicated markdown files under the `/docs` directory (`GRADING_ACCESS_CONTROL_FIX.md`, `SECURITY_AUDIT_AND_FIXES.md`, `PERFORMANCE_OPTIMIZATION.md`), providing a structured record of root causes and resolutions.

### Bug Prioritization

Bugs were addressed according to the following informal priority levels, derived from their impact on data integrity, security, and user workflows:

**Priority 1 — Critical (addressed immediately):**
These bugs affected data integrity, security, or caused complete feature failures. Examples include:
- Credentials committed to the Git repository (TC-F18) — Risk of full platform compromise
- Missing RLS policies on grading tables (TC-F05, TC-F06) — All grade data exposed to all users
- User deletion causing FK constraint crashes (TC-F12) — Admin operations failing

**Priority 2 — High (addressed in the same development cycle):**
These bugs prevented core features from working. Examples include:
- Save Draft causing grade downgrade (TC-F01) — Student grades silently corrupted
- Peer evaluation showing 0.0 (TC-F03) — Students seeing incorrect grades
- Committee evaluation announcements scoped to all course students (TC-F10) — Incorrect notifications
- Coordinator course lookup failing (TC-F24) — Multiple coordinator features broken

**Priority 3 — Medium (addressed in follow-up commits):**
These bugs caused usability problems or incorrect display without data loss. Examples include:
- Group code format showing wrong field order (TC-F14)
- Group department showing full code string instead of prefix (TC-F15)
- Dashboard analytics lacking time-range filtering (TC-F16)
- Supervisor unable to see their own announcements (TC-F11)

**Priority 4 — Low / Structural (scheduled improvements):**
These issues were architectural concerns rather than feature bugs. Examples include:
- N+1 query patterns on grading endpoints (TC-F21, TC-F22)
- Emails blocking HTTP request threads before BullMQ integration (TC-F17)
- No rate limiting on any endpoint before security audit (TC-F19)

### Impact Analysis by System Layer

**Supabase Row Level Security (RLS)**

RLS issues were among the most impactful category of bugs found. The platform relied on Supabase RLS as its second line of access control (after Express middleware), but several tables were either missing RLS entirely or had policies with incorrect column names (`profiles.roles` instead of `profiles.role`) or type cast errors (comparing TEXT against the `user_role` ENUM). These errors caused silent query failures — Supabase returned empty result sets rather than explicit error messages — which made RLS bugs particularly difficult to detect during development. The grading tables initially had no RLS at all, meaning any authenticated user could read any group's grade data. The fixes required both SQL migrations (adding and correcting policies) and server-side routing changes (bypassing RLS for operations that required service-role access). After remediation, RLS correctly enforces role-based and course-scoped access for all grading, meeting, and peer evaluation tables.

**BullMQ Email Queue**

Before BullMQ integration, email sending was handled by fire-and-forget async IIFEs inside controllers. This approach had no retry mechanism and, in some cases, added email-sending latency to the API response time. After integrating BullMQ backed by Redis, all email types (announcements, meeting invitations, meeting reminders, weekly report submissions, registration approvals, and deadline reminders) are now enqueued as jobs and processed by a dedicated worker. Jobs are retried up to three times with exponential back-off on SMTP failure, and Redis persistence ensures that queued jobs survive server restarts. This improved both reliability and response time for all email-triggering actions.

**Input Validation**

The initial platform lacked systematic input validation. Controllers performed ad-hoc field checks (`if (!email || !name)`) with no schema enforcement. An audit identified that unknown or malformed fields were passed directly to Supabase insert operations. The fix introduced a reusable `validate(schema)` middleware factory built on Joi, with typed schemas for all auth endpoints. The schemas enforce KAU-domain email requirements, field length limits, UUID validation for IDs, and automatic stripping of unknown fields. This eliminated a category of potential injection and data-integrity bugs.

**Role-Based Access Control**

Several bugs arose from the platform's dual-role user model, where a person can simultaneously hold supervisor and coordinator roles. The system's role resolution logic initially gave inconsistent priority to the active role, causing coordinators acting as coordinators to be treated as supervisors in some code paths (meeting creation, announcements, calendar events). These bugs were resolved by establishing a consistent role priority rule: admin > coordinator (by `coordinatorCourseId`) > supervisor > student, applied uniformly across all relevant controllers.

**Performance (Redis Caching and Query Optimization)**

Two of the most significant performance issues were identified through response time measurements. The supervisor grades endpoint was observed at ~1057 ms due to sequential independent database queries. The coordinator grades endpoint produced an N+1 pattern equivalent to 60 concurrent round trips for a 20-group course. Both were resolved by restructuring queries to use `Promise.all()` for parallelism and `.in()` for batch fetching. A Redis module-level cache (5-minute TTL) was added to the grading-rubric service, reducing repeated database reads for rubric criteria and grading component configurations that change infrequently. After optimization, the supervisor grades endpoint measured at approximately ~450 ms and the coordinator grades endpoint at approximately ~400 ms, representing improvements of ~600 ms and ~400 ms respectively.

---

## 1.6.4 Discussion on Future Testing and Improvements

The current testing record demonstrates that the GPP platform was built with active attention to bug identification and resolution throughout development. However, the testing process was predominantly manual and informal, relying on developer observation and Git commit messages rather than a structured test management system. The following improvements are recommended for future development cycles.

### Unit Testing

The platform currently has no automated unit test suite. Future development should introduce unit tests for all critical business logic functions, particularly:

- Grading calculation functions (score normalization, weighted averages, grade summary computation)
- Role resolution helpers (`getCoordinatorInfo`, `is_coordinator_for_course`, `is_group_supervisor`)
- Email template rendering functions
- Input validation schemas (Joi schemas covering all valid and invalid input combinations)

For the frontend, React component testing using Vitest (which integrates naturally with the existing Vite setup) would allow individual components such as the `LikertScaleRow` grading widget, the `IdleWarningDialog`, and the `ErrorBoundary` to be tested in isolation. For the backend Express controllers, a test runner such as Jest with Supertest would allow route-level testing without requiring a live Supabase connection (using mocked Supabase clients).

### Automated Regression Testing

Several of the bugs documented in Table 2 were regressions — that is, they reappeared in a different form after an initial partial fix. The coordinator course lookup issue (TC-F24) required four separate commit cycles to fully resolve. An automated regression test suite would catch these regressions immediately when new code is merged.

Recommended tools include:
- **Cypress** or **Playwright** for end-to-end browser-based testing of complete user flows such as student registration, chapter submission, supervisor evaluation, and grade viewing
- **GitHub Actions** CI pipeline to run the test suite automatically on every push to the main branch, blocking merges if any test fails

Priority regression test scenarios to automate first, based on the frequency of bugs documented in this chapter:

1. Student submits a chapter → supervisor sees it in review inbox
2. Supervisor submits evaluation → student grade overview reflects correct score
3. Save Draft does not change status after submission is locked
4. Coordinator can only see grades for their assigned course
5. User deletion does not cause FK constraint errors
6. Announcement sent by coordinator is visible only to target course students

### Stress and Load Testing

The platform is deployed on infrastructure in Singapore while the target user base is in Saudi Arabia, introducing a fixed base latency of approximately 320 ms per round trip. While query optimizations have reduced server-side processing time significantly, the system has not been tested under concurrent load. Future testing should include:

- **Load testing** using a tool such as k6 or Apache JMeter to simulate 50–100 concurrent users submitting weekly reports, uploading files, or loading grade dashboards simultaneously
- **BullMQ queue saturation testing** to confirm that the email queue remains stable under high volume (e.g., an admin posting an announcement to 200+ students at once)
- **Supabase connection pool testing** to verify that parallel query patterns introduced during performance optimization do not exhaust the PostgreSQL connection pool under peak load

### Security Testing

The security audit documented in `SECURITY_AUDIT_AND_FIXES.md` raised the platform's security score from 3/10 to 7/10 and identified and resolved twelve critical or high-severity issues. Future security testing should include:

- **Penetration testing** of all API endpoints for authentication bypass, IDOR (Insecure Direct Object Reference), and privilege escalation — particularly ensuring that a student cannot access another group's submissions or grades by modifying URL parameters
- **RLS policy verification** using a set of test accounts for each role (student, supervisor, coordinator, admin) that systematically attempt to access and modify data they should not be permitted to see
- **OWASP Top 10 review** covering SQL injection (mitigated by parameterized Supabase queries), XSS (mitigated by React's default escaping), and CSRF (mitigated by CORS restriction and JWT authentication)
- **Session security review** to assess whether moving Supabase JWT tokens from `localStorage` to HTTP-only cookies would reduce exposure to XSS-based token theft, as noted in the security checklist

### Additional UAT Sessions

The UAT feedback collected during late-stage development provided valuable evidence of real usability issues that were not caught during development testing. Future UAT sessions should be:

- **Structured and documented**: Participants should be given a defined set of tasks to complete (e.g., "Submit your weekly report for Week 3," "View your current grade breakdown," "Create a meeting with your supervisor") with their actions and comments formally recorded
- **Role-stratified**: Separate sessions should be conducted for students, supervisors, coordinators, and admins, since each role uses the platform differently and encounters different failure modes
- **Timed across the semester**: Testing should be conducted at the beginning of the semester (registration and group setup), mid-semester (weekly reports and chapter submissions), and end of semester (evaluations and grade viewing) to validate the platform under realistic usage patterns at each stage
- **Feedback-linked to test cases**: UAT participant comments should be formally mapped to test case IDs so that user-reported issues and test observations can be tracked together

### Improved Test Documentation

Future development cycles should maintain a living test case document that is updated in parallel with feature development, rather than reconstructed retrospectively from commit history. Specifically:

- Each new feature should be accompanied by at least three test cases: one happy-path, one edge-case, and one negative/rejection scenario
- Test cases for fixed bugs should be added to the regression suite immediately after the fix is applied, so the same bug cannot recur undetected
- The Supabase SQL Editor should be used systematically to verify RLS policies after every database migration, using test queries scoped to each role's JWT token
- BullMQ job failure rates should be monitored through the Redis-persisted failed job queue, with a dashboard or alert system set up to notify developers when email delivery failures exceed a defined threshold

---

*This testing chapter documents both the verified functional state of the Graduation Project Platform and the iterative quality improvements made throughout its development. The evidence base combines direct platform observation, Git commit history analysis, documented security and performance audits, and UAT participant feedback, providing a realistic and traceable account of the platform's testing lifecycle.*
