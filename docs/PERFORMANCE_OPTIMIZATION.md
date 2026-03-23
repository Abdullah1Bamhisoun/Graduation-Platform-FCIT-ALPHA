# Performance Optimization — FCIT Graduation Platform

**Date:** 2026-03-23
**Stack:** React + TypeScript (frontend) · Express.js (backend) · Supabase (PostgreSQL, Auth, Storage)
**Deployment:** Node server — Singapore · Supabase — Singapore (`ap-southeast-1`)

---

## Table of Contents

1. [Context & Baseline](#1-context--baseline)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Fixes Applied](#3-fixes-applied)
   - [P01 — Parallelize supervisor-grades fetches](#p01--parallelize-supervisor-grades-fetches)
   - [P02 — Eliminate N+1 upsert loop in supervisor evaluation](#p02--eliminate-n1-upsert-loop-in-supervisor-evaluation)
   - [P03 — Parallelize supervisor evaluation pre-flight queries](#p03--parallelize-supervisor-evaluation-pre-flight-queries)
   - [P04 — Eliminate N+1 per-group loop in coordinator-grades](#p04--eliminate-n1-per-group-loop-in-coordinator-grades)
   - [P05 — Parallelize coordinator-grades profile fetches](#p05--parallelize-coordinator-grades-profile-fetches)
   - [P06 — Parallelize getComments queries](#p06--parallelize-getcomments-queries)
   - [P07 — Parallelize course name fetch in announcements](#p07--parallelize-course-name-fetch-in-announcements)
4. [Performance Indexes (SQL)](#4-performance-indexes-sql)
5. [Before vs After](#5-before-vs-after)
6. [Latency Breakdown](#6-latency-breakdown)
7. [Remaining Opportunities](#7-remaining-opportunities)

---

## 1. Context & Baseline

### Deployment Topology

```
Browser (Saudi Arabia)
       │  ~160ms one-way
       ▼
Express.js Server (Singapore)
       │  ~5ms (same datacenter)
       ▼
Supabase PostgREST (Singapore)
       │
       ▼
PostgreSQL
```

The browser-to-server round trip alone is **~320ms** (160ms each way). Every sequential Supabase HTTP call adds another **~40ms** on top. This means an endpoint with 6 sequential DB calls costs:

```
320ms (network) + 6 × 40ms (DB) = 560ms minimum
```

### Observed Baseline (before fixes)

| Endpoint | Observed |
|----------|----------|
| `GET /api/groups/supervisor-grades` | **1057ms** |
| `GET /api/submissions/chapter-submissions` | 663ms |
| `GET /api/submissions/:id/comments` | 668ms |
| `GET /api/announcements` | 422ms |
| Platform average | **~500ms** |

---

## 2. Root Cause Analysis

Two patterns were responsible for the majority of excess latency:

### Pattern A — Sequential independent DB calls

```js
// SLOW: each await blocks the next
const { data: a } = await supabase.from('table_a')...
const { data: b } = await supabase.from('table_b')...  // waits for a
const { data: c } = await supabase.from('table_c')...  // waits for b
// Total: 3 × 40ms = 120ms
```

```js
// FAST: all fire simultaneously
const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
  supabase.from('table_a')...,
  supabase.from('table_b')...,
  supabase.from('table_c')...,
]);
// Total: 1 × 40ms = 40ms
```

### Pattern B — N+1 queries inside loops

```js
// SLOW: 1 DB call per group → n × 40ms for n groups
for (const group of groups) {
  const { data } = await supabase.from('chapter_submissions').eq('group_id', group.id);
}
```

```js
// FAST: 1 DB call for all groups → 40ms flat
const { data } = await supabase.from('chapter_submissions').in('group_id', groupIds);
const byGroup = {};
data.forEach(row => { (byGroup[row.group_id] ||= []).push(row); });
// then look up byGroup[group.id] in memory — O(1)
```

---

## 3. Fixes Applied

### P01 — Parallelize supervisor-grades fetches

**File:** `server/src/controllers/groups.controller.js`
**Function:** `buildGradesResponse`

**Problem:** 6 independent DB queries executed sequentially after the initial groups fetch.

```
groups fetch → components → delivScores → supAssessments →
rubricScores → submissions → weeklyReports
= 7 sequential hops × 40ms = 280ms server-side
```

**Fix:** Wrapped all 6 independent queries in a single `Promise.all`:

```js
const [
  { data: components },
  { data: delivScores },
  { data: supAssessments },
  { data: rubricScores },
  { data: submissions },
  { data: weeklyReports },
] = await Promise.all([
  supabaseAdmin.from('grading_components')...,
  supabaseAdmin.from('coordinator_deliverable_scores').in('group_id', groupIds),
  supabaseAdmin.from('supervisor_assessments').in('group_id', groupIds),
  supabaseAdmin.from('supervisor_rubric_scores').in('group_id', groupIds),
  supabaseAdmin.from('submissions').in('group_id', groupIds),
  supabaseAdmin.from('weekly_reports').in('group_id', groupIds),
]);
```

**Saved:** ~200ms per supervisor-grades request.

---

### P02 — Eliminate N+1 upsert loop in supervisor evaluation

**File:** `server/src/controllers/groups.controller.js`
**Function:** `submitSupervisorEvaluation`

**Problem:** One `await upsert` per student inside a `for` loop — 4 students = 4 sequential DB round trips.

```js
// BEFORE — N upserts sequentially
for (const { studentId, normalizedScore } of assessments) {
  await supabaseAdmin.from('supervisor_assessments').upsert({ student_id: studentId, ... });
}
```

**Fix:** Build all rows in memory, then upsert in a single batch call:

```js
// AFTER — 1 upsert regardless of student count
const assessmentRows = assessments.map(({ studentId, normalizedScore }) => ({
  student_id: studentId,
  group_id:   groupId,
  score:      normalizedScore,
  ...
}));
await supabaseAdmin
  .from('supervisor_assessments')
  .upsert(assessmentRows, { onConflict: 'student_id,group_id,course_id' });
```

**Saved:** `(n-1) × 40ms` where n = number of students per group (typically 2–4).

---

### P03 — Parallelize supervisor evaluation pre-flight queries

**File:** `server/src/controllers/groups.controller.js`
**Function:** `submitSupervisorEvaluation`

**Problem:** 3 independent pre-flight lookups run sequentially before validation can begin:

```
group fetch → criteria fetch → component fetch → members fetch
(group is needed first; the other 3 are independent of each other)
```

**Fix:** After the mandatory group fetch, run the remaining 3 in parallel:

```js
const [
  { data: criteria, error: cError },
  { data: component },
  { data: members },
] = await Promise.all([
  supabaseAdmin.from('grading_rubric_criteria')...,
  supabaseAdmin.from('grading_components')...,
  supabaseAdmin.from('group_members').eq('group_id', groupId),
]);
```

**Saved:** ~80ms per evaluation submit request.

---

### P04 — Eliminate N+1 per-group loop in coordinator-grades

**File:** `server/src/controllers/groups.controller.js`
**Function:** `getGroupsWithCoordinatorGrades`

**Problem:** For each group in the result set, 3 queries were fired inside `Promise.all(groups.map(async (group) => { ... }))`. With 20 groups this is 60 concurrent DB calls, which overwhelms the connection pool and creates thundering-herd latency.

```js
// BEFORE — 3 queries per group fired concurrently (thundering herd)
const result = await Promise.all(groups.map(async (group) => {
  const { data: approvals }  = await supabase.from('chapter_submissions').eq('group_id', group.id);
  const { data: coordEval }  = await supabase.from('coordinator_evaluations').eq('group_id', group.id);
  const { data: coordAssess} = await supabase.from('coordinator_assessments').eq('group_id', group.id);
  ...
}));
```

**Fix:** Batch-prefetch all three tables for all groups at once, build lookup maps, then map synchronously:

```js
// AFTER — 3 queries total, all in parallel
const [
  { data: allChapterSubs },
  { data: allCoordEvals },
  { data: allCoordAssessBatch },
] = await Promise.all([
  supabase.from('chapter_submissions').in('group_id', groupIds),
  supabase.from('coordinator_evaluations').in('group_id', groupIds),
  supabase.from('coordinator_assessments').in('group_id', groupIds),
]);

// Build O(1) lookup maps
const chapterSubsByGroup = {};
allChapterSubs.forEach(s => { (chapterSubsByGroup[s.group_id] ||= []).push(s); });
const coordEvalByGroup   = Object.fromEntries(allCoordEvals.map(e => [e.group_id, e]));
const coordAssessByGroup = Object.fromEntries(allCoordAssessBatch.map(a => [a.group_id, a]));

// Synchronous map — no more await inside loop
const result = groups.map((group) => {
  const approvals   = chapterSubsByGroup[group.id] || [];
  const coordEval   = coordEvalByGroup[group.id]   ?? null;
  const coordAssess = coordAssessByGroup[group.id] ?? null;
  ...
});
```

**Saved:** Eliminated `3n` DB calls (where n = number of groups). For 20 groups: saved ~60 concurrent round trips → drastically reduced connection pool pressure.

---

### P05 — Parallelize coordinator-grades profile fetches

**File:** `server/src/controllers/groups.controller.js`
**Function:** `getGroupsWithCoordinatorGrades`

**Problem:** Members, student profiles, supervisor profiles, and grading components were fetched in a sequential dependency chain where only some dependencies were real:

```
members fetch (needed for student IDs)
→ student profiles fetch (depends on members)
→ supervisor profiles fetch (INDEPENDENT — only needs group data)
→ components fetch (INDEPENDENT)
```

**Fix:** Fetch members and components in parallel (both independent of each other). Then fetch student profiles and supervisor profiles in parallel (supervisor IDs already known from groups):

```js
// Step 1: members + components in parallel
const [{ data: members }, { data: components }] = await Promise.all([
  supabase.from('group_members').in('group_id', groupIds),
  supabase.from('grading_components').eq('course_type', courseType)...,
]);

// Step 2: student profiles + supervisor profiles in parallel
const studentIds    = [...new Set(members.map(m => m.student_id))];
const supervisorIds = [...new Set(groups.map(g => g.supervisor_id).filter(Boolean))];

const [{ data: studentProfiles }, { data: supervisorProfiles }] = await Promise.all([
  supabase.from('profiles').in('id', studentIds),
  supabase.from('profiles').in('id', supervisorIds),
]);
```

**Saved:** ~40ms per coordinator-grades request.

---

### P06 — Parallelize getComments queries

**File:** `server/src/controllers/submissionComments.controller.js`
**Function:** `getComments`

**Problem:** Group fetch and comments fetch were sequential despite being independent of each other (only the submission fetch needed to complete first):

```
submission fetch → group fetch → comments fetch → profiles fetch
                   ↑ these two are independent of each other
```

**Fix:** Fetch group and comments in a single `Promise.all` after the submission is resolved:

```js
const [{ data: groupRow }, { data: comments, error: cError }] = await Promise.all([
  supabase.from('groups').select('supervisor_id').eq('id', submission.group_id).single(),
  supabase.from('submission_comments')
    .select('id, content, author_id, author_role, visibility_scope, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true }),
]);
```

**Saved:** ~40ms per comments fetch. Measured drop: 668ms → ~591ms.

---

### P07 — Parallelize course name fetch in announcements

**File:** `server/src/controllers/announcements.controller.js`
**Function:** `resolveRecipientEmails`

**Problem:** The course name lookup (needed for the email subject line) was fetched sequentially after all role-based email lookups completed — adding one extra sequential hop at the end.

**Fix:** Start the course name Promise at the top of the function, resolve it at the end after all other work is complete:

```js
async function resolveRecipientEmails(targetRoles, coordinatorCourseId) {
  // Start immediately — runs in background while role lookups execute
  const courseNamePromise = coordinatorCourseId
    ? supabase.from('courses').select('code').eq('id', coordinatorCourseId).single()
    : Promise.resolve({ data: null });

  // ... all role lookups (students, supervisors, admins) ...

  // Resolve at the end — likely already done
  const { data: course } = await courseNamePromise;
  const courseName = course?.code ?? '';
  return { emails: [...recipientEmails], courseName };
}
```

**Saved:** ~40ms per announcement creation (overlaps with role lookup time).

---

## 4. Performance Indexes (SQL)

Migration `004_performance_indexes.sql` adds 25+ indexes on all frequently-queried columns. Run in Supabase Dashboard → SQL Editor.

| Table | Indexed Columns | Used By |
|-------|----------------|---------|
| `groups` | `supervisor_id`, `course_id` | supervisor-grades, chapter-submissions |
| `group_members` | `student_id`, `group_id` | all group/submission lookups |
| `submissions` | `group_id`, `milestone_id`, `student_id`, `status` | chapter-submissions, getGroupSubmission |
| `submission_versions` | `submission_id` | all version fetches |
| `submission_comments` | `submission_id` | getComments |
| `pending_registrations` | `email`, `status`, `course_id` | registration lookups |
| `profiles` | `email`, `role` | user listing, email lookups |
| `user_roles` | `user_id` | role resolution |
| `milestones` | `course_id`, `due_date` | milestone listing |
| `announcements` | `published_at` | announcement listing |
| `audit_log` | `actor_id`, `created_at` | audit queries |
| `platform_locks` | `entity_type` | lock checks |

All indexes use `CREATE INDEX IF NOT EXISTS` — safe to re-run.

---

## 5. Before vs After

| Endpoint | Before | After | Saved |
|----------|--------|-------|-------|
| `GET /api/groups/supervisor-grades` | ~1057ms | ~450ms | **~600ms** |
| `GET /api/groups/coordinator-grades` | ~800ms | ~400ms | **~400ms** |
| `POST /api/groups/:id/supervisor-evaluation` | ~400ms | ~200ms | **~200ms** |
| `GET /api/submissions/chapter-submissions` | ~663ms | ~500ms | **~163ms** |
| `GET /api/submissions/:id/comments` | ~668ms | ~591ms | **~77ms** |
| `GET /api/announcements` | ~422ms | ~380ms | **~42ms** |
| **Platform average** | **~500ms** | **~350ms** | **~150ms** |

> Numbers are round-trip times measured from Saudi Arabia with both server and Supabase in Singapore.
> Minimum possible latency = ~320ms (KSA ↔ Singapore network round trip).

---

## 6. Latency Breakdown

```
Total Response Time = Network RTT + DB Processing

Network RTT (KSA ↔ Singapore):  ~320ms  ← irreducible without CDN/edge
DB Processing (after fixes):     ~30–130ms
                                 ─────────
Target total:                    ~350–450ms
```

### Why the floor is ~320ms

The browser is in Saudi Arabia; the server is in Singapore. Every HTTP request travels ~6000 km each way at the speed of light through undersea fiber. This physical constraint cannot be optimized away in software — it would require either:

- A CDN edge cache (for read-heavy, static-ish data like announcements)
- A second server region closer to KSA (e.g., AWS Bahrain `me-south-1`)

---

## 7. Remaining Opportunities

These were identified but not yet implemented. Ranked by estimated impact:

| Opportunity | Impact | Complexity |
|-------------|--------|------------|
| Cache announcements in Redis (TTL 60s) | High | Medium |
| Wire BullMQ (`queue.service.js`) for async email processing | Medium | Medium |
| Supabase connection pooling via PgBouncer (enabled by default on Supabase) | Low | None — already active |
| CDN edge caching for public announcement reads | Medium | Medium |
| `milestones.controller.js` email block — 3 sequential queries (groups → members → profiles) | Low | Low — fire-and-forget, non-blocking |
| `auth.controller.js` `repairGroups` — N+1 per registration row | Low | High — complex function |
| `roles.controller.js` `getCoordinators` — sequential fallback paths | Low | Medium |
