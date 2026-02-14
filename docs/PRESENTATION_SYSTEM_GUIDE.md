# Presentation & Committee Management System

## Overview
Complete presentation scheduling system with role-based access for Admin, Supervisor, and Student roles. Supports term-based scheduling for CPIS-498 and CPIS-499 courses.

---

## Pages Created

### 1. Admin → Presentation & Committee Management
**Path:** `/admin/presentation-committee`  
**File:** `/pages/admin/PresentationCommittee.tsx`

#### Features
**Two-Column Layout:**
- **Left Panel (420px):** Planning tools, availability pool, unassigned projects
- **Right Panel:** Week calendar grid (Sun-Thu)

**Planning & Capacity:**
- Input fields: Students (498/499), Supervisors, Max Sessions/Day, Session Duration, Buffer
- Computed metrics: Required Slots, Available Slots, Coverage % (with color-coded progress bar)
- Constraints toggles: Limit sessions/day, Avoid same committee twice, Spread evenly

**Live Availability Pool:**
- Real-time list of supervisors with slot counts per day
- Search and filter by supervisor/day
- Status chips: Ready (green) / None (gray)

**Unassigned Projects:**
- Drag source for projects
- Shows: Project Name, Group ID, Course (498/499), Preferred Day, Status
- Drag-and-drop to assign to slots

**Week Calendar Grid:**
- Starts EMPTY - no template
- Click + to add slots in any cell
- Slot states: Empty, Supervisor-offered, Assigned
- Drag slots to move, drag edges to resize
- Click slot → Slot Drawer for editing

**Slot Management:**
- Create: Day, Start, End, Room, Supervisor
- Edit: Move, resize, change room/supervisor
- Assign: Drag project from left panel
- Unassign/Reassign/Delete options
- Conflict indicators: Red outline (double-booked), amber dot (buffer conflict)

**Auto-Assign:**
- Modal with options: Prefer day, Balance load, Avoid back-to-back
- Preview differences before applying

**Publishing:**
- Publish button sends notifications:
  - Supervisors: "You have X assigned presentations"
  - Students: "Your presentation is scheduled on [date time]"
- Confirmation dialog with summary stats

**Audit Trail:**
- Changes Log tab
- Shows: who/when/what (create/assign/reassign/delete/edit)
- Timeline view with color-coded events

**Controls:**
- Undo/Redo buttons (top-right)
- Term selector, Course toggle (498/499/Both), Week picker
- Add Week, Download Schedule, Auto-Assign, Reset, Publish

---

### 2. Supervisor → My Availability
**Path:** `/supervisor/my-availability`  
**File:** `/pages/supervisor/MyAvailability.tsx`

#### Features
**Header:**
- Term selector
- Course filter (498/499/Both)
- Info banner with session duration, buffer, max sessions

**Week Calendar (Sun-Thu):**
- Click any cell to create availability block
- Click green block to edit/delete
- Popover editor: Day, Start Time, End Time
- Shows slot count preview
- Conflict warnings if exceeding max sessions/day

**Right Sidebar:**
**Offered Slots Summary:**
- Counts by day (Sun-Thu)
- Total slots available
- Max Sessions Per Day input
- "Allow back-to-back" toggle
- Save Availability button (green)

**Assigned Sessions (Read-Only):**
- Shows: Date, Time, Room, Project Name only
- No student details (privacy)
- Confirmation badge

**Guidance Panel:**
- Instructions for creating/editing availability
- Privacy notice

---

### 3. Student → My Presentation Slot
**Path:** `/student/my-presentation`  
**File:** `/pages/student/MyPresentation.tsx`

#### Features

**Before Publish (Empty State):**
- Calendar icon
- "Presentation Not Scheduled Yet"
- Message: "You'll be notified once assigned"
- Alert icon with reminder

**After Publish (Assigned):**

**Main Card (Gradient Background):**
- Course badge (498/499)
- Confirmation badge (green)
- Project name
- 4 info cards:
  1. Date (with calendar icon)
  2. Time (with clock icon + duration)
  3. Location/Room (with pin icon)
  4. Group (with users icon + reminder)

**Action Buttons:**
- Add to Calendar (blue)
- Download Schedule (outline)
- Request Change (amber)

**Important Information Section:**
- Arrive 10 minutes early
- All members must attend
- Backup materials needed
- Professional attire required
- Q&A session info

**Preparation Checklist:**
- Interactive checkboxes:
  - Presentation slides completed
  - Demo/prototype ready
  - Final report submitted
  - Backup materials prepared
  - Rehearsed with group

**Request Change Dialog:**
- Warning about approval needed
- Valid reasons listed
- Textarea for detailed reason
- Submit button

---

## Data Flow

### Workflow
1. **Supervisor** creates availability blocks → saved to availability pool
2. **Admin** sees live availability counts per supervisor/day
3. **Admin** creates empty week grid
4. **Admin** adds slots (day/time/room/supervisor) → becomes "offered" slots
5. **Admin** drags projects from unassigned list → drops on slots → becomes "assigned"
6. **Admin** can edit/move/resize/reassign/delete anytime
7. **Admin** publishes schedule → notifications sent
8. **Supervisor** sees assigned sessions (project name only)
9. **Student** sees their presentation details (date/time/room)
10. **Student** can request change → Admin gets alert

### Visibility Rules
- **Supervisor:** Only sees their own availability + assigned sessions (project name only, no student details)
- **Student:** Only sees their own project details (name, date, time, room)
- **Admin:** Sees everything (full control)

---

## Technical Features

