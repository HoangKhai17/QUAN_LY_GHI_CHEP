import { useState, useEffect, useCallback } from 'react'
import useAuthStore from '../../store/auth.store'
import * as adminSvc from '../../services/admin.service'
import notify from '../../utils/notify'
import './Settings.css'

// ── Shared small components ────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const map = {
    admin:   { bg: '#fff7e7', color: '#b7791f', label: 'Admin' },
    manager: { bg: '#eaf2ff', color: '#2359a8', label: 'Manager' },
    staff:   { bg: '#f0f2f5', color: '#4b5563', label: 'Staff' },
  }
  const s = map[role] ?? { bg: '#f0f2f5', color: '#6b7280', label: role }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function ActiveDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#18864b' : '#6b7280' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#18864b' : '#d1d5db', display: 'inline-block' }} />
      {active ? 'Hoạt động' : 'Tạm dừng'}
    </span>
  )
}

// ── User detail modal ──────────────────────────────────────────────────────────

function UserDetailModal({ user, isAdmin, onClose, onRoleChange, onToggleActive, onResetPw }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const initials = user.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal">
        <div className="adm-modal-header">
          <div className="adm-modal-title">Chi tiết tài khoản</div>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="adm-modal-body">
          {/* Profile block */}
          <div className="adm-modal-profile">
            <div className="adm-modal-avatar">{initials}</div>
            <div>
              <div className="adm-modal-name">{user.name}</div>
              <div className="adm-modal-username">@{user.username}</div>
            </div>
          </div>

          {/* Info grid */}
          <div className="adm-modal-grid">
            <div className="adm-modal-field">
              <span className="adm-modal-label">Vai trò</span>
              <span className="adm-modal-value">
                {isAdmin ? (
                  <select
                    className="adm-role-select"
                    value={user.role}
                    onChange={e => onRoleChange(user, e.target.value)}
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <RoleBadge role={user.role} />
                )}
              </span>
            </div>

            <div className="adm-modal-field">
              <span className="adm-modal-label">Trạng thái</span>
              <span className="adm-modal-value"><ActiveDot active={user.is_active} /></span>
            </div>

            <div className="adm-modal-field">
              <span className="adm-modal-label">Đăng nhập lần cuối</span>
              <span className="adm-modal-value">{fmtDate(user.last_login_at)}</span>
            </div>

            <div className="adm-modal-field">
              <span className="adm-modal-label">Ngày tạo</span>
              <span className="adm-modal-value">{fmtDate(user.created_at)}</span>
            </div>

            <div className="adm-modal-field">
              <span className="adm-modal-label">ID hệ thống</span>
              <span className="adm-modal-value adm-modal-value--mono">{user.id}</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="adm-modal-footer">
            <button
              className={`bbo-btn bbo-btn-sm${user.is_active ? ' bbo-btn-danger-outline' : ' bbo-btn-primary'}`}
              onClick={() => onToggleActive(user)}
            >
              {user.is_active ? 'Tạm dừng tài khoản' : 'Kích hoạt tài khoản'}
            </button>

            <div className="adm-modal-footer-right">
              {confirmReset ? (
                <span className="adm-inline-confirm">
                  <span>Xác nhận đặt lại?</span>
                  <button
                    className="bbo-btn bbo-btn-sm bbo-btn-danger"
                    onClick={() => { onResetPw(user); setConfirmReset(false) }}
                  >Đặt lại</button>
                  <button className="bbo-btn bbo-btn-sm" onClick={() => setConfirmReset(false)}>Hủy</button>
                </span>
              ) : (
                <button className="bbo-btn bbo-btn-sm" onClick={() => setConfirmReset(true)}>
                  Đặt lại mật khẩu
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Users ─────────────────────────────────────────────────────────────────

function UsersTab({ currentUserRole }) {
  const isAdmin = currentUserRole === 'admin'

  const [users,          setUsers]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showAdd,        setShowAdd]        = useState(false)
  const [addForm,        setAddForm]        = useState({ username: '', name: '', role: 'staff', password: '' })
  const [addError,       setAddError]       = useState('')
  const [addLoading,     setAddLoading]     = useState(false)
  const [tempPw,         setTempPw]         = useState(null)  // { name, pw }
  const [selectedUser,   setSelectedUser]   = useState(null)  // user detail modal
  const [confirmResetId, setConfirmResetId] = useState(null)  // inline reset confirm

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSvc.getUsers()
      setUsers(res.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAddUser(e) {
    e.preventDefault()
    setAddError('')
    if (!addForm.username.trim() || !addForm.name.trim()) {
      setAddError('Tên đăng nhập và họ tên là bắt buộc')
      return
    }
    setAddLoading(true)
    try {
      const res = await adminSvc.createUser({
        username: addForm.username,
        name:     addForm.name,
        role:     addForm.role,
        ...(addForm.password ? { password: addForm.password } : {}),
      })
      if (res.temp_password) setTempPw({ name: res.name, pw: res.temp_password })
      setAddForm({ username: '', name: '', role: 'staff', password: '' })
      setShowAdd(false)
      notify.success('Tạo tài khoản thành công', `Tài khoản "${res.name}" đã được tạo`)
      load()
    } catch (err) {
      setAddError(err.response?.data?.error || 'Lỗi tạo tài khoản')
    } finally { setAddLoading(false) }
  }

  async function handleToggleActive(u) {
    try {
      await adminSvc.setUserActive(u.id, !u.is_active)
      const updated = { ...u, is_active: !u.is_active }
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      if (selectedUser?.id === u.id) setSelectedUser(updated)
      notify.success(
        'Cập nhật thành công',
        `${u.name} đã được ${!u.is_active ? 'kích hoạt' : 'tạm dừng'}`,
      )
    } catch (err) {
      notify.error('Cập nhật thất bại', err.response?.data?.error || 'Lỗi cập nhật trạng thái')
    }
  }

  async function handleRoleChange(u, role) {
    try {
      await adminSvc.changeUserRole(u.id, role)
      const updated = { ...u, role }
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      if (selectedUser?.id === u.id) setSelectedUser(updated)
      notify.success('Đổi vai trò thành công', `${u.name} → ${role}`)
    } catch (err) {
      notify.error('Đổi vai trò thất bại', err.response?.data?.error || 'Lỗi đổi vai trò')
    }
  }

  async function handleResetPw(u) {
    setConfirmResetId(null)
    try {
      const res = await adminSvc.resetUserPassword(u.id)
      setTempPw({ name: u.name, pw: res.temp_password })
      notify.success('Đặt lại mật khẩu thành công', `Mật khẩu tạm thời cho ${u.name} đã được tạo`)
    } catch (err) {
      notify.error('Đặt lại mật khẩu thất bại', err.response?.data?.error || 'Lỗi đặt lại mật khẩu')
    }
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <div className="adm-section-title">Danh sách tài khoản</div>
          <div className="adm-section-sub">{loading ? '…' : `${users.length} tài khoản`}</div>
        </div>
        {(isAdmin || currentUserRole === 'manager') && (
          <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={() => setShowAdd(v => !v)}>
            + Thêm tài khoản
          </button>
        )}
      </div>

      {tempPw && (
        <div className="adm-alert adm-alert--info">
          <div>
            <strong>Mật khẩu tạm thời cho {tempPw.name}:</strong>{' '}
            <code>{tempPw.pw}</code>
            <span className="adm-alert-hint"> — Chia sẻ riêng tư, người dùng phải đổi ngay khi đăng nhập</span>
          </div>
          <button className="adm-alert-close" onClick={() => setTempPw(null)}>✕</button>
        </div>
      )}

      {showAdd && (
        <form className="adm-add-form bbo-card" onSubmit={handleAddUser}>
          <div className="adm-add-form-title">Tạo tài khoản mới</div>
          {addError && <div className="adm-form-error">{addError}</div>}
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Tên đăng nhập *</label>
              <input className="adm-input" value={addForm.username}
                onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))}
                placeholder="vd: nguyen.van.a" />
            </div>
            <div className="adm-form-field">
              <label>Họ và tên *</label>
              <input className="adm-input" value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nguyễn Văn A" />
            </div>
            <div className="adm-form-field">
              <label>Vai trò</label>
              <select className="adm-select" value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                {isAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            <div className="adm-form-field">
              <label>Mật khẩu (để trống → tự sinh)</label>
              <input className="adm-input" type="password" value={addForm.password}
                onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Tối thiểu 8 ký tự" />
            </div>
          </div>
          <div className="adm-form-actions">
            <button type="submit" className="bbo-btn bbo-btn-sm bbo-btn-primary" disabled={addLoading}>
              {addLoading ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
            <button type="button" className="bbo-btn bbo-btn-sm" onClick={() => setShowAdd(false)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <div className="adm-table-head adm-table-users">
          <div>Tài khoản</div>
          <div>Vai trò</div>
          <div>Trạng thái</div>
          <div>Đăng nhập lần cuối</div>
          <div>Thao tác</div>
        </div>

        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="adm-table-row adm-table-users">
            <div className="skeleton" style={{ height: 14, width: '70%' }} />
            <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 14, width: 90 }} />
            <div className="skeleton" style={{ height: 14, width: 90 }} />
            <div className="skeleton" style={{ height: 30, width: 140, borderRadius: 8 }} />
          </div>
        ))}

        {!loading && users.map(u => (
          <div key={u.id} className="adm-table-row adm-table-users">
            <div
              className="adm-cell-clickable"
              onClick={() => setSelectedUser(u)}
              title="Xem chi tiết"
            >
              <div className="adm-cell-primary">{u.name}</div>
              <div className="adm-cell-sub">{u.username}</div>
            </div>
            <div>
              {isAdmin ? (
                <select className="adm-role-select" value={u.role}
                  onChange={e => handleRoleChange(u, e.target.value)}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <RoleBadge role={u.role} />
              )}
            </div>
            <div><ActiveDot active={u.is_active} /></div>
            <div className="adm-cell-sub">
              {u.last_login_at
                ? new Date(u.last_login_at).toLocaleDateString('vi-VN')
                : '—'}
            </div>
            <div className="adm-row-actions">
              {isAdmin && (
                confirmResetId === u.id ? (
                  <span className="adm-inline-confirm">
                    <span className="adm-inline-confirm__label">Đặt lại MK?</span>
                    <button className="adm-confirm-btn adm-confirm-btn--danger" onClick={() => handleResetPw(u)}>Xác nhận</button>
                    <button className="adm-confirm-btn" onClick={() => setConfirmResetId(null)}>Hủy</button>
                  </span>
                ) : (
                  <>
                    <button
                      className={`bbo-btn bbo-btn-sm${u.is_active ? '' : ' bbo-btn-primary'}`}
                      onClick={() => handleToggleActive(u)}
                    >
                      {u.is_active ? 'Tạm dừng' : 'Kích hoạt'}
                    </button>
                    <button className="bbo-btn bbo-btn-sm" onClick={() => setConfirmResetId(u.id)}>
                      Đặt lại MK
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        ))}

        {!loading && users.length === 0 && (
          <div className="adm-empty">Chưa có tài khoản nào</div>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isAdmin={isAdmin}
          onClose={() => setSelectedUser(null)}
          onRoleChange={handleRoleChange}
          onToggleActive={handleToggleActive}
          onResetPw={handleResetPw}
        />
      )}
    </div>
  )
}

// ── Tab: Document Types ────────────────────────────────────────────────────────

const EMPTY_FIELD_FORM = { field_key: '', label: '', data_type: 'text', unit: '', is_filterable: false }

function DocTypesTab() {
  const [types,          setTypes]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [expandedId,     setExpandedId]     = useState(null)
  const [expandedFields, setExpandedFields] = useState({}) // { [typeId]: Field[] }
  const [fieldsLoading,  setFieldsLoading]  = useState({}) // { [typeId]: bool }
  const [showAdd,        setShowAdd]        = useState(false)
  const [addForm,        setAddForm]        = useState({ code: '', name: '', description: '' })
  const [addError,       setAddError]       = useState('')
  const [addLoading,     setAddLoading]     = useState(false)
  const [fieldForms,     setFieldForms]     = useState({}) // { [typeId]: FieldForm }
  const [fieldErrors,    setFieldErrors]    = useState({}) // { [typeId]: string }
  const [editFieldId,    setEditFieldId]    = useState(null)  // { typeId, fieldId }
  const [editFieldForm,  setEditFieldForm]  = useState({})
  const [savingField,    setSavingField]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSvc.getDocumentTypesAll()
      setTypes(res.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleExpand(typeId) {
    if (expandedId === typeId) { setExpandedId(null); return }
    setExpandedId(typeId)
    if (expandedFields[typeId] !== undefined) return // already loaded
    setFieldsLoading(prev => ({ ...prev, [typeId]: true }))
    try {
      const res = await adminSvc.getDocumentTypeFields(typeId)
      setExpandedFields(prev => ({ ...prev, [typeId]: res.data ?? [] }))
    } finally {
      setFieldsLoading(prev => ({ ...prev, [typeId]: false }))
    }
  }

  async function handleToggleActive(t) {
    try {
      await adminSvc.updateDocumentType(t.id, { is_active: !t.is_active })
      setTypes(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
      notify.success(
        'Cập nhật thành công',
        `"${t.name}" đã được ${!t.is_active ? 'bật' : 'tắt'}`,
      )
    } catch (err) {
      notify.error('Cập nhật thất bại', err.response?.data?.error || 'Lỗi cập nhật')
    }
  }

  async function handleAddType(e) {
    e.preventDefault()
    setAddError('')
    if (!addForm.code.trim() || !addForm.name.trim()) {
      setAddError('Mã code và tên là bắt buộc')
      return
    }
    setAddLoading(true)
    try {
      await adminSvc.createDocumentType(addForm)
      setAddForm({ code: '', name: '', description: '' })
      setShowAdd(false)
      notify.success('Tạo loại tài liệu thành công', `Loại "${addForm.name}" đã được thêm`)
      load()
    } catch (err) {
      setAddError(err.response?.data?.error || 'Lỗi tạo loại tài liệu')
    } finally { setAddLoading(false) }
  }

  async function handleAddField(typeId, e) {
    e.preventDefault()
    setFieldErrors(prev => ({ ...prev, [typeId]: '' }))
    const f = { ...EMPTY_FIELD_FORM, ...fieldForms[typeId] }
    if (!f.field_key.trim() || !f.label.trim()) {
      setFieldErrors(prev => ({ ...prev, [typeId]: 'field_key và nhãn là bắt buộc' }))
      return
    }
    try {
      const newField = await adminSvc.addDocumentTypeField(typeId, f)
      setExpandedFields(prev => ({ ...prev, [typeId]: [...(prev[typeId] ?? []), newField] }))
      setFieldForms(prev => ({ ...prev, [typeId]: { ...EMPTY_FIELD_FORM } }))
      notify.success('Thêm trường thành công', `Trường "${f.label}" đã được thêm`)
    } catch (err) {
      setFieldErrors(prev => ({ ...prev, [typeId]: err.response?.data?.error || 'Lỗi thêm trường' }))
    }
  }

  const [confirmDeleteField, setConfirmDeleteField] = useState(null) // { typeId, fieldId, label }

  async function handleDeleteField(typeId, fieldId) {
    setConfirmDeleteField({ typeId, fieldId })
  }

  async function doDeleteField() {
    const { typeId, fieldId } = confirmDeleteField
    setConfirmDeleteField(null)
    try {
      await adminSvc.deleteDocumentTypeField(typeId, fieldId)
      setExpandedFields(prev => ({
        ...prev,
        [typeId]: (prev[typeId] ?? []).filter(f => f.id !== fieldId),
      }))
      notify.success('Xóa trường thành công', 'Trường đã được xóa khỏi loại tài liệu')
    } catch (err) {
      notify.error('Xóa trường thất bại', err.response?.data?.error || 'Lỗi xóa trường')
    }
  }

  function setFF(typeId, key, val) {
    setFieldForms(prev => ({
      ...prev,
      [typeId]: { ...EMPTY_FIELD_FORM, ...prev[typeId], [key]: val },
    }))
  }

  function startEditField(typeId, f) {
    setEditFieldId({ typeId, fieldId: f.id })
    setEditFieldForm({
      label:         f.label,
      data_type:     f.data_type,
      unit:          f.unit ?? '',
      is_filterable: f.is_filterable ?? false,
      display_order: f.display_order ?? 0,
    })
  }

  function cancelEditField() {
    setEditFieldId(null)
    setEditFieldForm({})
  }

  async function handleSaveField(typeId, fieldId) {
    setSavingField(true)
    try {
      const updated = await adminSvc.updateDocumentTypeField(typeId, fieldId, editFieldForm)
      setExpandedFields(prev => ({
        ...prev,
        [typeId]: (prev[typeId] ?? []).map(f => f.id === fieldId ? { ...f, ...updated } : f),
      }))
      setEditFieldId(null)
      setEditFieldForm({})
      notify.success('Cập nhật thành công', `Trường "${editFieldForm.label}" đã được lưu`)
    } catch (err) {
      notify.error('Cập nhật thất bại', err.response?.data?.error || 'Lỗi cập nhật trường')
    } finally {
      setSavingField(false)
    }
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <div className="adm-section-title">Loại tài liệu</div>
          <div className="adm-section-sub">{loading ? '…' : `${types.length} loại`}</div>
        </div>
        <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={() => setShowAdd(v => !v)}>
          + Thêm loại
        </button>
      </div>

      {showAdd && (
        <form className="adm-add-form bbo-card" onSubmit={handleAddType}>
          <div className="adm-add-form-title">Tạo loại tài liệu mới</div>
          {addError && <div className="adm-form-error">{addError}</div>}
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Mã code (snake_case) *</label>
              <input className="adm-input" value={addForm.code}
                onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                placeholder="vd: hop_dong_mua_ban" />
            </div>
            <div className="adm-form-field">
              <label>Tên hiển thị *</label>
              <input className="adm-input" value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Hợp đồng mua bán" />
            </div>
            <div className="adm-form-field" style={{ flexBasis: '100%' }}>
              <label>Mô tả</label>
              <input className="adm-input" value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn về loại tài liệu này" />
            </div>
          </div>
          <div className="adm-form-actions">
            <button type="submit" className="bbo-btn bbo-btn-sm bbo-btn-primary" disabled={addLoading}>
              {addLoading ? 'Đang tạo…' : 'Tạo loại'}
            </button>
            <button type="button" className="bbo-btn bbo-btn-sm" onClick={() => setShowAdd(false)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <div className="adm-table-head adm-table-doctypes">
          <div>Tên / Code</div>
          <div>Mô tả</div>
          <div>Trạng thái</div>
          <div>Thao tác</div>
        </div>

        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="adm-table-row adm-table-doctypes">
            <div className="skeleton" style={{ height: 14, width: '80%' }} />
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 14, width: 80 }} />
            <div className="skeleton" style={{ height: 30, width: 100, borderRadius: 8 }} />
          </div>
        ))}

        {!loading && types.map(t => (
          <div key={t.id}>
            <div
              className={`adm-table-row adm-table-doctypes adm-row-clickable${expandedId === t.id ? ' adm-row--expanded' : ''}`}
              onClick={() => handleExpand(t.id)}
            >
              <div>
                <div className="adm-cell-primary">{t.name}</div>
                <div className="adm-cell-sub adm-cell-mono">{t.code}</div>
              </div>
              <div className="adm-cell-sub">{t.description || '—'}</div>
              <div><ActiveDot active={t.is_active} /></div>
              <div className="adm-row-actions">
                <button
                  className={`bbo-btn bbo-btn-sm${t.is_active ? '' : ' bbo-btn-primary'}`}
                  onClick={e => { e.stopPropagation(); handleToggleActive(t) }}
                >
                  {t.is_active ? 'Tắt' : 'Bật'}
                </button>
                <span className="adm-expand-chevron">{expandedId === t.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedId === t.id && (
              <div className="adm-fields-panel">
                <div className="adm-fields-panel-title">Trường dữ liệu</div>

                {fieldsLoading[t.id] && (
                  <div className="adm-empty-small">Đang tải…</div>
                )}

                {!fieldsLoading[t.id] && (expandedFields[t.id] ?? []).length === 0 && (
                  <div className="adm-empty-small">Chưa có trường nào — thêm trường đầu tiên bên dưới</div>
                )}

                {!fieldsLoading[t.id] && (expandedFields[t.id] ?? []).length > 0 && (
                  <table className="adm-fields-table">
                    <thead>
                      <tr>
                        <th>field_key</th>
                        <th>Nhãn</th>
                        <th>Kiểu</th>
                        <th>Đơn vị</th>
                        <th>Lọc</th>
                        <th>Thứ tự</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expandedFields[t.id] ?? []).map(f => {
                        const isEditing = editFieldId?.typeId === t.id && editFieldId?.fieldId === f.id
                        if (isEditing) {
                          return (
                            <tr key={f.id} className="adm-field-row--editing">
                              <td><code className="adm-code">{f.field_key}</code></td>
                              <td>
                                <input
                                  className="adm-input adm-input-sm"
                                  style={{ width: '100%', minWidth: 100 }}
                                  value={editFieldForm.label}
                                  onChange={e => setEditFieldForm(p => ({ ...p, label: e.target.value }))}
                                  autoFocus
                                />
                              </td>
                              <td>
                                <select
                                  className="adm-select adm-select-sm"
                                  value={editFieldForm.data_type}
                                  onChange={e => setEditFieldForm(p => ({ ...p, data_type: e.target.value }))}
                                >
                                  <option value="text">text</option>
                                  <option value="number">number</option>
                                  <option value="money">money</option>
                                  <option value="date">date</option>
                                  <option value="datetime">datetime</option>
                                  <option value="boolean">boolean</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  className="adm-input adm-input-sm"
                                  style={{ width: 72 }}
                                  placeholder="Đơn vị"
                                  value={editFieldForm.unit}
                                  onChange={e => setEditFieldForm(p => ({ ...p, unit: e.target.value }))}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={editFieldForm.is_filterable}
                                  onChange={e => setEditFieldForm(p => ({ ...p, is_filterable: e.target.checked }))}
                                />
                              </td>
                              <td>
                                <input
                                  className="adm-input adm-input-sm"
                                  type="number"
                                  min="1"
                                  style={{ width: 56 }}
                                  value={editFieldForm.display_order}
                                  onChange={e => setEditFieldForm(p => ({ ...p, display_order: Number(e.target.value) }))}
                                />
                              </td>
                              <td>
                                <div className="adm-field-actions">
                                  <button
                                    className="adm-confirm-btn adm-confirm-btn--primary"
                                    onClick={() => handleSaveField(t.id, f.id)}
                                    disabled={savingField}
                                    title="Lưu"
                                  >{savingField ? '…' : '✓'}</button>
                                  <button
                                    className="adm-confirm-btn"
                                    onClick={cancelEditField}
                                    title="Hủy"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          )
                        }
                        return (
                          <tr key={f.id}>
                            <td><code className="adm-code">{f.field_key}</code></td>
                            <td>{f.label}</td>
                            <td><span className="adm-dtype-badge">{f.data_type}</span></td>
                            <td>{f.unit || '—'}</td>
                            <td>{f.is_filterable ? '✓' : '—'}</td>
                            <td>{f.display_order}</td>
                            <td>
                              <div className="adm-field-actions">
                                <button
                                  className="adm-confirm-btn"
                                  onClick={() => startEditField(t.id, f)}
                                  title="Sửa trường"
                                >✎</button>
                                <button
                                  className="adm-confirm-btn adm-confirm-btn--danger"
                                  onClick={() => handleDeleteField(t.id, f.id)}
                                  title="Xóa trường"
                                >✕</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {/* Add field form */}
                <form className="adm-add-field-form" onSubmit={e => handleAddField(t.id, e)}>
                  <div className="adm-fields-panel-title" style={{ marginTop: 14 }}>Thêm trường mới</div>
                  {fieldErrors[t.id] && <div className="adm-form-error" style={{ marginBottom: 8 }}>{fieldErrors[t.id]}</div>}
                  <div className="adm-field-form-row">
                    <input
                      className="adm-input adm-input-sm"
                      style={{ width: 130 }}
                      placeholder="field_key"
                      value={fieldForms[t.id]?.field_key ?? ''}
                      onChange={e => setFF(t.id, 'field_key', e.target.value)}
                    />
                    <input
                      className="adm-input adm-input-sm"
                      style={{ flex: 1, minWidth: 120 }}
                      placeholder="Nhãn hiển thị"
                      value={fieldForms[t.id]?.label ?? ''}
                      onChange={e => setFF(t.id, 'label', e.target.value)}
                    />
                    <select
                      className="adm-select adm-select-sm"
                      value={fieldForms[t.id]?.data_type ?? 'text'}
                      onChange={e => setFF(t.id, 'data_type', e.target.value)}
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="money">money</option>
                      <option value="date">date</option>
                      <option value="datetime">datetime</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <input
                      className="adm-input adm-input-sm"
                      style={{ width: 90 }}
                      placeholder="Đơn vị"
                      value={fieldForms[t.id]?.unit ?? ''}
                      onChange={e => setFF(t.id, 'unit', e.target.value)}
                    />
                    <label className="adm-check-label">
                      <input
                        type="checkbox"
                        checked={fieldForms[t.id]?.is_filterable ?? false}
                        onChange={e => setFF(t.id, 'is_filterable', e.target.checked)}
                      />
                      Lọc được
                    </label>
                    <button type="submit" className="bbo-btn bbo-btn-sm bbo-btn-primary">+ Thêm</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}

        {!loading && types.length === 0 && (
          <div className="adm-empty">Chưa có loại tài liệu nào</div>
        )}
      </div>

      {/* Confirm delete field dialog */}
      {confirmDeleteField && (
        <div className="adm-modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDeleteField(null)}>
          <div className="adm-modal" style={{ maxWidth: 400 }}>
            <div className="adm-modal-header">
              <div className="adm-modal-title">Xác nhận xóa trường</div>
              <button className="adm-modal-close" onClick={() => setConfirmDeleteField(null)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, margin: 0 }}>
                Toàn bộ dữ liệu đã nhập cho trường này sẽ bị mất vĩnh viễn và không thể khôi phục.
              </p>
            </div>
            <div className="adm-modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="bbo-btn bbo-btn-sm" onClick={() => setConfirmDeleteField(null)}>Hủy</button>
              <button className="bbo-btn bbo-btn-sm bbo-btn-danger" onClick={doDeleteField}>Xóa trường</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Categories ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [cats,       setCats]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [addForm,    setAddForm]    = useState({ name: '', description: '', color: '#1890ff' })
  const [addError,   setAddError]   = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [editLoading, setEditLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSvc.getCategoriesAll()
      setCats(res.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    if (!addForm.name.trim()) { setAddError('Tên là bắt buộc'); return }
    setAddLoading(true)
    try {
      await adminSvc.createCategory(addForm)
      setAddForm({ name: '', description: '', color: '#1890ff' })
      setShowAdd(false)
      notify.success('Tạo danh mục thành công', `Danh mục "${addForm.name}" đã được thêm`)
      load()
    } catch (err) {
      setAddError(err.response?.data?.error || 'Lỗi tạo danh mục')
    } finally { setAddLoading(false) }
  }

  async function handleToggleActive(c) {
    try {
      await adminSvc.updateCategory(c.id, { is_active: !c.is_active })
      setCats(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
      notify.success(
        'Cập nhật thành công',
        `"${c.name}" đã được ${!c.is_active ? 'bật' : 'tắt'}`,
      )
    } catch (err) {
      notify.error('Cập nhật thất bại', err.response?.data?.error || 'Lỗi cập nhật')
    }
  }

  async function handleEditSave(c) {
    setEditLoading(true)
    try {
      await adminSvc.updateCategory(c.id, editForm)
      setCats(prev => prev.map(x => x.id === c.id ? { ...x, ...editForm } : x))
      setEditId(null)
      notify.success('Lưu thành công', `Danh mục "${editForm.name}" đã được cập nhật`)
    } catch (err) {
      notify.error('Lưu thất bại', err.response?.data?.error || 'Lỗi lưu danh mục')
    } finally { setEditLoading(false) }
  }

  function startEdit(c) {
    setEditId(c.id)
    setEditForm({ name: c.name, description: c.description ?? '', color: c.color })
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <div className="adm-section-title">Danh mục phân loại</div>
          <div className="adm-section-sub">{loading ? '…' : `${cats.length} danh mục`}</div>
        </div>
        <button className="bbo-btn bbo-btn-sm bbo-btn-primary" onClick={() => setShowAdd(v => !v)}>
          + Thêm danh mục
        </button>
      </div>

      {showAdd && (
        <form className="adm-add-form bbo-card" onSubmit={handleAdd}>
          <div className="adm-add-form-title">Tạo danh mục mới</div>
          {addError && <div className="adm-form-error">{addError}</div>}
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Tên *</label>
              <input className="adm-input" value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Tên danh mục" />
            </div>
            <div className="adm-form-field">
              <label>Màu sắc</label>
              <div className="adm-color-row">
                <input type="color" value={addForm.color}
                  onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
                  className="adm-color-picker" />
                <input className="adm-input" value={addForm.color}
                  onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 90 }} />
              </div>
            </div>
            <div className="adm-form-field" style={{ flexBasis: '100%' }}>
              <label>Mô tả</label>
              <input className="adm-input" value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn" />
            </div>
          </div>
          <div className="adm-form-actions">
            <button type="submit" className="bbo-btn bbo-btn-sm bbo-btn-primary" disabled={addLoading}>
              {addLoading ? 'Đang tạo…' : 'Tạo danh mục'}
            </button>
            <button type="button" className="bbo-btn bbo-btn-sm" onClick={() => setShowAdd(false)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="bbo-card" style={{ overflow: 'hidden' }}>
        <div className="adm-table-head adm-table-cats">
          <div>Tên danh mục</div>
          <div>Mô tả</div>
          <div>Trạng thái</div>
          <div>Thao tác</div>
        </div>

        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="adm-table-row adm-table-cats">
            <div className="skeleton" style={{ height: 14, width: '70%' }} />
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 14, width: 80 }} />
            <div className="skeleton" style={{ height: 30, width: 120, borderRadius: 8 }} />
          </div>
        ))}

        {!loading && cats.map(c => (
          <div key={c.id} className="adm-table-row adm-table-cats">
            {editId === c.id ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={editForm.color}
                    onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                    className="adm-color-picker" />
                  <input className="adm-input adm-input-sm" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <input className="adm-input adm-input-sm" value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả" />
                <div><ActiveDot active={c.is_active} /></div>
                <div className="adm-row-actions">
                  <button className="bbo-btn bbo-btn-sm bbo-btn-primary"
                    disabled={editLoading}
                    onClick={() => handleEditSave(c)}>
                    {editLoading ? '…' : 'Lưu'}
                  </button>
                  <button className="bbo-btn bbo-btn-sm" onClick={() => setEditId(null)}>Hủy</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="adm-cat-dot" style={{ background: c.color }} />
                  <span className="adm-cell-primary">{c.name}</span>
                </div>
                <div className="adm-cell-sub">{c.description || '—'}</div>
                <div><ActiveDot active={c.is_active} /></div>
                <div className="adm-row-actions">
                  <button className="bbo-btn bbo-btn-sm" onClick={() => startEdit(c)}>Sửa</button>
                  <button
                    className={`bbo-btn bbo-btn-sm${c.is_active ? '' : ' bbo-btn-primary'}`}
                    onClick={() => handleToggleActive(c)}
                  >
                    {c.is_active ? 'Tắt' : 'Bật'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {!loading && cats.length === 0 && (
          <div className="adm-empty">Chưa có danh mục nào</div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users',      label: 'Người dùng' },
  { key: 'doctypes',   label: 'Loại tài liệu' },
  { key: 'categories', label: 'Danh mục' },
]

export default function SettingsPage() {
  const [activeTab, setTab] = useState('users')
  const user  = useAuthStore(s => s.user)

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <div className="adm-toolbar-title">Cài đặt hệ thống</div>
        <div className="adm-toolbar-sub">Quản lý tài khoản, loại tài liệu và danh mục phân loại</div>
      </div>

      <div className="adm-tabs-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`adm-tab${activeTab === t.key ? ' adm-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'users'      && <UsersTab currentUserRole={user?.role} />}
      {activeTab === 'doctypes'   && <DocTypesTab />}
      {activeTab === 'categories' && <CategoriesTab />}

      <div style={{ height: 32 }} />
    </div>
  )
}
