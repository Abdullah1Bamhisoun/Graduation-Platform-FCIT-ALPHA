# Supabase Database

This folder contains all database-related files for the Graduation Platform.

## 📁 Folder Structure

```
supabase/
├── migrations/                    # Database migration files (versioned)
│   └── 20260211000000_initial_schema.sql
├── schema.sql                     # Complete database schema (reference)
├── seed.sql                       # Initial data for development
├── queries.sql                    # Useful SQL queries for common operations
└── README.md                      # This file
```

## 🚀 Quick Start

### 1. Run the Initial Schema

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Copy the contents of `schema.sql`
3. Paste and run it
4. Your database is now set up! ✅

### 2. Seed Initial Data

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Copy the contents of `seed.sql`
3. Paste and run it
4. You now have sample courses! ✅

### 3. Create Test Users

Follow the instructions in [SUPABASE_SETUP.md](../SUPABASE_SETUP.md#5-create-the-admin-user)

## 📝 Using the Queries

The `queries.sql` file contains ready-to-use SQL queries for:
- User management
- Course and group queries
- Submissions and grading
- Weekly reports
- Statistics and analytics

**How to use:**
1. Open `queries.sql`
2. Find the query you need
3. Replace placeholder values (e.g., `USER_UUID_HERE`)
4. Run in Supabase SQL Editor

## 🔄 Migrations

Migration files in `migrations/` are timestamped and applied in order:

```
20260211000000_initial_schema.sql    # First migration
20260212000000_add_new_feature.sql   # Second migration
...
```

### Creating a New Migration

**Option 1: Manual**
```bash
# Create a new file with timestamp
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql
```

**Option 2: Supabase CLI**
```bash
supabase migration new description
```

## 📚 Database Schema Overview

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `courses` | CPIS 498 & 499 courses |
| `groups` | Student project groups |
| `group_members` | Junction table for group membership |
| `milestones` | Project deadlines and deliverables |
| `submissions` | Student submissions |
| `submission_versions` | File version history |
| `submission_feedback` | Grading and feedback |

### Grading Tables

| Table | Description | Max Points |
|-------|-------------|------------|
| `group_deliverable_grades` | Chapters, reports, etc. | 40 marks |
| `supervisor_assessments` | Supervisor evaluation | 20 marks |
| `committee_evaluations` | Committee evaluation | 40 marks |
| `peer_evaluations` | Peer evaluation | 5 marks |

### Additional Tables

- `weekly_reports` - Supervisor weekly progress reports
- `presentation_schedules` - Final presentation scheduling
- `announcements` - System-wide announcements
- `notifications` - User notifications
- `pending_registrations` - Registration approval workflow
- `audit_log` - System activity tracking

## 🔒 Row Level Security (RLS)

All tables have RLS enabled with policies for:
- **Students**: Can view/edit their own data
- **Supervisors**: Can view/edit their groups' data
- **Admins**: Can view/edit everything

## 🛠️ Useful Commands

### Get User UUID by Email
```sql
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
```

### Get Group UUID by Code
```sql
SELECT id, group_code FROM groups WHERE group_code = 'G001';
```

### Check RLS Policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

## 📖 Documentation

- [Supabase Setup Guide](../SUPABASE_SETUP.md)
- [GitHub Integration](../GITHUB_SUPABASE_INTEGRATION.md)
- [Supabase Documentation](https://supabase.com/docs)

## ⚠️ Important Notes

1. **Never commit real user data** - Use seed.sql for test data only
2. **Always use migrations** - Don't manually edit production schema
3. **Test locally first** - Before applying to production
4. **Backup before changes** - Supabase has automatic backups, but be safe

## 🆘 Help

If you encounter issues:
1. Check the [Supabase Setup Guide](../SUPABASE_SETUP.md#troubleshooting)
2. Review the [GitHub Integration Guide](../GITHUB_SUPABASE_INTEGRATION.md#troubleshooting)
3. Check Supabase logs: Dashboard → Settings → Logs