### Components Created
- Slot/Cell variants (empty, offered, assigned, hover, conflict)
- Drawer/Slot Details dialog (create/edit mode)
- Availability Block component (create/edit/resize)
- Project Chip (draggable with course badge)
- Progress bars (coverage %)
- Status badges (Ready/None/Unassigned/Assigned)
- Modals: Auto-Assign, Publish Confirm, Change Request
- Toast notifications (success/error)

### State Management
- Term-based scheduling (independent per semester)
- History stack for undo/redo
- Real-time slot calculations
- Conflict detection
- Drag-and-drop state

### Calculations
- Required slots = total students
- Available slots = supervisor availability sum
- Coverage % = (available / required) × 100
- Slots per block = (end - start) / (duration + buffer)
- Color coding: Red <90%, Amber 90-100%, Green >100%

### Conflict Detection
- Double-booked supervisors (red outline)
- Buffer violations (amber dot)
- Exceeds max sessions/day warning

---

## Routes Added

```typescript
// Student
<Route path="/student/my-presentation" element={<StudentMyPresentation />} />

// Supervisor
<Route path="/supervisor/my-availability" element={<SupervisorMyAvailability />} />

// Admin
<Route path="/admin/presentation-committee" element={<AdminPresentationCommittee />} />
```

---

## Key Interactions

### Admin Page
1. **Create slot:** Click + in calendar cell → Dialog opens → Fill details → Save
2. **Assign project:** Drag from left panel → Drop on slot → Assigned
3. **Edit slot:** Click slot → Dialog opens → Modify → Save
4. **Move slot:** Drag slot to new cell
5. **Resize slot:** Drag bottom edge
6. **Unassign:** Click slot → Unassign button
7. **Delete:** Click slot → Delete button
8. **Auto-assign:** Click Auto-Assign → Set preferences → Preview → Apply
9. **Publish:** Click Publish → Confirm → Notifications sent
10. **Undo/Redo:** Click buttons to navigate history

### Supervisor Page
1. **Create availability:** Click empty cell → Popover → Set times → Save
2. **Edit availability:** Click green block → Popover → Modify → Save
3. **Delete availability:** Click block → Popover → Delete button
4. **Save all:** Click Save Availability button
5. **View assigned:** See read-only cards at bottom

### Student Page
1. **View details:** See main card with all info
2. **Add to calendar:** Click button → Downloads .ics file
3. **Request change:** Click button → Dialog → Write reason → Submit
4. **Check preparation:** Use interactive checklist

---

## Notifications

### On Publish
**Supervisors receive:**
```
Subject: Presentation Committee Assignment
Body: You have 3 assigned presentations this week.
- Mon 9:00 AM: Project A
- Tue 10:00 AM: Project B  
- Wed 2:00 PM: Project C
```

**Students receive:**
```
Subject: Presentation Scheduled
Body: Your presentation is scheduled on Monday, Dec 2, 2024 at 9:00 AM in Room A-101.
Please arrive 10 minutes early.
```

---

## Validation Rules

### Admin
- End time must be after start time
- Room field required
- Supervisor field required  
- No overlapping slots for same supervisor (warns with red border)
- Buffer must be respected between slots

### Supervisor
- End time must be after start time
- Cannot exceed max sessions per day (warns in header)
- Availability must be during standard hours (8:00-17:00)

### Student
- Change request requires non-empty reason
- Cannot request change after presentation date

---

## Success Criteria ✓

✅ Per-term Sun-Thu planning  
✅ Admin can see available supervisors (live counts)  
✅ Build schedule without template (start empty)  
✅ Edit anytime (move/resize/change/reassign/delete)  
✅ Supervisor availability collected before scheduling  
✅ Strict visibility (project name only for supervisors)  
✅ Drag-and-drop assignment  
✅ Conflict detection  
✅ Undo/redo functionality  
✅ Auto-assign with preview  
✅ Publishing with notifications  
✅ Audit trail  
✅ Light theme only  

---

## Usage Example

### As Admin:
1. Navigate to `/admin/presentation-committee`
2. Select term "2026-01" and course "Both"
3. Input: 25 students (498), 18 students (499), 4 supervisors
4. Check availability pool - see supervisors with slot counts
5. Click + in Mon 9:00 cell → Create slot → Room A-101 → Dr. Ahmad → Save
6. Drag "Graduation Project Platform" from left → Drop on slot
7. Repeat for more slots
8. Click Auto-Assign for remaining projects
9. Click Publish → Confirm → Done!

### As Supervisor:
1. Navigate to `/supervisor/my-availability`
2. Select term "2026-01"
3. Click Mon 9:00 cell → Set 9:00-12:00 → Save
4. Click Tue 10:00 cell → Set 10:00-14:00 → Save
5. Click "Save Availability" button
6. Wait for admin to assign presentations
7. See assigned sessions at bottom (project names only)

### As Student:
1. Navigate to `/student/my-presentation`
2. Before publish: See empty state "Not scheduled yet"
3. After publish: See beautiful card with all details
4. Click "Add to Calendar" to download event
5. Use checklist to prepare for presentation
6. If needed: Click "Request Change" and explain reason

---

## Future Enhancements

- Email integration for notifications
- Calendar export (.ics file generation)
- Room availability checking
- Equipment requests
- Committee member selection
- Rubric/grading integration
- Mobile-responsive optimizations
- Real-time collaboration (WebSocket)
- Recurring availability patterns

---

## Files Created

```
/pages/admin/PresentationCommittee.tsx (550+ lines)
/pages/supervisor/MyAvailability.tsx (350+ lines)
/pages/student/MyPresentation.tsx (300+ lines)
/PRESENTATION_SYSTEM_GUIDE.md (this file)
```

Updated:
```
/App.tsx (added routes and imports)
```

---

**Total Lines of Code:** ~1,200+  
**Components:** 15+  
**Features:** 40+  
**Role-based Pages:** 3
