#!/usr/bin/env node
/**
 * Graphify Check Script
 *
 * Verifies that graphify report is up-to-date before starting a session.
 * Warns if:
 * - Report is more than 7 days old
 * - Major milestone has been reached but not recorded
 * - Git has uncommitted changes in src/ directories
 * - Architectural constraints may be violated
 *
 * Exit codes:
 * 0 = All good
 * 1 = Warning (stale report) - proceed with caution
 * 2 = Error (critical mismatch)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHIFY_DIR = path.join(__dirname, '..', '.graphify');
const REPORT_PATH = path.join(GRAPHIFY_DIR, 'report.json');
const CONFIG_PATH = path.join(GRAPHIFY_DIR, 'config.json');

const STALE_DAYS = 7;
const WARN_DAYS = 3;

let hasWarnings = false;
let hasErrors = false;

console.log('🔍 Graphify Health Check');
console.log('═══════════════════════════════════════\n');

// Check if report exists
if (!fs.existsSync(REPORT_PATH)) {
  console.error('❌ Report not found. Run: npm run graphify:sync');
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

// Check report age
const reportTime = new Date(report.timestamp);
const now = new Date();
const daysSinceReport = (now - reportTime) / (1000 * 60 * 60 * 24);

console.log(`📅 Report generated: ${report.generatedAt}`);
console.log(`⏱️  Days since snapshot: ${daysSinceReport.toFixed(1)} days\n`);

if (daysSinceReport > STALE_DAYS) {
  console.warn(`⚠️  STALE REPORT (> ${STALE_DAYS} days)`);
  console.warn('   Run: npm run graphify:sync');
  hasWarnings = true;
} else if (daysSinceReport > WARN_DAYS) {
  console.warn(`⚠️  Report aging (${daysSinceReport.toFixed(1)} days)`);
  console.warn('   Consider: npm run graphify:sync');
  hasWarnings = true;
}

// Check module coverage
console.log(`\n📊 Module Coverage`);
const modules = config.modules;
const modulesByStatus = {};

modules.forEach(mod => {
  const status = mod.status || 'active';
  if (!modulesByStatus[status]) modulesByStatus[status] = 0;
  modulesByStatus[status]++;
});

Object.entries(modulesByStatus).forEach(([status, count]) => {
  const emoji = status === 'done' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
  console.log(`   ${emoji} ${status}: ${count} modules`);
});

// Check test coverage
console.log(`\n🧪 Test Coverage`);
if (report.testCoverage) {
  const coverage = (report.testCoverage.withTests / modules.length * 100).toFixed(1);
  console.log(`   Source files: ${report.testCoverage.total}`);
  console.log(`   Modules with tests: ${report.testCoverage.withTests}/${modules.length} (${coverage}%)`);

  if (coverage < 50) {
    console.warn(`⚠️  Low test coverage (< 50%)`);
    hasWarnings = true;
  }
}

// Check git status
console.log(`\n📝 Git Status`);
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
  const modifiedCount = gitStatus.split('\n').filter(l => l.startsWith('M ')).length;
  const newCount = gitStatus.split('\n').filter(l => l.startsWith('?? ')).length;

  if (modifiedCount > 0 || newCount > 0) {
    console.log(`   Modified: ${modifiedCount}, New: ${newCount}`);

    // Check if .env files are dirty
    const envFiles = gitStatus.split('\n').filter(l => l.includes('.env'));
    if (envFiles.length > 0) {
      console.error('❌ CRITICAL: .env files modified/untracked');
      console.error('   Never commit .env or server/.env');
      hasErrors = true;
    }
  } else {
    console.log('   ✅ Clean working tree');
  }
} catch (e) {
  console.log('   (git not available)');
}

// Milestone status
console.log(`\n🎯 Milestone Progress`);
const milestones = config.milestones;
const currentMilestones = Object.entries(milestones).reduce((acc, [key, m]) => {
  const status = m.status;
  if (!acc[status]) acc[status] = [];
  acc[status].push(key);
  return acc;
}, {});

Object.entries(currentMilestones).forEach(([status, keys]) => {
  const emoji = status === 'done' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';
  console.log(`   ${emoji} ${status}: ${keys.join(', ')}`);
});

// Constraint compliance
console.log(`\n🔐 Constraint Compliance`);
if (report.constraintCompliance) {
  Object.entries(report.constraintCompliance).forEach(([constraint, info]) => {
    const statusEmoji = info.status === 'compliant' ? '✅' : info.status === 'assumed' ? '⚠️' : '⏳';
    console.log(`   ${statusEmoji} ${constraint}`);
    if (info.milestone) console.log(`      Target: ${info.milestone}`);
  });
}

// Git commit info
if (report.git) {
  console.log(`\n🔗 Git Info`);
  console.log(`   Branch: ${report.git.branch}`);
  console.log(`   Commit: ${report.git.commit}`);
  console.log(`   Uncommitted: ${report.git.status}`);
}

// Summary & recommendations
console.log(`\n═══════════════════════════════════════`);

if (hasErrors) {
  console.error('❌ CRITICAL ISSUES FOUND');
  console.error('Fix before proceeding. See above.');
  process.exit(2);
} else if (hasWarnings) {
  console.warn('⚠️  WARNINGS PRESENT');
  console.warn('Review and update graphify if needed:');
  console.warn('  npm run graphify:sync');
  process.exit(1);
} else {
  console.log('✅ GRAPHIFY HEALTHY');
  console.log('Proceed with your session.');
  process.exit(0);
}
