# Runbook: Backup and Restore

## Backup
```bash
npm run backup --prefix server
```
- Output directory defaults to `server/backups`.
- Override with `BACKUP_DIR`.

## Restore
```bash
npm run restore --prefix server -- /absolute/path/to/backup.db
```
- Restore replaces `server/data/dab-ai.db`.
- Stop application processes before restore.

## Verification
1. Start server.
2. Call `/api/ready` and `/api/health`.
3. Verify lead/message counts from dashboard.
