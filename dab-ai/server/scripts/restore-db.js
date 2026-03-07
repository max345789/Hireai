const fs = require('fs');
const path = require('path');

function run() {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Usage: node scripts/restore-db.js <backup-file-path>');
  }

  const sourcePath = path.resolve(source);
  const targetPath = path.join(__dirname, '..', 'data', 'dab-ai.db');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Database restored from ${sourcePath}`);
}

try {
  run();
} catch (error) {
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
}
