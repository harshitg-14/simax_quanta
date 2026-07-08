import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import api from '../api'

export default function AuditLogs() {
  const [logs, setLogs]   = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/documents/audit/logs')
      .then(r => setLogs(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Access denied'))
  }, [])

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Shield size={40} className="text-red-400 mb-3 opacity-40" />
      <p className="text-red-400 font-medium">{error}</p>
      <p className="text-gray-500 text-sm mt-1">Audit logs are restricted to Admin and Auditor roles.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-gray-400 text-sm mt-1">{logs.length} system events recorded</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Shield size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No events recorded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                {['Action', 'User', 'Query / Event', 'Timestamp'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-800/40 transition">
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {l.user_id?.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                    {l.query ? l.query.replace('[AGENT] ', '') : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {l.timestamp?.slice(0, 19).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
