# GPP Database - Setup Guide

## 📁 What's in this folder?

| File | Purpose |
|------|---------|
| `schema.sql` | Creates all database tables |
| `seed.sql` | Adds sample test data |
| `gpp.db` | Your SQLite database file (created after setup) |

---

## 🚀 Quick Setup in GitHub Codespace

### Step 1: Open Terminal
In your GitHub Codespace, open a terminal (Ctrl + ` or Terminal → New Terminal)

### Step 2: Navigate to database folder
```bash
cd gpp-database
```

### Step 3: Create the database
```bash
# This creates gpp.db and runs schema.sql
sqlite3 gpp.db < schema.sql
```

### Step 4: Add sample data
```bash
# This populates the database with test data
sqlite3 gpp.db < seed.sql
```

### Step 5: Verify it worked
```bash
# Open the database
sqlite3 gpp.db

# Inside SQLite, run these commands:
.tables                          # Shows all tables
SELECT * FROM users;             # Shows all users
SELECT * FROM projects;          # Shows all projects
.quit                            # Exit SQLite
```

---

## 📊 Database Overview

### How Users Connect to Roles

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS TABLE                          │
│  (Everyone logs in here - email + password)                  │
│                                                              │
│  user_id | email              | name           | role        │
│  --------|--------------------|-----------------|-----------  │
│  1       | coord@kau.edu.sa   | Dr. Ahmad      | coordinator │
│  3       | h.labani@kau...    | Dr. Hasan      | supervisor  │
│  6       | asolymani@stu...   | Abdulrahman    | student     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ role determines which detail table
                              ▼
    ┌─────────────────┬─────────────────┬─────────────────┐
    │    STUDENTS     │   SUPERVISORS   │     ADMINS      │
    │   (user_id=6)   │   (user_id=3)   │   (user_id=1)   │
    │                 │                 │                 │
    │ - university_id │ - expertise     │ - admin_type    │
    │ - group_id      │ - max_groups    │ - department    │
    │ - track         │ - office        │                 │
    └─────────────────┴─────────────────┴─────────────────┘
```

### How Data Flows

```
COURSE (CPIS-498)
    │
    ├── MILESTONES (deadlines)
    │       │
    │       └── RUBRICS (grading criteria)
    │
    └── GROUPS (student teams)
            │
            ├── STUDENTS (2-3 per group)
            │
            ├── SUPERVISOR (1 per group)
            │
            └── PROJECT (1 per group)
                    │
                    ├── SUBMISSIONS (files uploaded)
                    │       │
                    │       ├── FEEDBACK (comments)
                    │       │
                    │       └── EVALUATIONS (grades)
                    │
                    └── WEEKLY_REPORTS (progress)
```

---

## 🔑 Main Tables Explained

### 1. **users** - Everyone's login info
- All users (students, supervisors, admins) login here
- `role` field determines what they can do

### 2. **students** - Student details
- Links to `users` via `user_id`
- Contains university ID, track, group assignment

### 3. **supervisors** - Supervisor details  
- Links to `users` via `user_id`
- Contains expertise, capacity (max groups)

### 4. **groups** - Student teams
- Each group has students + 1 supervisor
- Each group works on 1 project

### 5. **projects** - The graduation projects
- Belongs to a group
- Has title, description, status, grade

### 6. **milestones** - Deadlines
- Defines what needs to be submitted when
- e.g., "Weekly Report Week 1", "Demo 1", "Final Report"

### 7. **submissions** - Uploaded work
- Files students upload for each milestone
- Tracks version, status (draft/submitted/approved)

### 8. **evaluations** - Grades
- Supervisors grade submissions
- Links to rubrics for detailed scoring

### 9. **feedback** - Comments
- Supervisors give feedback on submissions
- Can be comments, suggestions, or action items

### 10. **notifications** - Alerts
- In-app notifications for users
- Deadline reminders, new feedback, etc.

### 11. **audit_log** - Action history
- Records everything that happens
- For accountability and debugging

---

## 🧪 Test Users (from seed data)

| Role | Email | Name |
|------|-------|------|
| Coordinator | coordinator@kau.edu.sa | Dr. Ahmad Al-Coordinator |
| Supervisor | h.labani@kau.edu.sa | Dr. Hasan Labani |
| Student | asolymani@stu.kau.edu.sa | Abdulrahman Solymani |
| Student | abamhisoun@stu.kau.edu.sa | Abdullah Bamhisoun |

**Note:** All test passwords should be hashed in production. The seed data uses placeholder text.

---

## 🔧 Common SQLite Commands

```bash
# Open database
sqlite3 gpp.db

# Show all tables
.tables

# Show table structure
.schema users
.schema submissions

# Query examples
SELECT * FROM users WHERE role='student';
SELECT * FROM projects;
SELECT * FROM submissions WHERE status='under_review';

# Join example - Get submissions with student names
SELECT u.name, s.file_name, s.status, s.submission_date 
FROM submissions s 
JOIN users u ON s.submitted_by = u.user_id;

# Exit
.quit
```

---

## 📝 Connecting from Node.js

```javascript
// Install: npm install better-sqlite3

const Database = require('better-sqlite3');
const db = new Database('gpp.db');

// Get all students
const students = db.prepare(`
    SELECT u.name, u.email, s.university_id, g.group_name
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN groups g ON s.group_id = g.group_id
`).all();

console.log(students);
```

---

## 🗂 Folder Structure for Your Project

```
your-gpp-project/
├── database/
│   ├── schema.sql      # Table definitions
│   ├── seed.sql        # Test data
│   └── gpp.db          # SQLite database file
├── backend/
│   ├── server.js       # Node.js server
│   └── routes/
│       ├── auth.js     # Login/logout
│       ├── students.js # Student endpoints
│       └── ...
├── frontend/
│   └── ...
└── README.md
```

---

## ❓ Need Help?

1. **Database not created?** Make sure you're in the right folder and SQLite is installed
2. **Permission error?** Try `chmod +x schema.sql seed.sql`
3. **Want to start over?** Delete `gpp.db` and run steps 3-4 again

---

Created for GPP (Graduation Project Platform) - FCIT, King Abdulaziz University
