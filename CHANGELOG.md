# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2025-01-23

#### Billing Integration
- **Stripe Billing System**: Implemented comprehensive Stripe billing integration with flat-rate subscriptions
  - Created `billing_subscriptions` table as source of truth for subscription state
  - Added RLS policies: users can read their own subscription, only service role can write
  - Implemented four Supabase Edge Functions:
    - `stripe-create-checkout-session`: Creates Stripe Checkout sessions for new subscriptions
    - `stripe-create-portal-session`: Creates Stripe Customer Portal sessions for subscription management
    - `stripe-change-subscription`: Modifies subscription prices with proration control (immediate or next cycle)
    - `stripe-webhook`: Handles Stripe webhook events (checkout completion, subscription updates, payment events)
  - Updated webhook handler to use `billing_subscriptions` table instead of `parents` table
  - Added billing service wrapper module (`_shared/billing-service.ts`) for centralized configuration
  - Updated Upgrade page (`/parent/upgrade`) to support:
    - Monthly and annual subscription signup via Stripe Checkout
    - Customer Portal access for subscription management
    - In-app subscription switching (Monthly ↔ Annual) with automatic proration policy
  - Price IDs:
    - Monthly: `price_1SUVdqIIyqCwTeH2zggZpPAK`
    - Annual: `price_1SkPL7IIyqCwTeH2tI9TxHRB`
    - Product: `prod_TROQs4IwtU17Fv`
  - Proration policy:
    - Monthly → Annual: immediate billing (upgrade)
    - Annual → Monthly: next cycle (downgrade via Subscription Schedule)
  - Security: Webhook signature verification uses raw body (not parsed JSON)
  - Documentation: Added `docs/BILLING.md` with complete billing integration guide

### Changed
- Updated `useSubscriptionData` hook to read from `billing_subscriptions` table
- Updated `usePaymentHandlers` hook to use new edge function names and price IDs
- Modified webhook handlers to upsert `billing_subscriptions` records

### Technical Details
- Migration: `supabase/migrations/20250123000000_create_billing_subscriptions.sql`
- Edge Functions: All functions use centralized billing service for price ID validation and Stripe key management
- Frontend: Upgrade page now supports both checkout flow and in-app subscription switching

