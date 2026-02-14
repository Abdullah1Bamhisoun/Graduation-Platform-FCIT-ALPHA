# 🔗 Linking Supabase with GitHub

This guide explains how to integrate your Supabase project with your GitHub repository for seamless database migrations and version control.

## 📖 Table of Contents

1. [Why Link GitHub with Supabase?](#why-link-github-with-supabase)
2. [Prerequisites](#prerequisites)
3. [Method 1: GitHub Integration (Recommended)](#method-1-github-integration-recommended)
4. [Method 2: Supabase CLI with Git](#method-2-supabase-cli-with-git)
5. [Managing Migrations](#managing-migrations)
6. [Best Practices](#best-practices)

---

## Why Link GitHub with Supabase?

✅ **Version Control**: Track all database schema changes in Git
✅ **Team Collaboration**: Multiple developers can work on database changes
✅ **Automatic Deployments**: Deploy schema changes automatically via CI/CD
✅ **Rollback Capability**: Easily revert to previous database states
✅ **Migration History**: Clear audit trail of all database modifications

---

## Prerequisites

Before you begin, ensure you have:

- ✅ A Supabase project created (from [SUPABASE_SETUP.md](SUPABASE_SETUP.md))
- ✅ A GitHub repository for your project (this one!)
- ✅ Admin access to both Supabase and GitHub
- ✅ Git installed locally
- ✅ Node.js and npm installed (for Supabase CLI)

---

## Method 1: GitHub Integration (Recommended)

This method connects your Supabase project directly to your GitHub repository.

### Step 1: Connect GitHub to Supabase

1. **Go to your Supabase Project Dashboard**
   - URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID`

2. **Navigate to Settings → Integrations**
   - Click on the **gear icon** (⚙️) in the bottom left
   - Select **"Integrations"** from the settings menu

3. **Enable GitHub Integration**
   - Find the **GitHub** section
   - Click **"Connect to GitHub"**
   - You'll be redirected to GitHub to authorize Supabase

4. **Authorize Supabase**
   - GitHub will ask for permissions to access your repositories
   - Click **"Authorize Supabase"**
   - You may need to select which organization/repos to grant access to

5. **Select Your Repository**
   - Back in Supabase, select your repository from the dropdown
   - For this project: **`-Graduation-Platform-FCIT-ALPHA`**
   - Choose the branch: **`main`** (or your default branch)

6. **Configure the Migration Path**
   - Set the migrations folder path: **`supabase/migrations`**
   - This tells Supabase where to look for migration files

7. **Save the Configuration**
   - Click **"Connect"** or **"Save"**
   - Your GitHub repo is now linked! 🎉

### Step 2: Verify the Connection

1. In Supabase Dashboard, go to **Database → Migrations**
2. You should see a message indicating GitHub is connected
3. Any migrations in your `supabase/migrations` folder will appear here

---

## Method 2: Supabase CLI with Git

This method uses the Supabase CLI to manage migrations locally and push them to Git.

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

Or using Homebrew (Mac/Linux):
```bash
brew install supabase/tap/supabase
```

### Step 2: Initialize Supabase in Your Project

```bash
cd /workspaces/-Graduation-Platform-FCIT-ALPHA
supabase init
```

This creates a `supabase` directory with:
- `supabase/config.toml` - Project configuration
- `supabase/migrations/` - Migration files
- `supabase/seed.sql` - Seed data

### Step 3: Link Your Local Project to Supabase

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

**To find your Project ID:**
- Go to Supabase Dashboard → Settings → General
- Copy the **Reference ID** (looks like `abcdefghijklmnop`)

You'll be prompted to enter your database password (the one you set when creating the project).

### Step 4: Generate Migration from Existing Schema

Since you already have a schema, let's create a migration file:

```bash
# Pull the current remote schema
supabase db pull

# This creates a new migration file with your current database schema
```

Or manually create a migration:

```bash
supabase migration new initial_schema
```

Then copy your `schema.sql` content into the generated migration file.

### Step 5: Push Your Migrations to Supabase

```bash
# Apply all pending migrations to your Supabase project
supabase db push
```

### Step 6: Commit to Git

```bash
git add supabase/
git commit -m "Add Supabase migrations"
git push origin main
```

---

## Managing Migrations

### Creating a New Migration

Whenever you need to change your database schema:

#### Option A: Using SQL

```bash
# Create a new migration file
supabase migration new add_new_table

# Edit the generated file in supabase/migrations/
# Add your SQL changes
```

Example: `supabase/migrations/20260211120000_add_new_table.sql`
```sql
-- Add a new table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view new_table"
  ON new_table FOR SELECT
  USING (true);
```

#### Option B: Using the Dashboard

1. Make changes in Supabase Dashboard SQL Editor
2. Pull the changes locally:
   ```bash
   supabase db pull
   ```
3. Review and commit the generated migration

### Applying Migrations

#### To Local Development Database:
```bash
supabase db reset
```

#### To Remote Supabase Project:
```bash
supabase db push
```

### Viewing Migration Status

```bash
# Check which migrations have been applied
supabase migration list
```

---

## Best Practices

### ✅ DO:

1. **Always create migrations for schema changes**
   - Never manually edit the database in production
   - All changes should go through migration files

2. **Use descriptive migration names**
   ```bash
   supabase migration new add_user_preferences_table
   supabase migration new update_groups_add_archived_column
   ```

3. **Test migrations locally first**
   ```bash
   # Start local Supabase
   supabase start

   # Test your migration
   supabase db reset

   # If successful, push to remote
   supabase db push
   ```

4. **Commit migrations to Git immediately**
   - This ensures your team has the latest schema changes
   - Enables rollback if needed

5. **Keep migrations small and focused**
   - One migration = one logical change
   - Easier to review and debug

6. **Add rollback/down migrations when possible**
   ```sql
   -- Migration up
   ALTER TABLE profiles ADD COLUMN nickname TEXT;

   -- Migration down (for rollback)
   -- ALTER TABLE profiles DROP COLUMN nickname;
   ```

### ❌ DON'T:

1. **Never edit old migration files**
   - Once applied, they're immutable
   - Create a new migration to fix mistakes

2. **Don't commit sensitive data in migrations**
   - No passwords, API keys, or real user data
   - Use seed files for test data only

3. **Don't skip migrations**
   - Always apply them in order
   - Never manually create tables/columns to "skip ahead"

4. **Avoid making schema changes directly in production**
   - Use migrations to maintain consistency

---

## Automation with GitHub Actions

Create a CI/CD pipeline to automatically apply migrations when you push to GitHub.

### Create `.github/workflows/supabase-migrations.yml`:

```yaml
name: Deploy Supabase Migrations

on:
  push:
    branches:
      - main
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Apply migrations
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

### Add GitHub Secrets:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `SUPABASE_PROJECT_ID`: Your Supabase project reference ID
   - `SUPABASE_ACCESS_TOKEN`: Generate from Supabase Dashboard → Settings → API → Generate new access token
   - `SUPABASE_DB_PASSWORD`: Your database password

---

## Troubleshooting

### Error: "Project not linked"
```bash
supabase link --project-ref YOUR_PROJECT_ID
```

### Error: "Migration already applied"
- Check migration status: `supabase migration list`
- The migration was already run, create a new one for additional changes

### Error: "Authentication failed"
- Verify your database password is correct
- Check that your access token has proper permissions

### Migrations out of sync
```bash
# Reset local database to match remote
supabase db reset

# Or pull latest schema from remote
supabase db pull
```

---

## Quick Reference Commands

```bash
# Install CLI
npm install -g supabase

# Initialize project
supabase init

# Link to remote project
supabase link --project-ref YOUR_PROJECT_ID

# Create new migration
supabase migration new migration_name

# Apply migrations locally
supabase db reset

# Apply migrations to remote
supabase db push

# Pull remote schema
supabase db pull

# Check migration status
supabase migration list

# Start local Supabase
supabase start

# Stop local Supabase
supabase stop
```

---

## What's Next?

Now that your GitHub and Supabase are connected:

1. ✅ All schema changes should be in migration files
2. ✅ Commit migrations to Git for version control
3. ✅ Team members can pull and apply migrations locally
4. ✅ Set up CI/CD for automatic deployments
5. ✅ Focus on building features, not managing infrastructure!

---

## Resources

- [Supabase Migrations Documentation](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [GitHub Actions for Supabase](https://github.com/marketplace/actions/supabase-cli-action)
- [Database Migration Best Practices](https://supabase.com/docs/guides/database/migrations)
