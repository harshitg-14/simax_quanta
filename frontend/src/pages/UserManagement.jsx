import { useEffect, useState } from 'react'
import { Users, ShieldCheck, Trash2, Loader2, RefreshCw } from 'lucide-react'
import api from '../api'

const ROLES = [
  { value: 'admin',              label: 'Admin' },
  { value: 'department_officer', label: 'Department Officer' },
  { value: 'auditor',            label: 'Auditor' },
  { value: 'reviewer',           label: 'Reviewer' },
]

const ROLE_COLORS = {
  admin:              'bg-red-900/40 text-red-400',
  department_officer: 'bg-blue-900/40 text-blue-400',
  auditor:            'bg-yellow-900/40 text-yellow-400',
  reviewer:           'bg-gray-800 text-gray-400',
}

export default function UserManagement({ user }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [msg,      setMsg]      = useState(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data)
    } catch {
      setMsg({ type: 'error', text: 'Failed to load users' })
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const changeRole = async (userId, newRole) => {
    setSaving(userId)
    setMsg(null)
    try {
      await api.patch(`/auth/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMsg({ type: 'success', text: 'Role updated successfully' })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update role' })
    } finally { setSaving(null) }
  }

  const deleteUser = async (userId, email) => {
    if (!window.confirm(`Delete user "${email}"? This cannot be undone.`)) return
    setDeleting(userId)
    setMsg(null)
    try {
      await api.delete(`/auth/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setMsg({ type: 'success', text: `User "${email}" deleted` })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to delete user' })
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-400 text-sm mt-1">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800 transition">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm border ${
          msg.type === 'success'
            ? 'bg-green-900/30 text-green-400 border-green-800/50'
            : 'bg-red-900/30 text-red-400 border-red-800/50'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <span key={r.value} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[r.value]}`}>
            {r.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <Users size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No users found</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Current Role</th>
                <th className="text-left px-5 py-3">Change Role</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map(u => {
                const isSelf = u.email === user?.email
                return (
                  <tr key={u.id} className={`hover:bg-gray-800/40 transition ${isSelf ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-100">{u.name}</div>
                      {isSelf && <div className="text-xs text-gray-500">(you)</div>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-800 text-gray-400'}`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {isSelf ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={e => changeRole(u.id, e.target.value)}
                            disabled={saving === u.id}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-50">
                            {ROLES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          {saving === u.id && <Loader2 size={13} className="animate-spin text-blue-400" />}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={deleting === u.id}
                          className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition disabled:opacity-40">
                          {deleting === u.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-1.5 text-gray-400 font-medium mb-2">
          <ShieldCheck size={13} /> Role Permissions
        </div>
        <div><span className="text-red-400 font-medium">Admin</span> — Full access: upload, delete, user management, agent mode, audit logs</div>
        <div><span className="text-blue-400 font-medium">Department Officer</span> — Upload documents, use agent mode, view analytics</div>
        <div><span className="text-yellow-400 font-medium">Auditor</span> — View audit logs, analytics; read-only on documents</div>
        <div><span className="text-gray-400 font-medium">Reviewer</span> — Read documents, basic RAG chat only</div>
      </div>
    </div>
  )
}
