# Email Verification Setup Guide

## How Email Verification Works

Email verification is tracked by **Supabase Auth** using the `email_confirmed_at` field in the `auth.users` table. When a user signs up:

1. Supabase creates a user record with `email_confirmed_at = NULL`
2. If email confirmation is enabled, Supabase sends a confirmation email
3. When the user clicks the link, `email_confirmed_at` is set to the current timestamp
4. Users cannot sign in until `email_confirmed_at` is set

## The Problem

If you're seeing "Email not verified" errors but not receiving emails, it's because:

- **Email confirmation is enabled** in Supabase settings
- **But SMTP/email service is not configured**, so emails aren't being sent
- Users can't verify because they never receive the confirmation link

## Solutions

### Option 1: Disable Email Confirmation (Development)

**Best for:** Local development and testing

1. Go to Supabase Dashboard → Your Project
2. Navigate to **Authentication** → **Settings** → **Email Auth**
3. Find **"Enable email confirmations"**
4. **Turn it OFF**
5. Users can now sign in immediately after signup

**Note:** This is fine for development but **NOT recommended for production**.

### Option 2: Configure SMTP (Production)

**Best for:** Production environments

Supabase supports multiple email providers:

#### A. Using Supabase's Built-in Email (Limited)

Supabase provides basic email sending, but it's limited and may not work reliably.

#### B. Using Custom SMTP (Recommended)

1. Go to Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider:
   - **Gmail**: Use App Password (not regular password)
   - **SendGrid**: Use SMTP credentials
   - **Mailgun**: Use SMTP credentials
   - **AWS SES**: Use SMTP credentials
   - **Any SMTP provider**: Standard SMTP settings

3. Fill in:
   - **SMTP Host**: e.g., `smtp.gmail.com`
   - **SMTP Port**: e.g., `587` (TLS) or `465` (SSL)
   - **SMTP User**: Your email or API username
   - **SMTP Password**: Your email password or API key
   - **Sender Email**: The "from" address
   - **Sender Name**: Display name (e.g., "Kids Call Home")

4. **Test** the configuration
5. Save settings

#### C. Using Hostinger SMTP (For Hostinger Customers)

If you have a Hostinger hosting account with email:

1. Go to Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
2. Configure Hostinger SMTP:
   - **SMTP Host**: `smtp.hostinger.com` (or `smtp.titan.email` for Titan Email)
   - **SMTP Port**: `465` (SSL) or `587` (TLS)
   - **SMTP User**: Your Hostinger email (e.g., `noreply@kidscallhome.com`)
   - **SMTP Password**: Your email password
   - **Sender Email**: Same as SMTP User
   - **Sender Name**: `Kids Call Home`

3. **Test** the configuration using Supabase's test button
4. Save settings

**Note:** Hostinger SMTP works for Supabase Auth emails (signup confirmation, password reset). For family member invitation emails sent via edge functions, use Resend API instead (see below).

#### D. Using Resend API (Recommended for Transactional Emails)

Resend is a modern email API that's easy to set up and works reliably with Supabase Edge Functions:

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain (`kidscallhome.com`)
3. Get your API key
4. Add `RESEND_API_KEY` to Supabase Edge Function secrets:
   - Go to Supabase Dashboard → **Project Settings** → **Edge Functions**
   - Or use CLI: `supabase secrets set RESEND_API_KEY=re_xxxxxxxxx`

**Note:** The codebase uses Resend for:
- Family member invitation emails (`supabase/functions/send-family-member-invitation/index.ts`)
- Beta signup confirmation emails (`supabase/functions/send-beta-signup-confirmation/index.ts`)

Supabase Auth emails (signup confirmation, password reset) should be configured separately using SMTP settings in the dashboard.

### Option 3: Manual Verification (Development/Testing)

**Best for:** Quick testing without email setup

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find the user who needs verification
3. Click on the user
4. Click **"Confirm Email"** or manually set `email_confirmed_at` in the database

**SQL Method:**
```sql
-- Verify a user manually
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'user@example.com';
```

## How to Check Verification Status

### In Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Look for the **"Email Confirmed"** column
3. Green checkmark = verified, Red X = not verified

### In Code:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (user?.email_confirmed_at) {
  // User is verified
} else {
  // User is not verified
}
```

## Resending Confirmation Emails

The login page (`FamilyMemberAuth.tsx`) now includes a **"Resend Confirmation Email"** button that appears when:
- A user tries to sign in with an unverified email
- The error "Email not confirmed" is shown

This uses Supabase's `auth.resend()` method to send a new confirmation email.

## Troubleshooting

### Emails Not Arriving

1. **Check Spam Folder**: Confirmation emails often go to spam
2. **Check SMTP Configuration**: Verify SMTP settings in Supabase Dashboard
3. **Check Email Provider Limits**: Some providers (like Gmail) have sending limits
4. **Check Supabase Logs**: Go to **Logs** → **Auth Logs** to see if emails are being sent
5. **Test SMTP Connection**: Use Supabase's "Test" button in SMTP settings

### Still Not Working?

1. **Disable email confirmation** for development (Option 1)
2. **Manually verify users** in Supabase Dashboard (Option 3)
3. **Check Supabase Status**: Ensure Supabase email service is operational

## Production Checklist

Before going to production:

- [ ] Configure SMTP for Supabase Auth emails (Hostinger or other provider)
- [ ] Configure `RESEND_API_KEY` secret for Edge Function emails
- [ ] Test email delivery (send test confirmation email)
- [ ] Test family member invitation email
- [ ] Verify email templates are customized (optional)
- [ ] Set up email monitoring/alerts
- [ ] Document email provider credentials securely
- [ ] Test the "Resend Confirmation Email" flow

### Environment Variables for Edge Functions

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Variable | Description | Required |
|----------|-------------|----------|
| `RESEND_API_KEY` | Resend API key for sending emails | Yes (for invitations) |
| `SITE_URL` | Your site URL (e.g., `https://kidscallhome.com`) | Recommended |

## Related Files

- `src/pages/FamilyMemberAuth.tsx` - Login page with resend functionality
- `src/pages/FamilyMemberInvite.tsx` - Registration page
- `supabase/functions/send-family-member-invitation/index.ts` - Invitation email function

## Additional Resources

- [Supabase Auth Email Configuration](https://supabase.com/docs/guides/auth/auth-email)
- [Supabase SMTP Settings](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend Documentation](https://resend.com/docs)

