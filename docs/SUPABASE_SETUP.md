# Supabase Setup Guide

This guide will help you set up Supabase and connect it to your Graduation Platform.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in/sign up
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: Graduation Platform FCIT (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Start with the Free tier
4. Click **"Create new project"**
5. Wait for the project to be provisioned (2-3 minutes)

## 2. Get Your API Keys

Once your project is ready:

1. Go to **Settings** (gear icon) → **API**
2. Find these values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: A long JWT token (starts with `eyJ...`)
   - **service_role key**: Another JWT token (⚠️ Keep this secret!)

## 3. Configure Environment Variables

### Frontend Configuration

Update `/.env` (project root):
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key-here
```

### Backend Configuration

Update `/server/.env`:
```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key-here
```

⚠️ **Important**: Never commit the service_role key to version control!

## 4. Run Database Migrations

### Step 1: Create the Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `/supabase/schema.sql`
4. Paste it into the SQL editor
5. Click **"Run"** or press `Ctrl/Cmd + Enter`
6. You should see a success message: "Success. No rows returned"

### Step 2: Verify Tables Created

1. Go to **Table Editor** (left sidebar)
2. You should see 20 tables including:
   - profiles
   - courses
   - groups
   - milestones
   - submissions
   - pending_registrations
   - and more...

## 5. Create the Admin User

Since Supabase Auth requires user creation via their Dashboard or API, follow these steps:

### Option A: Via Supabase Dashboard (Easiest)

1. Go to **Authentication** → **Users** (left sidebar)
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - **Email**: `coordinator@kau.edu.sa`
   - **Password**: `password123` (or your preferred password)
   - **Auto Confirm User**: ✅ Check this box
4. Click **"Create user"**
5. The user should appear in the list

### Option B: Update Profile Details

After creating the user, run this SQL to update their profile:

1. Go to **SQL Editor**
2. Find the user ID by running:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'coordinator@kau.edu.sa';
   ```
3. Copy the UUID from the result
4. Update the profile:
   ```sql
   UPDATE profiles SET
     role = 'admin',
     employee_number = '0000195847',
     department = 'CS'
   WHERE email = 'coordinator@kau.edu.sa';
   ```
5. Run the query

### Create Test Users (Optional)

Repeat the same process for test users:

**Test Student:**
- Email: `abamhisoun@stu.kau.edu.sa`
- Password: `password123`
- After creation, update profile:
  ```sql
  UPDATE profiles SET
    role = 'student',
    student_id = '2236500',
    department = 'CS'
  WHERE email = 'abamhisoun@stu.kau.edu.sa';
  ```

**Test Supervisor:**
- Email: `h.labani@kau.edu.sa`
- Password: `password123`
- After creation, update profile:
  ```sql
  UPDATE profiles SET
    role = 'supervisor',
    employee_number = '0000482731',
    department = 'CS'
  WHERE email = 'h.labani@kau.edu.sa';
  ```

## 6. Seed Initial Data (Optional)

Run the seed script to create sample courses:

1. Go to **SQL Editor**
2. Copy the contents of `/supabase/seed.sql`
3. Paste and run it

## 7. Test the Connection

### Start the Backend

```bash
cd server
npm run dev
```

You should see:
```
Server running on port 5000
```

If you see any errors about Supabase configuration, double-check your `.env` file.

### Start the Frontend

In a new terminal:

```bash
npm run dev
```

The frontend should start at `http://localhost:5173`

## 8. Test Authentication

1. Open the app in your browser
2. Go to the login page
3. Try logging in with:
   - **Email**: `coordinator@kau.edu.sa`
   - **Password**: `password123` (or whatever you set)
4. You should be redirected to the admin dashboard

## 9. Test Registration Flow

1. Click **"Register"** on the login page
2. Fill out the registration form
3. Submit the registration
4. Log in as admin
5. Go to **User Management**
6. You should see the pending registration
7. Click **"Approve"** to create the user account

## 10. Verify Row Level Security (RLS)

To ensure RLS is working correctly:

1. Go to **Authentication** → **Policies** in Supabase Dashboard
2. You should see policies for each table
3. Try logging in as different user roles and verify:
   - Students can only see their own data
   - Supervisors can see their groups' data
   - Admins can see everything

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Check that your `.env` files have the correct values
- Restart both frontend and backend after updating `.env`
- For Vite (frontend), env vars must start with `VITE_`

### Error: "Invalid login credentials"

- Make sure you created the user in Supabase Dashboard
- Check that the email and password match
- Verify the user was confirmed (Auto Confirm User was checked)

### Error: "User profile not found"

- The profile should be auto-created by the trigger
- If not, manually run the SQL to insert the profile
- Check that the `on_auth_user_created` trigger exists

### Database Connection Issues

- Verify your `SUPABASE_URL` is correct
- Check that your `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Ensure your IP is not blocked (Supabase allows all IPs by default)

### RLS Blocking Queries

- Make sure you're authenticated (check the JWT token is being sent)
- Verify the RLS policies are created correctly
- Check that the `get_user_role()` function exists

## Next Steps

Now that Supabase is connected:

1. ✅ Authentication works with real database
2. ✅ Registration flow stores in database
3. ✅ Admin can approve registrations
4. 🔄 Implement remaining controllers for:
   - Projects
   - Submissions
   - Milestones
   - Evaluations
   - Reports
5. 🔄 Update frontend pages to fetch from Supabase instead of mock data
6. 🔄 Implement file uploads to MinIO
7. 🔄 Set up email notifications

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

## Support

If you encounter any issues:

1. Check the browser console for errors
2. Check the backend logs for errors
3. Check the Supabase logs (Settings → Logs)
4. Refer to this guide and the Supabase documentation
