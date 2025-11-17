# Device Management Feature

## Overview

The Device Management feature allows parents to view and manage all devices that have been used to access their family account. This provides security and control over account access.

## Features

### Device Tracking
- Automatically tracks devices when parents or children log in
- Creates unique device fingerprints based on browser/device characteristics
- Records device type (mobile, tablet, desktop, other)
- Tracks last login time, IP address, and which child used the device

### Device Management Page
- **Location**: `/parent/devices`
- **Access**: Available in parent navigation menu
- **Features**:
  - View all authorized devices
  - See device details (name, type, last login, IP, location)
  - Rename devices for easy recognition
  - Remove/revoke devices (requires password confirmation)
  - Visual indicators for stale devices (not used in 30+ days)

### Security Features
- **Re-authentication Required**: Device removal requires password confirmation
- **Soft Delete**: Devices are marked as inactive rather than deleted (for audit trail)
- **Device Fingerprinting**: Uses browser fingerprinting to identify unique devices
- **IP Tracking**: Records IP addresses for security monitoring

## Database Schema

### Devices Table
```sql
CREATE TABLE public.devices (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES parents(id),
  device_name TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'other')),
  device_identifier TEXT NOT NULL, -- Unique fingerprint
  last_used_child_id UUID REFERENCES children(id),
  last_login_at TIMESTAMPTZ,
  last_ip_address TEXT,
  last_location TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Usage

### For Parents

1. **Access Device Management**:
   - Navigate to Parent Dashboard
   - Click "Devices" in the navigation menu

2. **View Devices**:
   - See all devices that have accessed your family account
   - View device details including last login time and which child used it

3. **Rename Device**:
   - Click "Rename" on any device
   - Enter a friendly name (e.g., "Mom's iPad", "John's Phone")
   - Click "Save"

4. **Remove Device**:
   - Click "Remove" on any device
   - Enter your password to confirm
   - Device will be revoked and require re-authorization on next login

### Automatic Tracking

Devices are automatically tracked when:
- A parent logs in (via `/parent/auth`)
- A child logs in (via `/child/login`)

The system creates or updates device records with:
- Device fingerprint (unique identifier)
- Device type and name
- IP address (if available)
- Last login timestamp
- Which child used the device (for child logins)

## Technical Details

### Device Fingerprinting

The system uses browser fingerprinting to create unique device identifiers:
- User agent string
- Screen resolution
- Timezone
- Platform information
- Canvas fingerprint
- Hardware concurrency
- Device memory

This creates a consistent identifier for the same device/browser combination.

### IP Address Detection

The system attempts to detect IP addresses using:
- External API service (ipify.org)
- Falls back gracefully if unavailable

### Location Detection

Location can be:
- Manually entered by users (future feature)
- Derived from IP geolocation (future feature)
- Currently stored as null until implemented

## Migration

To enable device management, run the migration:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/20250122000000_add_device_management.sql
```

This creates:
- `devices` table
- RLS policies
- Database functions (`update_device_login`, `revoke_device`)
- Indexes for performance

## Security Considerations

1. **Device Removal**: Requires password re-authentication
2. **Soft Delete**: Devices are marked inactive, not deleted (audit trail)
3. **RLS Policies**: Only parents can view/manage their own devices
4. **Non-Critical Tracking**: Device tracking failures don't break login flow

## Future Enhancements

- [ ] IP geolocation for automatic location detection
- [ ] Device activity history/logs
- [ ] Bulk device management
- [ ] Device trust levels
- [ ] Automatic device removal after extended inactivity
- [ ] Email notifications for new device logins

