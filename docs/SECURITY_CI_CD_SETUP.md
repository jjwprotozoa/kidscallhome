# Security CI/CD Integration Guide
**Purpose:** Set up automated security testing in CI/CD pipeline  
**Last Updated:** 2025-01-XX

---

## 🎯 Overview

This guide helps you integrate automated security testing into your CI/CD pipeline to catch security issues before they reach production.

---

## 1. GitHub Actions Integration

### Basic Security Workflow

Create `.github/workflows/security-tests.yml`:

```yaml
name: Security Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      # Dependency vulnerability scanning
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      # Code security scanning with Semgrep
      - name: Run Semgrep security scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/javascript
          generateSarif: "1"
          uploadSarif: "1"

      # ESLint security rules
      - name: Run ESLint security checks
        run: npm run lint:security || true

      # Custom security tests
      - name: Run security test suite
        run: |
          chmod +x scripts/security-tests.sh
          ./scripts/security-tests.sh all
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          AUTH_TOKEN: ${{ secrets.STAGING_AUTH_TOKEN }}
        continue-on-error: true

  dependency-review:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Dependency Review
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate
```

---

## 2. Security Test Scripts

### Automated Security Tests

Add to `package.json`:

```json
{
  "scripts": {
    "test:security": "npm run lint:security && npm audit && ./scripts/security-tests.sh all",
    "lint:security": "node scripts/scan-console-logs.js",
    "audit:fix": "npm audit fix"
  }
}
```

---

## 3. Dependency Scanning

### npm audit Configuration

Create `.npmrc`:

```
audit-level=moderate
audit=true
```

### Automated Dependency Updates

Use Dependabot (`.github/dependabot.yml`):

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "security"
      - "dependencies"
    commit-message:
      prefix: "chore"
      include: "scope"
```

---

## 4. Code Security Scanning

### Semgrep Integration

1. **Install Semgrep:**
   ```bash
   pip install semgrep
   ```

2. **Create `.semgrep.yml`:**
   ```yaml
   rules:
     - id: security-audit
       languages: [typescript, javascript]
       severity: ERROR
       message: Security issue detected
   ```

3. **Run in CI:**
   ```yaml
   - name: Semgrep Scan
     run: |
       semgrep --config=auto --json --output=semgrep-results.json .
   ```

### ESLint Security Plugin

Install:
```bash
npm install --save-dev eslint-plugin-security
```

Configure in `eslint.config.js`:
```javascript
import security from 'eslint-plugin-security';

export default [
  {
    plugins: {
      security,
    },
    rules: {
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
    },
  },
];
```

---

## 5. Secrets Scanning

### GitGuardian or GitHub Secret Scanning

GitHub automatically scans for secrets, but you can enhance with:

```yaml
- name: Secret Scanning
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

---

## 6. Container Security (if using Docker)

### Trivy Scanning

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

---

## 7. Security Headers Validation

### Automated Header Testing

```yaml
- name: Test Security Headers
  run: |
    response=$(curl -s -I https://your-app.vercel.app)
    if ! echo "$response" | grep -q "X-Frame-Options: DENY"; then
      echo "❌ Missing X-Frame-Options header"
      exit 1
    fi
    echo "✅ Security headers validated"
```

---

## 8. Rate Limiting Tests

### Automated Rate Limit Verification

```yaml
- name: Test Rate Limiting
  run: |
    # Send 101 requests
    for i in {1..101}; do
      response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST ${{ secrets.API_URL }}/webhook \
        -H "Content-Type: application/json" \
        -d '{"test":"data"}')
      
      if [ $i -eq 101 ] && [ "$response" != "429" ]; then
        echo "❌ Rate limiting not working"
        exit 1
      fi
    done
    echo "✅ Rate limiting verified"
```

---

## 9. CORS Validation Tests

### Automated CORS Testing

```yaml
- name: Test CORS Validation
  run: |
    # Test allowed origin
    response1=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Origin: https://www.kidscallhome.com" \
      ${{ secrets.API_URL }}/endpoint)
    
    # Test disallowed origin
    response2=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Origin: https://evil.com" \
      ${{ secrets.API_URL }}/endpoint)
    
    if [ "$response1" != "200" ] || [ "$response2" != "403" ]; then
      echo "❌ CORS validation failed"
      exit 1
    fi
    echo "✅ CORS validation working"
```

---

## 10. Security Monitoring Integration

### Send Security Test Results to Monitoring

```yaml
- name: Send to Security Monitoring
  if: always()
  run: |
    # Send results to your security monitoring service
    curl -X POST ${{ secrets.SECURITY_WEBHOOK }} \
      -H "Content-Type: application/json" \
      -d "{
        \"status\": \"${{ job.status }}\",
        \"workflow\": \"${{ github.workflow }}\",
        \"run_id\": \"${{ github.run_id }}\"
      }"
```

---

## 11. Pre-Commit Hooks

### Husky + lint-staged

Install:
```bash
npm install --save-dev husky lint-staged
```

Configure `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "npm run lint:security"
    ]
  }
}
```

Setup:
```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

---

## 12. Security Test Reports

### Generate SARIF Reports

```yaml
- name: Upload Security Scan Results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: semgrep-results.sarif
```

---

## 📊 Recommended CI/CD Pipeline

```
┌─────────────────┐
│   Code Push     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-commit     │
│  - ESLint       │
│  - Security     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CI Pipeline    │
│  - npm audit    │
│  - Semgrep      │
│  - Security     │
│    tests        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Security       │
│  Review         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy to      │
│  Staging        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  E2E Security   │
│  Tests          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy to      │
│  Production     │
└─────────────────┘
```

---

## 🔗 Resources

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Semgrep Documentation](https://semgrep.dev/docs/)
- [OWASP CI/CD Security](https://owasp.org/www-project-top-10/)
- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

**Next Steps:**
1. Set up GitHub Actions workflow
2. Configure dependency scanning
3. Add security test scripts
4. Set up monitoring and alerting
5. Schedule regular security reviews

