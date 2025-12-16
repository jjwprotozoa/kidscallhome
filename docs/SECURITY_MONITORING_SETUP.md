# Security Monitoring & Alerting Setup
**Purpose:** Configure security monitoring and alerting for production  
**Last Updated:** 2025-01-XX

---

## 🎯 Overview

This guide helps you set up comprehensive security monitoring to detect and respond to security incidents in real-time.

---

## 1. Security Event Monitoring

### Audit Log Monitoring

**Location:** `src/utils/auditLog.ts`

**Monitor These Events:**
- `login_attempt` - Track all login attempts
- `login_failed` - Failed authentication attempts
- `account_locked` - Account lockouts
- `signup` - New account registrations
- `suspicious_activity` - Anomalous behavior

**Setup Alerting:**
```typescript
// Example: Alert on multiple failed logins
if (eventType === 'login_failed' && attempts > 5) {
  sendSecurityAlert({
    severity: 'high',
    event: 'Multiple failed login attempts',
    userId: options.userId,
    email: options.email,
  });
}
```

---

## 2. Rate Limiting Monitoring

### Track Rate Limit Violations

**Monitor:**
- Rate limit violations (429 responses)
- IP addresses hitting limits
- Patterns of abuse

**Example Alert:**
```typescript
// Alert if same IP hits rate limit multiple times
if (rateLimitViolations[ip] > 10) {
  sendSecurityAlert({
    severity: 'medium',
    event: 'Repeated rate limit violations',
    ip: ip,
    violations: rateLimitViolations[ip],
  });
}
```

---

## 3. Webhook Security Monitoring

### Monitor Webhook Events

**Track:**
- Failed signature verifications
- Rate limit hits on webhook endpoint
- Unusual webhook patterns

**Setup:**
```typescript
// Log all webhook signature failures
if (signatureVerificationFailed) {
  logSecurityEvent({
    type: 'webhook_signature_failed',
    severity: 'high',
    ip: request.ip,
    timestamp: Date.now(),
  });
  
  // Alert if multiple failures from same IP
  if (failedAttempts[ip] > 5) {
    sendSecurityAlert({
      severity: 'critical',
      event: 'Repeated webhook signature failures',
      ip: ip,
    });
  }
}
```

---

## 4. CORS Violation Monitoring

### Track CORS Rejections

**Monitor:**
- Requests from disallowed origins
- Patterns of CORS attacks

**Example:**
```typescript
if (originRejected) {
  logSecurityEvent({
    type: 'cors_violation',
    severity: 'medium',
    origin: requestOrigin,
    ip: request.ip,
  });
}
```

---

## 5. Error Pattern Monitoring

### Detect Anomalous Errors

**Monitor:**
- Sudden spikes in error rates
- Unusual error patterns
- Potential attack indicators

**Setup:**
```typescript
// Track error rates
const errorRate = errorsLastMinute / totalRequestsLastMinute;

if (errorRate > 0.1) { // 10% error rate
  sendSecurityAlert({
    severity: 'medium',
    event: 'High error rate detected',
    errorRate: errorRate,
  });
}
```

---

## 6. Integration with Monitoring Services

### Sentry Integration

**Setup:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});

// Send security events
Sentry.captureMessage('Security event', {
  level: 'warning',
  tags: { type: 'security' },
});
```

### Vercel Analytics

**Monitor:**
- Request patterns
- Error rates
- Performance anomalies

**Setup:**
```typescript
import { Analytics } from '@vercel/analytics/react';

// Track security events
Analytics.track('security_event', {
  type: 'rate_limit',
  severity: 'medium',
});
```

---

## 7. Real-Time Alerting

### Email Alerts

**Setup:**
```typescript
async function sendSecurityAlert(alert: SecurityAlert) {
  // Send to security team
  await sendEmail({
    to: 'security@kidscallhome.com',
    subject: `[SECURITY] ${alert.severity.toUpperCase()}: ${alert.event}`,
    body: formatSecurityAlert(alert),
  });
}
```

### Slack/Discord Integration

**Setup:**
```typescript
async function sendSlackAlert(alert: SecurityAlert) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Security Alert: ${alert.event}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Severity', value: alert.severity },
          { title: 'Event', value: alert.event },
          { title: 'Time', value: new Date().toISOString() },
        ],
      }],
    }),
  });
}
```

---

## 8. Security Dashboard

### Key Metrics to Track

1. **Authentication Security:**
   - Failed login attempts
   - Account lockouts
   - Successful logins

2. **API Security:**
   - Rate limit violations
   - CORS rejections
   - Content-Type validation failures

3. **Webhook Security:**
   - Signature verification failures
   - Rate limit hits
   - Processing errors

4. **Error Patterns:**
   - Error rate trends
   - Unusual error spikes
   - Attack patterns

---

## 9. Automated Response

### Auto-Block Suspicious IPs

**Setup:**
```typescript
// Block IP after multiple violations
if (violations[ip] > 20) {
  await blockIP(ip, {
    reason: 'Multiple security violations',
    duration: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  sendSecurityAlert({
    severity: 'high',
    event: 'IP address blocked',
    ip: ip,
  });
}
```

---

## 10. Log Aggregation

### Centralized Logging

**Options:**
- **Vercel Logs:** Built-in logging
- **Datadog:** Advanced monitoring
- **New Relic:** Application monitoring
- **CloudWatch:** AWS monitoring

**Setup Example (Vercel):**
```typescript
// Use Vercel's logging
console.log('[SECURITY]', {
  type: 'rate_limit',
  ip: request.ip,
  path: request.path,
  timestamp: Date.now(),
});
```

---

## 11. Security Incident Response

### Incident Response Checklist

1. **Detection:**
   - [ ] Alert received
   - [ ] Verify incident
   - [ ] Assess severity

2. **Containment:**
   - [ ] Block malicious IPs
   - [ ] Disable affected accounts
   - [ ] Rate limit affected endpoints

3. **Investigation:**
   - [ ] Review logs
   - [ ] Identify attack vector
   - [ ] Document findings

4. **Remediation:**
   - [ ] Apply fixes
   - [ ] Update security measures
   - [ ] Test solutions

5. **Recovery:**
   - [ ] Restore services
   - [ ] Monitor for recurrence
   - [ ] Update documentation

---

## 12. Regular Security Reviews

### Weekly Reviews

- Review security alerts
- Analyze attack patterns
- Update security rules

### Monthly Reviews

- Review all security events
- Update threat model
- Review and update security policies

### Quarterly Reviews

- Full security audit
- Penetration testing
- Security training updates

---

## 📊 Monitoring Dashboard Example

```
┌─────────────────────────────────────┐
│   Security Monitoring Dashboard    │
├─────────────────────────────────────┤
│                                     │
│  Failed Logins:     23 (↑ 5%)      │
│  Rate Limits:       12 (↓ 2%)      │
│  CORS Violations:   3 (→)          │
│  Webhook Errors:    1 (↓ 1%)      │
│                                     │
│  [Recent Alerts]                    │
│  • 10:23 - Rate limit hit (IP: ...) │
│  • 09:45 - Failed login (User: ...)│
│                                     │
└─────────────────────────────────────┘
```

---

## 🔗 Resources

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Sentry Security](https://docs.sentry.io/product/security-policy-reporting/)

---

**Next Steps:**
1. Set up monitoring service integration
2. Configure alerting thresholds
3. Create security dashboard
4. Test alerting system
5. Document incident response procedures

