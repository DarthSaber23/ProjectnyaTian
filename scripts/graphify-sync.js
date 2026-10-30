#!/usr/bin/env node
/**
 * Graphify Sync Script
 *
 * Generates a snapshot of the current codebase architecture state.
 * Updates .graphify/report.json with:
 * - Timestamp
 * - Module file counts
 * - Test coverage
 * - Milestone status
 * - Constraint compliance
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHIFY_DIR = path.join(__dirname, '..', '.graphify');
const CONFIG_PATH = path.join(GRAPHIFY_DIR, 'config.json');
const REPORT_PATH = path.join(GRAPHIFY_DIR, 'report.json');
const PROJECT_ROOT = path.join(__dirname, '..');

// Load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

// Generate report
const report = {
  timestamp: new Date().toISOString(),
  projectName: config.projectName,
  version: config.version,
  modules: {},
  testCoverage: {
    total: 0,
    withTests: 0
  },
  constraints: config.constraints,
  milestones: config.milestones,
  generatedAt: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
};

// Scan each module
config.modules.forEach(mod => {
  const fullPath = path.join(PROJECT_ROOT, mod.path);

  if (!fs.existsSync(fullPath)) {
    report.modules[mod.name] = {
      status: 'not_found',
      path: mod.path,
      fileCount: 0,
      testCount: 0
    };
    return;
  }

  // Count files
  const files = [];
  const countFiles = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        if (entry.name.startsWith('.')) return;
        if (entry.name === 'node_modules' || entry.name === 'dist') return;

        if (entry.isDirectory()) {
          countFiles(path.join(dir, entry.name));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(entry.name);
        }
      });
    } catch (e) {
      // Skip directories we can't read
    }
  };

  countFiles(fullPath);

  const testCount = files.filter(f => f.endsWith('.test.ts')).length;
  const srcCount = files.filter(f => !f.endsWith('.test.ts') && !f.endsWith('.spec.ts')).length;

  report.modules[mod.name] = {
    status: mod.status || 'active',
    path: mod.path,
    description: mod.description,
    owner: mod.owner,
    fileCount: srcCount,
    testCount: testCount,
    files: files.slice(0, 10), // Show first 10 files
    dependencies: mod.dependencies || []
  };

  report.testCoverage.total += srcCount;
  if (testCount > 0) report.testCoverage.withTests++;
});

// Try to get git info
try {
  const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

  report.git = {
    commit: gitCommit,
    branch: gitBranch,
    status: execSync('git status --porcelain', { encoding: 'utf-8' }).split('\n').filter(Boolean).length
  };
} catch (e) {
  // Git not available
}

// Check constraint compliance
report.constraintCompliance = {
  moneyIntegerRupiah: {
    status: 'assumed',
    note: 'Enforced in server code via integer column types'
  },
  stockReservationAtCreate: {
    status: 'pending',
    milestone: 'B5'
  },
  paymentWebhookDriven: {
    status: 'pending',
    milestone: 'B6'
  },
  consentAppendOnly: {
    status: 'pending',
    milestone: 'B4'
  },
  auditImmutable: {
    status: 'pending',
    milestone: 'B4'
  },
  rblcLeastPrivilege: {
    status: 'pending',
    milestone: 'B4'
  }
};

// Write report
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`✅ Graphify snapshot generated at ${new Date().toISOString()}`);
console.log(`📊 Modules scanned: ${Object.keys(report.modules).length}`);
console.log(`📁 Source files: ${report.testCoverage.total}`);
console.log(`🧪 Modules with tests: ${report.testCoverage.withTests}`);
console.log(`💾 Report saved to: ${REPORT_PATH}`);
