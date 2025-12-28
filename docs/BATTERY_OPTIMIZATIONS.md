# Battery-Aware Call Quality Optimizations

## Overview

Low battery on mobile devices can significantly impact WebRTC call quality and connection stability. This document explains how the KidsCallHome app handles low battery scenarios and optimizes call quality to preserve battery life.

## How Low Battery Affects Calls

### 1. **CPU Throttling**

- Mobile devices reduce CPU performance when battery is low
- Video encoding/decoding becomes slower
- Higher latency and frame drops
- Audio may stutter or become choppy

### 2. **Network Throttling**

- Some devices reduce network activity to save power
- Reduced bandwidth allocation
- More frequent connection drops
- Slower ICE candidate gathering

### 3. **Background Restrictions**

- Aggressive background process limits
- WebRTC connections may be deprioritized
- Media streams may be paused or degraded

### 4. **Thermal Management**

- Low battery often correlates with device heating
- Thermal throttling reduces performance
- Can cause call quality degradation

## Battery Monitoring Implementation

### Battery Status API

The app uses the Browser Battery Status API (where available) to monitor:

- **Battery Level**: 0.0 to 1.0 (0% to 100%)
- **Charging State**: Whether device is plugged in
- **Charging Time**: Estimated time until fully charged
- **Discharging Time**: Estimated time until battery empty

### Battery Thresholds

- **Low Battery**: < 20% and not charging
- **Critical Battery**: < 10% and not charging

### Fallback Detection

When the Battery API is not available (some browsers/devices), the app:

- Assumes unknown battery status
- Relies on network-based quality adjustments
- Still applies conservative quality settings

## Quality Adjustments for Low Battery

### Critical Battery (< 10%)

- **Immediate Action**: Switch to audio-only mode
- **Quality Level**: `critical`
- **Video**: Disabled completely
- **Audio**: Reduced to 18 kbps (Opus)
- **Reason**: Maximum battery preservation while maintaining call

### Low Battery (< 20%)

- **Action**: Downgrade quality by one level
- **Example**: `excellent` → `good`, `good` → `moderate`
- **Video**: Reduced resolution and frame rate
- **Audio**: Slightly reduced bitrate
- **Reason**: Balance between quality and battery life

### Charging State

- **When Charging**: Normal quality adjustments apply
- **No Restrictions**: Can upgrade quality if network allows
- **Reason**: Battery preservation not needed when charging

## Integration with Quality Controller

The battery monitor integrates with the existing adaptive quality controller:

1. **Priority**: Battery optimizations take priority over network-based upgrades
2. **Prevention**: Prevents quality upgrades when battery is low (unless charging)
3. **Immediate Response**: Applies optimizations immediately when battery becomes critical
4. **Cooldown**: Respects quality change cooldown periods to prevent oscillation

### Quality Adjustment Flow

```text
Network Stats → Battery Check → Quality Decision
                     ↓
              [Low Battery?]
                     ↓
         Yes → Downgrade Quality
         No  → Normal Network-Based Adjustment
```

## Code Implementation

### Battery Monitor (`batteryMonitor.ts`)

- Monitors battery status via Browser API
- Provides callbacks for status changes
- Returns recommended quality adjustments
- Handles API unavailability gracefully

### Quality Controller Integration (`qualityController.ts`)

- Subscribes to battery status updates
- Applies battery-aware quality adjustments
- Prevents upgrades when battery is low
- Prioritizes battery optimizations over network upgrades

### Usage in WebRTC Hook (`useWebRTC.ts`)

- Automatically starts battery monitoring with quality controller
- No additional configuration needed
- Works transparently with existing quality system

## Benefits

### 1. **Extended Call Duration**

- Lower quality = less CPU/network usage
- Calls can last longer on low battery
- Audio-only mode extends battery significantly

### 2. **Improved Stability**

- Reduced processing load prevents throttling
- Fewer connection drops
- More consistent call quality

### 3. **Better User Experience**

- Automatic optimization (no user action needed)
- Graceful degradation
- Maintains call even in critical battery scenarios

### 4. **Battery Life Preservation**

- Reduces power consumption
- Allows longer device usage
- Prevents unexpected shutdowns during calls

## Testing Battery Optimizations

### Manual Testing

1. **Low Battery Simulation**:
   - Use device battery settings to simulate low battery
   - Or use browser DevTools (if available)
   - Verify quality downgrades automatically

2. **Critical Battery**:
   - Simulate < 10% battery
   - Verify switch to audio-only mode
   - Check that video is disabled

3. **Charging State**:
   - Plug in device while on low battery
   - Verify quality can upgrade again
   - Check that restrictions are removed

### Browser Compatibility

- **Chrome/Edge**: Full Battery API support
- **Firefox**: Limited support (may need fallback)
- **Safari**: No Battery API (uses fallback)
- **Mobile Browsers**: Varies by device/OS

## Configuration

Battery optimizations are enabled by default. To disable:

```typescript
qualityControllerRef.current = new QualityController(initialQuality, {
  enableBatteryOptimizations: false, // Disable battery-aware adjustments
});
```

## Future Enhancements

Potential improvements:

1. **User Preference**: Allow users to choose battery vs. quality priority
2. **Predictive Adjustments**: Adjust quality before battery becomes critical
3. **Device-Specific Tuning**: Different thresholds for different devices
4. **Battery Time Estimates**: Show estimated call duration based on battery level

## Related Documentation

- `src/features/calls/webrtc/batteryMonitor.ts` - Battery monitoring implementation
- `src/features/calls/webrtc/qualityController.ts` - Quality controller with battery integration
- `src/features/calls/config/callQualityProfiles.ts` - Quality profile definitions
- `docs/CALL_QUALITY.md` - General call quality documentation
