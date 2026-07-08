import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, ChevronDown, ChevronUp, Trash2, Loader2,
  Search, X, ArrowRight, Layers, Pencil, Check, AlertCircle,
  Clock, CheckCircle2,
} from 'lucide-react'
import api from '../api'

const CHUNK_TYPE_STYLE = {
  heading:   'bg-blue-900/40 text-blue-400',
  paragraph: 'bg-gray-800 text-gray-400',
  table:     'bg-purple-900/40 text-purple-400',
}

const DOC_TYPES = ['policy','circular','notification','act','order','scheme','report','other']
const CLASSIFICATIONS = ['public','restricted','confidential']

// ── Chunk viewer ──────────────────────────────────────────────────────────────
function ChunksViewer({ docId }) {
  const [chunks,          setChunks]          = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [chunkSearch,     setChunkSearch]     = useState('')
  const [filterChunkType, setFilterChunkType] = useState('')
  const [expanded,        setExpanded]        = useState(null)

  useEffect(() => {
    api.get(`/documents/${docId}`)
      .then(r => setChunks(r.data.chunks || []))
      .catch(() => setChunks([]))
      .finally(() => setLoading(false))
  }, [docId])

  if (loading) return (
    <div className="flex items-center gap-2 py-6 text-gray-500 text-sm justify-center">
      <Loader2 size={15} className="animate-spin" /> Loading chunks…
    </div>
  )
  if (!chunks?.length) return (
    <div className="text-center py-6 text-gray-600 text-sm">No chunks found.</div>
  )

  const filtered = chunks.filter(c => {
    if (filterChunkType && c.chunk_type !== filterChunkType) return false
    if (chunkSearch && !c.text.toLowerCase().includes(chunkSearch.toLowerCase()) &&
        !c.heading_path?.toLowerCase().includes(chunkSearch.toLowerCase())) return false
    return true
  })
  const types = [...new Set(chunks.map(c => c.chunk_type).filter(Boolean))]

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={chunkSearch} onChange={e => setChunkSearch(e.target.value)}
            placeholder="Search chunk text or heading…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500" />
        </div>
        <select value={filterChunkType} onChange={e => setFilterChunkType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none">
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        {(chunkSearch || filterChunkType) && (
          <button onClick={() => { setChunkSearch(''); setFilterChunkType('') }}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg transition"><X size={13} /></button>
        )}
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>{chunks.length} total</span>
        {filtered.length !== chunks.length && <span className="text-blue-400">{filtered.length} shown</span>}
        {types.map(t => (
          <span key={t} className={`px-2 py-0.5 rounded-full ${CHUNK_TYPE_STYLE[t] || 'bg-gray-800 text-gray-400'}`}>
            {chunks.filter(c => c.chunk_type === t).length} {t}
          </span>
        ))}
      </div>
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((c, i) => {
          const isOpen  = expanded === i
          const preview = c.text.slice(0, 160)
          return (
            <div key={i} className="bg-gray-800/60 border border-gray-700/50 rounded-lg overflow-hidden">
              <div className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-700/30 transition"
                onClick={() => setExpanded(isOpen ? null : i)}>
                <span className="text-[10px] text-gray-600 font-mono mt-0.5 w-6 flex-shrink-0 text-right">{c.index ?? i}</span>
                <div className="flex-1 min-w-0">
                  {c.heading_path && <div className="text-[10px] text-gray-500 mb-0.5 truncate font-mono">{c.heading_path}</div>}
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {isOpen ? c.text : preview}
                    {!isOpen && c.text.length > 160 && <span className="text-gray-600">…</span>}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium capitalize ${CHUNK_TYPE_STYLE[c.chunk_type] || 'bg-gray-800 text-gray-400'}`}>
                  {c.chunk_type}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Metadata edit modal ───────────────────────────────────────────────────────
function MetadataModal({ doc, onClose, onSaved }) {
  const [form, setForm] = useState({
    summary:        doc.summary        || '',
    keywords:       doc.keywords       || '',
    doc_type:       doc.doc_type       || 'other',
    department:     doc.department     || '',
    version:        doc.version        || '',
    issue_date:     doc.issue_date     || '',
    effective_date: doc.effective_date || '',
    classification: doc.classification || 'public',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const save = async () => {
    setSaving(true); setError(null)
    try {
      await api.patch(`/documents/${doc.id}/metadata`, form)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const field = (label, key, type = 'text', options = null) => (
    <div key={key}>
      <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">{label}</label>
      {options ? (
        <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500">
          {options.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold">Edit Metadata</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{doc.file_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Summary</label>
            <textarea value={form.summary} rows={3}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          {field('Keywords (comma-separated)', 'keywords')}
          {field('Document Type', 'doc_type', 'text', DOC_TYPES)}
          {field('Department', 'department')}
          {field('Version', 'version')}
          {field('Issue Date', 'issue_date', 'date')}
          {field('Effective Date', 'effective_date', 'date')}
          {field('Classification', 'classification', 'text', CLASSIFICATIONS)}
        </div>

        {error && (
          <div className="mx-5 mb-3 px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex gap-2 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm transition flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Upload queue item ─────────────────────────────────────────────────────────
function QueueItem({ item }) {
  const icons = {
    pending:   <Clock size={13} className="text-gray-500" />,
    uploading: <Loader2 size={13} className="animate-spin text-blue-400" />,
    done:      <CheckCircle2 size={13} className="text-green-400" />,
    duplicate: <AlertCircle size={13} className="text-yellow-400" />,
    error:     <AlertCircle size={13} className="text-red-400" />,
  }
  const colors = {
    pending:   'text-gray-400',
    uploading: 'text-blue-300',
    done:      'text-green-300',
    duplicate: 'text-yellow-300',
    error:     'text-red-300',
  }
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs">
      {icons[item.status]}
      <span className="flex-1 truncate text-gray-300">{item.name}</span>
      {item.msg && <span className={`flex-shrink-0 ${colors[item.status]}`}>{item.msg}</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Documents({ user }) {
  const canUpload = ['admin', 'department_officer'].includes(user?.role)
  const canDelete = user?.role === 'admin'
  const canEdit   = ['admin', 'department_officer'].includes(user?.role)

  const [docs,        setDocs]        = useState([])
  const [uploadQueue, setUploadQueue] = useState([])   // [{name, status, msg}]
  const [uploading,   setUploading]   = useState(false)
  const [isDragging,  setIsDragging]  = useState(false)
  const [msg,         setMsg]         = useState(null)
  const [expanded,    setExpanded]    = useState(null)
  const [activeTab,   setActiveTab]   = useState({})
  const [deleting,    setDeleting]    = useState(null)
  const [editDoc,     setEditDoc]     = useState(null)  // doc being edited
  const [search,      setSearch]      = useState('')
  const [filterDept,  setFilterDept]  = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [filterClass, setFilterClass] = useState('')

  const fileRef = useRef()
  const pollRef = useRef(null)

  const fetchDocs = () => api.get('/documents/').then(r => setDocs(r.data)).catch(() => {})

  useEffect(() => { fetchDocs() }, [])

  useEffect(() => {
    const anyProcessing = docs.some(d => d.processing_status === 'processing')
    if (anyProcessing && !pollRef.current) {
      pollRef.current = setInterval(fetchDocs, 4000)
    } else if (!anyProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [docs])

  const departments     = [...new Set(docs.map(d => d.department).filter(Boolean))].sort()
  const docTypes        = [...new Set(docs.map(d => d.doc_type).filter(Boolean))].sort()
  const classifications = [...new Set(docs.map(d => d.classification).filter(Boolean))].sort()
  const docMap          = Object.fromEntries(docs.map(d => [d.id, d]))

  const filtered = docs.filter(d => {
    if (search      && !d.file_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDept  && d.department     !== filterDept)  return false
    if (filterType  && d.doc_type       !== filterType)  return false
    if (filterClass && d.classification !== filterClass) return false
    return true
  })

  const hasFilters = search || filterDept || filterType || filterClass
  const clearFilters = () => { setSearch(''); setFilterDept(''); setFilterType(''); setFilterClass('') }

  // ── Upload queue processor ──────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return
    const arr = Array.from(files)
    const queue = arr.map(f => ({ name: f.name, status: 'pending', msg: '' }))
    setUploadQueue(queue)
    setUploading(true)
    setMsg(null)

    let doneCount = 0, errorCount = 0

    for (let i = 0; i < arr.length; i++) {
      setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item))
      const fd = new FormData()
      fd.append('file', arr[i])
      try {
        const { data } = await api.post('/documents/upload', fd)
        if (data.is_duplicate === 'true') {
          setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'duplicate', msg: 'Already exists' } : item))
        } else {
          setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'done', msg: `${data.chunks_created} chunks` } : item))
          doneCount++
        }
      } catch (err) {
        const detail = err.response?.data?.detail || 'Upload failed'
        setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'error', msg: detail } : item))
        errorCount++
      }
    }

    setUploading(false)
    fetchDocs()
    if (fileRef.current) fileRef.current.value = ''

    if (arr.length === 1) return  // single file: queue panel is enough feedback
    setMsg({
      type: errorCount === 0 ? 'success' : 'error',
      text: `${doneCount} uploaded${errorCount > 0 ? `, ${errorCount} failed` : ''} of ${arr.length} files.`,
    })
  }, [])

  const handleFileChange = e => uploadFiles(e.target.files)

  // ── Drag-and-drop ───────────────────────────────────────────────────────────
  const onDragOver = useCallback(e => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback(e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false) }, [])
  const onDrop = useCallback(e => {
    e.preventDefault()
    setIsDragging(false)
    if (!canUpload || uploading) return
    uploadFiles(e.dataTransfer.files)
  }, [canUpload, uploading, uploadFiles])

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteDoc = async (e, id, name) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${name}"? This removes all chunks and embeddings.`)) return
    setDeleting(id)
    try {
      await api.delete(`/documents/${id}`)
      setMsg({ type: 'success', text: `"${name}" deleted.` })
      fetchDocs()
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.detail || 'Delete failed' })
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-5">
      {/* Metadata edit modal */}
      {editDoc && (
        <MetadataModal
          doc={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={fetchDocs}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filtered.length !== docs.length
              ? `${filtered.length} of ${docs.length} document${docs.length !== 1 ? 's' : ''}`
              : `${docs.length} document${docs.length !== 1 ? 's' : ''} indexed`}
          </p>
        </div>
        {canUpload && (
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition text-sm font-medium ${uploading ? 'bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Uploading…' : 'Upload Files'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.txt,.csv"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Drag-and-drop zone */}
      {canUpload && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl px-6 py-5 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-900/20 text-blue-300'
              : 'border-gray-700 text-gray-600 hover:border-gray-600'
          } ${uploading ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <Upload size={20} className="mx-auto mb-1.5 opacity-60" />
          <p className="text-sm">
            {isDragging ? 'Drop files to upload' : 'Drag & drop files here, or click Upload Files above'}
          </p>
          <p className="text-xs mt-1 opacity-60">PDF, DOCX, XLSX, CSV, TXT · Max 50 MB per file · Multiple files supported</p>
        </div>
      )}

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Upload Queue ({uploadQueue.length} file{uploadQueue.length !== 1 ? 's' : ''})</span>
            {!uploading && (
              <button onClick={() => setUploadQueue([])} className="text-xs text-gray-600 hover:text-gray-400 transition">
                Clear
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-800">
            {uploadQueue.map((item, i) => <QueueItem key={i} item={item} />)}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          <option value="">All Types</option>
          {docTypes.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500">
          <option value="">All Classifications</option>
          {classifications.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 border border-gray-800 transition">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm border ${
          msg.type === 'success'
            ? 'bg-green-900/30 text-green-400 border-green-800/50'
            : 'bg-red-900/30 text-red-400 border-red-800/50'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <FileText size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No documents uploaded yet</p>
          <p className="text-gray-600 text-sm mt-1">Upload a PDF, DOCX, XLSX, CSV or TXT file to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
          <Search size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No documents match your filters</p>
          <button onClick={clearFilters} className="mt-2 text-sm text-blue-400 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const supersededDoc = d.supersedes_id ? docMap[d.supersedes_id] : null
            return (
              <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-800/50 transition"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}>

                  <FileText size={16} className="text-gray-500 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{d.file_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {d.chunk_count} chunks
                      {d.department && ` · ${d.department}`}
                      {d.doc_type && ` · ${d.doc_type}`}
                    </div>
                    {d.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{d.summary}</p>}
                    {supersededDoc && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                        <ArrowRight size={11} />
                        <span>Supersedes: <span className="font-medium">{supersededDoc.file_name}</span></span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.processing_status === 'ready'      ? 'bg-green-900/40 text-green-400' :
                      d.processing_status === 'processing' ? 'bg-blue-900/40 text-blue-400'  :
                      'bg-red-900/40 text-red-400'
                    }`}>
                      {d.processing_status}
                    </span>

                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); setEditDoc(d) }}
                        className="p-1.5 text-gray-600 hover:text-blue-400 rounded-lg transition"
                        title="Edit metadata"
                      >
                        <Pencil size={14} />
                      </button>
                    )}

                    {canDelete && (
                      <button onClick={e => deleteDoc(e, d.id, d.file_name)} disabled={deleting === d.id}
                        className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition disabled:opacity-40"
                        title="Delete document"
                      >
                        {deleting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    )}

                    {expanded === d.id ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                  </div>
                </div>

                {expanded === d.id && (
                  <div className="border-t border-gray-800">
                    <div className="flex border-b border-gray-800 px-4">
                      {[
                        { id: 'details', label: 'Details',                      icon: FileText },
                        { id: 'chunks',  label: `Chunks (${d.chunk_count})`,    icon: Layers  },
                      ].map(({ id, label, icon: Icon }) => {
                        const tab = activeTab[d.id] || 'details'
                        return (
                          <button key={id}
                            onClick={e => { e.stopPropagation(); setActiveTab(prev => ({ ...prev, [d.id]: id })) }}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px ${
                              tab === id
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}>
                            <Icon size={12} />{label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="px-4 pb-4 pt-3">
                      {(activeTab[d.id] || 'details') === 'details' ? (
                        <div className="space-y-3">
                          {supersededDoc && (
                            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2.5 text-xs">
                              <div className="text-amber-400 font-medium mb-1">Version Chain</div>
                              <div className="flex items-center gap-1.5 text-amber-300 flex-wrap">
                                <span className="font-medium">{d.file_name}</span>
                                <ArrowRight size={11} className="flex-shrink-0 text-amber-500" />
                                <span className="text-amber-500">{supersededDoc.file_name}</span>
                                {supersededDoc.issue_date && <span className="text-amber-600">({supersededDoc.issue_date})</span>}
                              </div>
                            </div>
                          )}
                          {d.summary && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Summary</div>
                              <p className="text-sm text-gray-300 leading-relaxed">{d.summary}</p>
                            </div>
                          )}
                          {d.keywords && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Keywords</div>
                              <div className="flex flex-wrap gap-1.5">
                                {d.keywords.split(',').map(k => k.trim()).filter(Boolean).map((k, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">{k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            {[
                              ['Version',        d.version],
                              ['Issue Date',     d.issue_date],
                              ['Effective Date', d.effective_date],
                              ['Classification', d.classification],
                              ['Upload Date',    d.upload_date?.slice(0, 10)],
                              ['Uploaded By',    d.uploaded_by],
                            ].map(([k, v]) => (
                              <div key={k} className="bg-gray-800 rounded-lg p-2.5">
                                <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{k}</div>
                                <div className="text-gray-200">{v || '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <ChunksViewer docId={d.id} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
