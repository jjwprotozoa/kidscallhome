# Kids Call Home

A family communication app that helps parents, family members, and children stay connected through simple video
calls and messaging.

**Domain**: <https://www.kidscallhome.com>

**Lovable Project URL**: <https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5>

## About

Kids Call Home is a safe kids messaging and video calling app built by a long‑distance parent who needed a
simple, reliable way for his children to call him from any home, country, or device. The app is designed as a
safe kids messenger and family communication tool, not a social network: there are no public profiles, no
strangers, no filters hiding faces, and no addictive feeds. Parents can create accounts, add their children,
and manage access. Family members (grandparents, aunts, uncles, and other trusted adults) can be invited to
connect with children. Children can use a special code to easily initiate video calls and send messages to
their parents and family members. The app works on most phones and tablets over Wi‑Fi or mobile data, without
requiring a phone number or SIM card, keeping families connected anytime, anywhere.

## Authentication Flow

### Parent Authentication

Parents sign up with email and password. Upon registration, each parent account is automatically assigned a
unique **Family Code** (6-character alphanumeric code). This family code is shared with all children in the
family.

### Child Authentication

Children log in using a three-part code system:

1. **Family Code** - The 6-character code assigned to their family (e.g., "ABC123")
2. **Color or Animal** - A visual selection (e.g., "blue" or "cat")
3. **Number** - A number between 1-99

**Full Login Format**: `familyCode-color/animal-number`
**Example**: `ABC123-blue-19` or `ABC123-cat-7`

This multi-part authentication system:

- Dramatically reduces accidental cross-account logins
- Improves scalability by isolating families
- Maintains child-friendly simplicity with visual selections
- Ensures each family code is unique across the platform

## Device Management

Parents can view and manage all devices authorized to access their family account through the Device Management
page (`/parent/devices`). Features include:

- **Automatic Device Tracking**: Devices are tracked when parents or children log in
- **Device Details**: View device name, type, last login time, IP address, and which child used it
- **Device Management**: Rename devices for easy recognition or remove devices for security
- **Security**: Device removal requires password re-authentication
- **Visual Indicators**: Stale devices (unused for 30+ days) are highlighted

See `docs/DEVICE_MANAGEMENT.md` for detailed documentation.

## Billing

KidsCallHome uses Stripe for subscription billing with monthly and annual plans. The billing system is
integrated with Supabase Edge Functions and uses a dedicated `billing_subscriptions` table as the source of
truth for access/entitlements.

**Key Features:**

- Stripe Checkout for new subscriptions
- Stripe Customer Portal for self-serve management
- In-app subscription switching (Monthly ↔ Annual) with automatic proration
- Webhook-based subscription state synchronization

**Price IDs:**

- Monthly: `price_1SUVdqIIyqCwTeH2zggZpPAK`
- Annual: `price_1SkPL7IIyqCwTeH2tI9TxHRB`

See `docs/BILLING.md` for complete billing integration documentation, including:

- Database schema
- Edge function APIs
- Testing with Stripe CLI
- Deployment checklist
- Troubleshooting guide

### Local Webhook Testing

For local development, use the Stripe CLI to forward webhooks to a local server:

1. **Install dependencies** (if not already installed):

   ```sh
   npm install
   ```

2. **Set environment variables**:

   ```sh
   # Required for webhook server
   export STRIPE_SECRET_KEY=sk_test_...
   export STRIPE_WEBHOOK_SECRET=whsec_...

   # Optional: For database updates
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   On Windows PowerShell:

   ```powershell
   $env:STRIPE_SECRET_KEY="sk_test_..."
   $env:STRIPE_WEBHOOK_SECRET="whsec_..."

   # Optional: For database updates
   $env:SUPABASE_URL="https://your-project.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. **Start the local webhook server**:

   **Option A: Automatic setup (recommended)** - Sets environment variables automatically:

   ```powershell
   npm run stripe:webhook:start
   ```

   **Option B: Manual setup** - Set environment variables first, then run:

   ```powershell
   $env:STRIPE_SECRET_KEY="sk_test_..."
   $env:STRIPE_WEBHOOK_SECRET="whsec_..."
   $env:SUPABASE_URL="https://itmhojbjfacocrpmslmt.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   npm run stripe:webhook
   ```

   The server will listen on <http://127.0.0.1:4242/webhook>

4. **Forward webhooks with Stripe CLI** (in a separate terminal):

   ```sh
   stripe listen --forward-to http://127.0.0.1:4242/webhook
   ```

5. **Test webhook events**:

   ```sh
   stripe trigger checkout.session.completed
   ```

The webhook server logs all received events and verifies Stripe signatures. Database updates will be added in
a future update.

## How can I edit this code?

There are several ways of editing your application.

### Use Lovable

Simply visit the [Lovable Project](https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5) and start
prompting.

Changes made via Lovable will be committed automatically to this repo.

### Use your preferred IDE

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will
also be reflected in Lovable.

The only requirement is having Node.js & npm installed -
[install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Edit a file directly in GitHub

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

### Use GitHub Codespaces

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

### Core Framework & Build Tools

- **Vite 7.2** - Build tool and development server
- **TypeScript 5.8** - Type-safe JavaScript
- **React 18.3** - UI framework
- **React Router DOM 6.30** - Client-side routing

### UI & Styling

- **Tailwind CSS 3.4** - Utility-first CSS framework
- **shadcn/ui** (Radix UI) - Accessible component library
  - Dialog, Dropdown, Select, Toast, and 20+ other primitives
- **Lucide React** - Icon library
- **next-themes** - Theme management (dark/light mode)

### State Management & Data Fetching

- **Zustand 5.0** - Lightweight state management
- **TanStack React Query 5.83** - Server state management and caching
  - Automatic background refetching
  - Optimistic updates
  - Query persistence

### Backend & Database

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication (email/password, magic links)
  - Real-time subscriptions
  - Storage for media files
  - Edge Functions for serverless APIs

### Forms & Validation

- **React Hook Form 7.61** - Performant form management
- **Zod 3.25** - Schema validation
- **@hookform/resolvers** - Zod integration for forms

### Mobile (Native Apps)

- **Capacitor 6.0** - Native mobile wrapper
  - Android & iOS support
  - Push notifications
  - Local notifications
  - Device info, haptics, keyboard, status bar

### Payments

- **Stripe 14.21** - Payment processing and subscription management
  - Stripe Checkout for new subscriptions
  - Customer Portal for self-serve management
  - Webhook-based subscription synchronization

### Additional Libraries

- **date-fns 2.30** - Date formatting and manipulation
- **recharts 2.15** - Charting library
- **sonner** - Toast notifications
- **cmdk** - Command palette component
- **embla-carousel-react** - Carousel component
- **react-day-picker** - Date picker
- **vaul** - Drawer component
- **input-otp** - OTP input component

### Testing

- **Vitest 4.0** - Fast unit test runner
- **@testing-library/react** - React component testing utilities
- **jsdom** - DOM environment for tests

### Development Tools

- **ESLint 9.32** - Code linting
- **TypeScript ESLint** - TypeScript-specific linting rules
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

### Deployment & Analytics

- **Vercel** - Hosting and deployment platform
- **@vercel/analytics** - Web analytics
- **@vercel/speed-insights** - Performance monitoring

### PWA Support

- **vite-plugin-pwa** - Progressive Web App features (service worker, offline support)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2e0bb7b7-ec23-4451-b444-265fa544e4b5) and click on Share ->
Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
