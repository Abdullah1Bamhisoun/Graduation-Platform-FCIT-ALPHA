# Implementation Plan — FCIT Graduation Platform FINAL SPEC

## Gap Summary

| Spec Requirement | Current State | Status |
|---|---|---|
| 16-week structure w/ Open/Close/Locked status | 14 weekly reports, no status control | ❌ Missing |
| Coordinator-only week control | No week management | ❌ Missing |
| `was_opened` exclusion from grade calc | Not implemented | ❌ Missing |
| Late Submission Request system | No table, no logic | ❌ Missing |
| Grading schemas from database | Hardcoded in grades.ts | ❌ Missing |
| CPIS-498 vs 499 strict separation | Not enforced | ❌ Missing |
| CPIS-499 Coordinator Committee (15%) | No table, no UI | ❌ Missing |
| Normalized weekly `(raw/max_raw)*weight` | `(reports/14)*20` | ❌ Wrong |
| `student_mark` + `supervisor_mark` auto-calc | Not in schema | ❌ Missing |
| Always-visible grading criteria (never early return) | Early return if no grade | ❌ Wrong |
| Blue banner when no grades entered | Not implemented | ❌ Missing |
| Yellow banner when no group assigned | Not implemented | ❌ Missing |
| CPIS-499 has NO deliverables / peer feedback | Not enforced | ❌ Missing |
| CPIS-498 deliverables (15%) coordinator-only | Partially present | ⚠️ Incomplete |

---

## Files to Create/Modify (15 files)

### Phase 1 — Database Migration (1 file)

**NEW**: `supabase/migrations/20260220000000_weekly_grading_system.sql`

Creates:
- `grading_schemas(id, department, course_type, component_name, weight, role, semester, is_active)` + seeds
- `week_statuses(id, department, course_type, week_number 1-16, is_open, is_locked, was_opened, semester, opened_at, opened_by)` + seeds 32 rows (16 weeks × 2 courses)
- `late_requests(id, group_id, week_number, course_type, department, semester, status, reason, requested_at, requested_by, reviewed_by, reviewed_at)` with UNIQUE(group_id, week_number, semester)
- `admin_committee_scores(id, group_id, poster_day_score, implementation_score, testing_score, semester, graded_by, graded_at)` with check total ≤ 15
- Alters `weekly_reports` to add: `student_progress TEXT`, `student_future_work TEXT`, `student_discussion_points TEXT`, `submission_status TEXT DEFAULT 'not_submitted'`, `supervisor_response_status TEXT DEFAULT 'pending'`, `student_mark SMALLINT DEFAULT 0`, `supervisor_mark SMALLINT DEFAULT 0`
- RLS policies for all new tables

### Phase 2 — TypeScript Types (1 file)

**MODIFY**: `src/types/index.ts`

Adds:
```ts
GradingSchema { id, department, courseType, componentName, weight, role, semester, isActive }
WeekStatus { id, department, courseType, weekNumber, isOpen, isLocked, wasOpened, semester, openedAt, openedBy }
WeeklyGradeSummary { weeksOpened, totalRaw, maxRaw, normalizedScore, weight, percentage }
LateRequest { id, groupId, weekNumber, courseType, department, semester, status, reason, requestedAt, requestedBy, reviewedBy, reviewedAt }
AdminCommitteeScore { id, groupId, posterDayScore, implementationScore, testingScore, semester, totalScore, gradedBy, gradedAt }
```
Updates `WeeklyReport` to include `studentMark`, `supervisorMark`, `submissionStatus`, `supervisorResponseStatus`, `studentProgress`, `futureWork`, `discussionPoints`

### Phase 3 — New Services (4 files)

**NEW**: `src/services/grading-schemas.ts`
- `getGradingSchemas(courseType, semester)` → `GradingSchema[]`
- `validateSchemaTotal(schemas)` → ensures sum = 100

**NEW**: `src/services/week-statuses.ts`
- `getWeekStatuses(courseType, semester)` → `WeekStatus[]` (all 16)
- `openWeek(weekNumber, courseType, semester, coordinatorId)` → sets is_open=true, was_opened=true
- `closeWeek(weekNumber, courseType, semester)` → sets is_open=false
- `lockWeek(weekNumber, courseType, semester)` → sets is_locked=true, is_open=false

**NEW**: `src/services/late-requests.ts`
- `submitLateRequest(groupId, weekNumber, courseType, semester, reason, requestedBy)` → enforces 1-per-group-per-week, cannot request if locked
- `getLateRequests(courseType, semester)` → coordinator view
- `getGroupLateRequests(groupId, semester)` → student view
- `approveLateRequest(requestId, reviewerId)` → status=approved
- `rejectLateRequest(requestId, reviewerId)` → status=rejected

