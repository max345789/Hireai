const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ];
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}Z`;
}

function run() {
  const projectRoot = path.join(__dirname, '..', '..');
  const dbPath = path.join(__dirname, '..', 'data', 'dab-ai.db');
  const backupDir = path.isAbsolute(env.backupDir) ? env.backupDir : path.join(projectRoot, env.backupDir);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }

  ensureDir(backupDir);

  const outputFile = path.join(backupDir, `dab-ai-${timestamp()}.db`);
  fs.copyFileSync(dbPath, outputFile);

  console.log(`Backup written: ${outputFile}`);
}

try {
  run();
} catch (error) {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
}
