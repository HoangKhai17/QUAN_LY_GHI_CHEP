/**
 * Backup Router — admin-only PostgreSQL backup management.
 *
 * GET    /api/backup                     — list backup files
 * POST   /api/backup                     — create new backup (runs pg_dump)
 * GET    /api/backup/:filename/download  — download a backup file
 * DELETE /api/backup/:filename           — delete a backup file
 */

const router     = require('express').Router()
const { requireAuth } = require('../../middlewares/auth.middleware')
const { requireRole } = require('../../middlewares/rbac.middleware')
const backupSvc  = require('../../services/backup.service')
const { logAudit } = require('../../services/audit.service')

const adminOnly = [requireAuth, requireRole('admin')]

router.get('/', adminOnly, (req, res) => {
  const data = backupSvc.listBackups()
  res.json({ data })
})

router.post('/', adminOnly, async (req, res) => {
  const backup = await backupSvc.createBackup()
  logAudit({
    userId: req.user.sub, action: 'db_backup_created',
    resource: 'database', resourceId: backup.filename, req,
  })
  res.json({ data: backup })
})

router.get('/:filename/download', adminOnly, (req, res) => {
  const filepath = backupSvc.getBackupPath(req.params.filename)
  res.download(filepath, req.params.filename)
})

router.delete('/:filename', adminOnly, (req, res) => {
  backupSvc.deleteBackup(req.params.filename)
  logAudit({
    userId: req.user.sub, action: 'db_backup_deleted',
    resource: 'database', resourceId: req.params.filename, req,
  })
  res.json({ success: true })
})

module.exports = router