**NEW**: `src/services/admin-committee-scores.ts`
- `getAdminCommitteeScore(groupId, semester)` → `AdminCommitteeScore | null`
- `upsertAdminCommitteeScore(groupId, semester, scores, gradedBy)` → validates total ≤ 15

### Phase 4 — Updated Services (2 files)

**MODIFY**: `src/services/grades.ts` — Full rewrite of weekly normalization
- Weekly calc: `max_raw = weeksOpened * 2`; `raw = student_marks_sum + supervisor_marks_sum`
- `normalized = (raw / max_raw) * schema_weight` (zero-safe)
- Grade calculation reads from `grading_schemas` not hardcoded values
- `getStudentGrade()` respects course-type: 499 has no deliverables/peer, 498 has no coordinator committee
- `getGroupGrade()` updated accordingly

**MODIFY**: `src/services/weekly-reports.ts`
- `submitStudentWeeklyReport()` — only allowed when `week_status.is_open=true`; auto-sets `student_mark=1`, `submission_status='submitted'`
- `respondToWeeklyReport()` (new) — supervisor responds, auto-sets `supervisor_mark=1`, `supervisor_response_status='responded'`
- `getWeeklyReportsByGroup()` — include new fields in mapper

### Phase 5 — Frontend Pages (6 files)

**REWRITE**: `src/pages/student/GradesOverview.tsx`
- NEVER early return on missing data
- Always renders schema components from `grading_schemas` table
- Shows: yellow banner if no group, blue banner if no grades entered
- Schema-driven render: loop over schemas and show `ComponentName — score / maxWeight`
- 16-week table breakdown with Open/Closed/Locked/Not Opened badges
- Shows raw weekly score + normalized percentage
- CPIS-499: hides deliverables & peer feedback cards; shows Coordinator Committee card instead
- CPIS-498: hides Coordinator Committee card; shows deliverables & peer feedback

**MODIFY**: `src/pages/student/WeeklyReports.tsx`
- Load all 16 `week_statuses` alongside reports
- For each week: show status badge (Not Opened / Open / Closed / Locked)
- Submit button disabled if week not open
- If week closed+missed: show "Request Late Submission" button
- If request pending/approved/rejected: show status badge
- Late request dialog: reason text field, submit

**NEW**: `src/pages/coordinator/WeekManager.tsx`
- Shows 16-week grid (two tabs: CPIS-498 / CPIS-499)
- Each week row: status badge, Open / Close / Lock buttons (disabled per state rules)
- Cannot Open a Locked week; cannot Lock an unopened week
- Confirms destructive actions (Lock is irreversible)

**NEW**: `src/pages/coordinator/LateRequests.tsx`
- Table of pending/reviewed late requests per course
- Approve / Reject buttons with confirmation
- Shows group, week, reason, requested date

**NEW**: `src/pages/coordinator/CommitteeScores.tsx`
- CPIS-499 only
- Lists all groups; for each group: 3 score inputs (Poster Day /5, Implementation /5, Testing /5)
- Auto-displays total; validates ≤ 15
- Save button; read-only for non-coordinator roles

### Phase 6 — Routing (1 file)

**MODIFY**: `src/App.tsx`
- Add `/coordinator/week-manager`
- Add `/coordinator/late-requests`
- Add `/coordinator/committee-scores`

---

## Execution Order

1. DB migration (foundation for everything)
2. TypeScript types (needed by all services/components)
3. New services (grading-schemas, week-statuses, late-requests, admin-committee-scores)
4. Update grades.ts + weekly-reports.ts
5. Rewrite StudentGradesOverview
6. Update StudentWeeklyReports
7. New coordinator pages (WeekManager, LateRequests, CommitteeScores)
8. Update App.tsx routes

## Key Design Decisions

- `weekly_reports` retains existing schema (backwards compatible); new columns added with IF NOT EXISTS + defaults
- `grading_schemas` seeded with IS-department defaults; admin can reconfigure per semester
- `week_statuses` seeded with all 16 weeks NOT OPENED (is_open=false, was_opened=false) for current semester
- Division-by-zero guard: if `max_raw = 0` (no weeks opened), weekly component = 0 and banner shown
- CPIS-499 schema never includes 'Deliverables' or 'Peer Feedback' components
- CPIS-498 schema never includes 'Senior Project Committee' component
- Coordinator committee scores (admin_committee_scores) are group-level, averaged to students if needed
