# ✅ Quick Setup Checklist

Follow these steps **in order** to set up your Graduation Platform:

---

## ☑️ Step 1: Configure Credentials (DONE ✅)

- ✅ Supabase URL configured
- ✅ Anon key configured
- ✅ Service role key configured

**Status:** ✅ **COMPLETE**

---

## ☑️ Step 2: Create Database Schema

### Go to Supabase SQL Editor:
1. Open: https://supabase.com/dashboard/project/bmpnorvnjqzldrinfrop/sql
2. Click **"New query"**

### Copy the Schema:
1. Open: [EXACT_SQL_STEPS.md](EXACT_SQL_STEPS.md#-step-1-create-the-database-schema)
2. Find **"STEP 1: Create the Database Schema"**
3. Copy the **ENTIRE** SQL block (starts with `-- Enable UUID extension`)

### Run the Schema:
1. Paste into SQL Editor
2. Click **"Run"** button (or press `Ctrl/Cmd + Enter`)
3. Wait for: ✅ **"Success. No rows returned"**

### Verify Tables Created:
Run this query:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected:** You should see 20 tables (profiles, courses, groups, etc.)

**Status:** ⬜ **PENDING**

---

## ☑️ Step 3: Seed Initial Courses

### In SQL Editor, run:
```sql
INSERT INTO courses (code, name, term, year) VALUES
  ('CPIS_498', 'Graduation Project I', 'First Semester', 2026),
  ('CPIS_499', 'Graduation Project II', 'Second Semester', 2026);
```

**Expected:** ✅ "Success. 2 rows affected"

**Status:** ⬜ **PENDING**

---

## ☑️ Step 4: Create Admin User

### Option A: Use Script (Recommended)
```bash
node create-admin.js
```

**Expected output:**
```
🔄 Creating admin user...
✅ User created: [uuid]
📧 Email: coordinator@kau.edu.sa
✅ Profile updated successfully!

🎉 Admin user created:
   Email: coordinator@kau.edu.sa
   Password: password123
   UUID: [uuid]
```

### Option B: Via Supabase Dashboard
1. Go to: **Authentication** → **Users** → **Add user**
2. Fill in:
   - Email: `coordinator@kau.edu.sa`
   - Password: `password123`
   - ✅ Auto Confirm User
3. Click **"Create user"**
4. Copy the user's UUID
5. Run this SQL to update profile:
   ```sql
   UPDATE profiles
   SET role = 'admin', employee_number = '0000195847', department = 'CS'
   WHERE id = 'USER_UUID_HERE';
   ```

**Status:** ⬜ **PENDING**

---

## ☑️ Step 5: Test Login

### Start the servers:

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Test login:
1. Open: http://localhost:5173
2. Click **"Login"**
3. Use:
   - Email: `coordinator@kau.edu.sa`
   - Password: `password123`
4. Should redirect to admin dashboard ✅

**Status:** ⬜ **PENDING**

---

## ☑️ Step 6: Link GitHub (Optional)

Follow: [GITHUB_SUPABASE_INTEGRATION.md](GITHUB_SUPABASE_INTEGRATION.md#method-1-github-integration-recommended)

**Status:** ⬜ **OPTIONAL**

---

## 🎉 Completion Checklist

- ✅ Credentials configured
- ⬜ Database schema created
- ⬜ Courses seeded
- ⬜ Admin user created
- ⬜ Login tested
- ⬜ GitHub linked (optional)

---

## 🆘 Troubleshooting

### Error: "Database error creating new user"
- **Cause:** Schema not created yet
- **Fix:** Complete Step 2 (create database schema)

### Error: "relation does not exist"
- **Cause:** Missing tables
- **Fix:** Run STEP 1 schema SQL in SQL Editor

### Can't login
- **Cause:** User not created or wrong credentials
- **Fix:** Verify user exists in Authentication → Users

### RLS blocking queries
- **Cause:** Row Level Security policies
- **Fix:** Make sure you're logged in as admin

---

## 📚 Documentation

- [EXACT_SQL_STEPS.md](EXACT_SQL_STEPS.md) - Step-by-step SQL setup
- [QUICK_QUERIES.sql](supabase/QUICK_QUERIES.sql) - Common queries
- [queries.sql](supabase/queries.sql) - Complete query reference
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Full setup guide
