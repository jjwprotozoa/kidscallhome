# Switching to Project: itmhojbjfacocrpmslmt

## Step 1: Get API Keys from Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
2. Click on "Settings" (gear icon) → "API"
3. Copy:
   - **Project URL**: `https://itmhojbjfacocrpmslmt.supabase.co`
   - **anon/public key**: (under "Project API keys")

## Step 2: Update .env File

Update your `.env` file with the new project credentials:

```env
VITE_SUPABASE_URL=https://itmhojbjfacocrpmslmt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[paste your anon key here]
VITE_SUPABASE_PROJECT_ID="itmhojbjfacocrpmslmt"
```

## Step 3: Run Database Migrations

Since this is a different project, you need to run all the migration scripts:

1. **Create children table** (if it doesn't exist):
   - Run the children table creation from `RUN_THIS_IN_SUPABASE.sql` (Step 1.5)

2. **Transform calls table**:
   - Run `RUN_THIS_IN_SUPABASE.sql` in the SQL Editor
   - This will create/transform the calls table and set up all policies

3. **Verify setup**:
   - Run `verify_database_state.sql` to check everything is set up correctly

## Step 4: Restart Your Dev Server

After updating `.env`, restart your development server:
```bash
npm run dev
```

## Important Notes

- This project (`itmhojbjfacocrpmslmt`) is separate from `oqvbdusfggivygwexbxt`
- All data and migrations need to be set up in this new project
- Make sure to run all SQL scripts in the `itmhojbjfacocrpmslmt` project dashboard

