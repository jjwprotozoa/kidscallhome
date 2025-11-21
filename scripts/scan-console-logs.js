#!/usr/bin/env node
// scripts/scan-console-logs.js
// Purpose: Security scanning script to detect console.log usage that might expose sensitive data

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Files/directories to ignore
const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  ".git",
  "scripts",
  "docs",
  "coverage",
  ".next",
  "build",
];

// File extensions to scan
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// Sensitive patterns that should never be logged
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /login[_-]?code/i,
  /family[_-]?code/i,
  /email/i,
  /phone/i,
  /ssn/i,
  /credit[_-]?card/i,
];

// Allowed console usage (safeLog is fine)
const ALLOWED_PATTERNS = [
  /safeLog\./,
  /console\.warn/, // Allowed for critical warnings
  /console\.error/, // Allowed for critical errors
];

const results = {
  directConsoleLogs: [],
  potentialSensitiveData: [],
  totalFiles: 0,
  totalIssues: 0,
};

function shouldIgnore(path) {
  return IGNORE_PATTERNS.some((pattern) => path.includes(pattern));
}

function isAllowedConsole(line) {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(line));
}

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relativePath = filePath.replace(process.cwd() + "/", "");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Check for direct console.log usage (not safeLog)
      if (/console\.(log|debug|info)\(/.test(trimmedLine) && !isAllowedConsole(trimmedLine)) {
        results.directConsoleLogs.push({
          file: relativePath,
          line: lineNumber,
          code: trimmedLine.substring(0, 100), // First 100 chars
        });
        results.totalIssues++;
      }

      // Check for potential sensitive data in console logs
      if (/console\.(log|debug|info|warn|error)\(/.test(trimmedLine)) {
        const hasSensitivePattern = SENSITIVE_PATTERNS.some((pattern) =>
          pattern.test(trimmedLine)
        );

        if (hasSensitivePattern && !isAllowedConsole(trimmedLine)) {
          results.potentialSensitiveData.push({
            file: relativePath,
            line: lineNumber,
            code: trimmedLine.substring(0, 100),
          });
          results.totalIssues++;
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
  }
}

function scanDirectory(dir) {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldIgnore(fullPath)) {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && SCAN_EXTENSIONS.includes(extname(entry))) {
        results.totalFiles++;
        scanFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
}

// Main execution
const srcDir = join(process.cwd(), "src");
console.log("🔍 Scanning for console.log usage and potential security issues...\n");
scanDirectory(srcDir);

// Report results
console.log("=".repeat(80));
console.log("📊 SCAN RESULTS");
console.log("=".repeat(80));
console.log(`Total files scanned: ${results.totalFiles}`);
console.log(`Total issues found: ${results.totalIssues}\n`);

if (results.directConsoleLogs.length > 0) {
  console.log("⚠️  DIRECT CONSOLE.LOG USAGE (should use safeLog):");
  console.log("-".repeat(80));
  results.directConsoleLogs.forEach((issue) => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ${issue.code}`);
    console.log();
  });
}

if (results.potentialSensitiveData.length > 0) {
  console.log("🔴 POTENTIAL SENSITIVE DATA IN LOGS:");
  console.log("-".repeat(80));
  results.potentialSensitiveData.forEach((issue) => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ${issue.code}`);
    console.log();
  });
}

if (results.totalIssues === 0) {
  console.log("✅ No security issues found! All console logs are using safeLog.");
  process.exit(0);
} else {
  console.log(
    `\n❌ Found ${results.totalIssues} issue(s). Please review and fix using safeLog.`
  );
  console.log("See docs/LOGGING_GUIDELINES.md for best practices.\n");
  process.exit(1);
}




