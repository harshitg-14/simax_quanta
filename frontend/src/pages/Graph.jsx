import { useState, useEffect } from 'react'
import { Search, GitBranch, ArrowRight, Download, Filter, Share2, Link, Settings, Plus, Trash2 } from 'lucide-react'
import api from '../api'

const TYPE_COLOR = {
  Scheme: 'bg-blue-900/40 text-blue-300',
  Ministry: 'bg-purple-900/40 text-purple-300',
  Beneficiary: 'bg-green-900/40 text-green-300',
  Department: 'bg-orange-900/40 text-orange-300',
  Organization: 'bg-pink-900/40 text-pink-300',
  Location: 'bg-teal-900/40 text-teal-300',
  Policy: 'bg-cyan-900/40 text-cyan-300',
  Act: 'bg-red-900/40 text-red-300',
}
const tc = t => TYPE_COLOR[t] || 'bg-gray-700 text-gray-300'

export default function Graph() {
  const [tab, setTab] = useState('search')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user?.role === 'admin'

  // Search tab
  const [searchQ, setSearchQ]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [hops, setHops]             = useState(1)
  const [results, setResults]       = useState(null)
  const [entity, setEntity]         = useState(null)
  const [loading, setLoading]       = useState(false)

  // Relation search tab
  const [relType, setRelType]         = useState('')
  const [relResults, setRelResults]   = useState(null)
  const [relLoading, setRelLoading]   = useState(false)
  const [relationTypes, setRelationTypes] = useState([])

  // Path finder tab
  const [fromEntity, setFromEntity]   = useState('')
  const [toEntity, setToEntity]       = useState('')
  const [pathResult, setPathResult]   = useState(null)
  const [pathLoading, setPathLoading] = useState(false)

  // Config tab (admin)
  const [config, setConfig]           = useState({ entity_types: [], relation_types: [] })
  const [newEntityType, setNewEntityType]   = useState('')
  const [newRelationType, setNewRelationType] = useState('')
  const [configLoading, setConfigLoading]   = useState(false)

  // Entity types for filter dropdown
  const [entityTypes, setEntityTypes] = useState([])

  useEffect(() => {
    api.get('/graph/types').then(({ data }) => setEntityTypes(data.types || [])).catch(() => {})
    api.get('/graph/relation-types').then(({ data }) => setRelationTypes(data.relation_types || [])).catch(() => {})
    if (isAdmin) {
      api.get('/graph/config').then(({ data }) => setConfig(data)).catch(() => {})
    }
  }, [isAdmin])

  // ── Search ──────────────────────────────────────────────────────────────────
  const search = async e => {
    e.preventDefault()
    if (!searchQ.trim()) return
    setLoading(true)
    try {
      const { data } = await api.get('/graph/search', {
        params: { q: searchQ, ...(typeFilter ? { type: typeFilter } : {}) }
      })
      setResults(data.results)
      setEntity(null)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const getEntity = async name => {
    setLoading(true)
    try {
      const { data } = await api.get(`/graph/entity/${encodeURIComponent(name)}`, { params: { hops } })
      setEntity(data)
    } catch {}
    finally { setLoading(false) }
  }

  // ── Relation search ─────────────────────────────────────────────────────────
  const searchByRelation = async e => {
    e.preventDefault()
    if (!relType.trim()) return
    setRelLoading(true)
    try {
      const { data } = await api.get('/graph/search/relationships', { params: { relation_type: relType } })
      setRelResults(data)
    } catch { setRelResults(null) }
    finally { setRelLoading(false) }
  }

  // ── Path finder ─────────────────────────────────────────────────────────────
  const findPath = async e => {
    e.preventDefault()
    if (!fromEntity.trim() || !toEntity.trim()) return
    setPathLoading(true)
    setPathResult(null)
    try {
      const { data } = await api.get('/graph/path', { params: { from_entity: fromEntity, to_entity: toEntity } })
      setPathResult(data)
    } catch { setPathResult({ found: false }) }
    finally { setPathLoading(false) }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportGraph = async () => {
    try {
      const response = await api.get('/graph/export', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'knowledge_graph.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  // ── Config (admin) ──────────────────────────────────────────────────────────
  const addEntityType = async () => {
    if (!newEntityType.trim()) return
    setConfigLoading(true)
    try {
      const { data } = await api.post('/graph/config/entity-types', { name: newEntityType.trim() })
      setConfig(c => ({ ...c, entity_types: data.entity_types }))
      setNewEntityType('')
    } catch (err) { alert(err.response?.data?.detail || 'Failed') }
    finally { setConfigLoading(false) }
  }

  const removeEntityType = async name => {
    setConfigLoading(true)
    try {
      const { data } = await api.delete(`/graph/config/entity-types/${encodeURIComponent(name)}`)
      setConfig(c => ({ ...c, entity_types: data.entity_types }))
    } catch (err) { alert(err.response?.data?.detail || 'Failed') }
    finally { setConfigLoading(false) }
  }

  const addRelationType = async () => {
    if (!newRelationType.trim()) return
    setConfigLoading(true)
    try {
      const { data } = await api.post('/graph/config/relation-types', { name: newRelationType.trim() })
      setConfig(c => ({ ...c, relation_types: data.relation_types }))
      setNewRelationType('')
    } catch (err) { alert(err.response?.data?.detail || 'Failed') }
    finally { setConfigLoading(false) }
  }

  const removeRelationType = async name => {
    setConfigLoading(true)
    try {
      const { data } = await api.delete(`/graph/config/relation-types/${encodeURIComponent(name)}`)
      setConfig(c => ({ ...c, relation_types: data.relation_types }))
    } catch (err) { alert(err.response?.data?.detail || 'Failed') }
    finally { setConfigLoading(false) }
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'search', label: 'Entity Search', icon: <Search size={13} /> },
    { key: 'relation', label: 'By Relationship', icon: <Link size={13} /> },
    { key: 'path', label: 'Path Finder', icon: <Share2 size={13} /> },
    ...(isAdmin ? [{ key: 'config', label: 'Manage Types', icon: <Settings size={13} /> }] : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Knowledge Graph</h1>
        <button
          onClick={exportGraph}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
        >
          <Download size={14} /> Export JSON
        </button>
      </div>
      <p className="text-gray-400 text-sm mb-5">Search entities extracted from government documents</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── ENTITY SEARCH TAB ── */}
      {tab === 'search' && (
        <>
          <form onSubmit={search} className="flex gap-3 mb-4 flex-wrap">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search: scheme, ministry, agriculture..."
              className="flex-1 min-w-[220px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="pl-8 pr-3 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 focus:outline-none appearance-none"
              >
                <option value="">All Types</option>
                {entityTypes.map(t => (
                  <option key={t.type} value={t.type}>{t.type} ({t.count})</option>
                ))}
              </select>
            </div>
            <select
              value={hops}
              onChange={e => setHops(+e.target.value)}
              className="px-3 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 focus:outline-none"
              title="Traversal depth when clicking an entity"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-5 py-3 rounded-xl transition flex items-center gap-2">
              <Search size={16} /> Search
            </button>
          </form>

          {hops > 1 && (
            <p className="text-xs text-yellow-400/80 mb-4">
              {hops}-hop mode: clicking an entity shows nodes up to {hops} relationships away.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {results !== null && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="font-semibold mb-4">
                  Entities ({results.length})
                  {typeFilter && <span className="ml-2 text-xs text-gray-400">· {typeFilter} only</span>}
                </h2>
                {results.length === 0 ? (
                  <p className="text-gray-500 text-sm">No entities found.</p>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {results.map((r, i) => (
                      <div key={i} onClick={() => getEntity(r.name)}
                        className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition">
                        <span className="text-sm font-medium">{r.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tc(r.type)}`}>{r.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {entity && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GitBranch size={18} className="text-blue-400" />
                    <h2 className="font-semibold">{entity.entity}</h2>
                    {entity.hops > 1 && (
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{entity.hops}-hop</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{entity.relationships.length} relationships</span>
                </div>
                {entity.relationships.length === 0 ? (
                  <p className="text-gray-500 text-sm">No relationships found.</p>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {entity.relationships.map((r, i) => (
                      <div key={i} className="p-3 bg-gray-800 rounded-lg text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${tc(r.source_type)}`}>{r.source_type}</span>
                          <span className="text-blue-300 font-medium">{r.source}</span>
                          <span className="text-gray-500 text-xs">—[{r.relation}]→</span>
                          <span className="text-green-300 font-medium">{r.target}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${tc(r.target_type)}`}>{r.target_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── RELATION SEARCH TAB ── */}
      {tab === 'relation' && (
        <div className="max-w-2xl">
          <p className="text-gray-400 text-sm mb-4">
            Find all entity pairs connected by a specific relationship type (e.g. all FUNDS connections).
          </p>
          <form onSubmit={searchByRelation} className="flex gap-3 mb-6 flex-wrap">
            <select
              value={relType}
              onChange={e => setRelType(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select relationship type...</option>
              {relationTypes.map(r => (
                <option key={r.relation} value={r.relation}>{r.relation} ({r.count} pairs)</option>
              ))}
            </select>
            <button type="submit" disabled={relLoading || !relType}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-5 py-3 rounded-xl transition flex items-center gap-2">
              {relLoading
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <><Link size={15} /> Search</>
              }
            </button>
          </form>

          {relResults && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">
                {relResults.relation_type} — {relResults.count} pair{relResults.count !== 1 ? 's' : ''}
              </h2>
              {relResults.count === 0 ? (
                <p className="text-gray-500 text-sm">No pairs found for this relationship type.</p>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {relResults.results.map((r, i) => (
                    <div key={i} className="p-3 bg-gray-800 rounded-lg text-sm flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${tc(r.source_type)}`}>{r.source_type}</span>
                      <span className="text-blue-300 font-medium">{r.source}</span>
                      <span className="text-gray-500 text-xs shrink-0">—[{r.relation}]→</span>
                      <span className="text-green-300 font-medium">{r.target}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${tc(r.target_type)}`}>{r.target_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PATH FINDER TAB ── */}
      {tab === 'path' && (
        <div className="max-w-2xl">
          <p className="text-gray-400 text-sm mb-4">
            Find the shortest connection path between any two entities (up to 6 hops).
          </p>
          <form onSubmit={findPath} className="space-y-3 mb-6">
            <div className="flex gap-3 items-center">
              <input value={fromEntity} onChange={e => setFromEntity(e.target.value)}
                placeholder="From entity (e.g. PM-KISAN)"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
              <ArrowRight size={18} className="text-gray-500 flex-shrink-0" />
              <input value={toEntity} onChange={e => setToEntity(e.target.value)}
                placeholder="To entity (e.g. Ministry of Agriculture)"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" disabled={pathLoading || !fromEntity.trim() || !toEntity.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-5 py-3 rounded-xl transition flex items-center justify-center gap-2">
              {pathLoading
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <><Share2 size={15} /> Find Path</>
              }
            </button>
          </form>

          {pathResult !== null && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {!pathResult.found ? (
                <p className="text-gray-400 text-sm">
                  No path found between <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{fromEntity}</span> and{' '}
                  <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{toEntity}</span>. They may not be connected in the graph.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-green-400">Path Found</h3>
                    <span className="text-xs text-gray-400">{pathResult.hops} hop{pathResult.hops !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pathResult.path.map((node, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full mb-1 ${tc(node.type)}`}>{node.type}</span>
                          <span className="text-sm font-medium bg-gray-800 px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-1)' }}>
                            {node.name}
                          </span>
                        </div>
                        {i < pathResult.relations.length && (
                          <div className="flex flex-col items-center text-xs text-gray-500">
                            <span className="mb-1 text-[10px] bg-gray-800 px-1.5 py-0.5 rounded" style={{ color: 'var(--text-2)' }}>
                              {pathResult.relations[i].replace(/_/g, ' ')}
                            </span>
                            <ArrowRight size={14} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG TAB (admin only) ── */}
      {tab === 'config' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
          {/* Entity types */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">Entity Types</h2>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {config.entity_types.map(t => {
                const isBuiltIn = ['Ministry','Scheme','Beneficiary','Department','Location','Organization','Policy','Act'].includes(t)
                return (
                  <div key={t} className="flex items-center justify-between p-2.5 bg-gray-800 rounded-lg">
                    <span className="text-sm">{t}</span>
                    {isBuiltIn
                      ? <span className="text-xs text-gray-600">built-in</span>
                      : (
                        <button onClick={() => removeEntityType(t)} disabled={configLoading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 p-1 rounded transition">
                          <Trash2 size={13} />
                        </button>
                      )
                    }
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input value={newEntityType} onChange={e => setNewEntityType(e.target.value)}
                placeholder="e.g. Fund, Committee"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && addEntityType()}
              />
              <button onClick={addEntityType} disabled={configLoading || !newEntityType.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-2 rounded-lg transition">
                <Plus size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">Letters, digits, underscores only. Starts with a letter.</p>
          </div>

          {/* Relation types */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">Relationship Types</h2>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {config.relation_types.map(t => {
                const isBuiltIn = ['FUNDS','TARGETS','IMPLEMENTS','LAUNCHED_BY','BENEFITS','PART_OF','LOCATED_IN','GOVERNED_BY'].includes(t)
                return (
                  <div key={t} className="flex items-center justify-between p-2.5 bg-gray-800 rounded-lg">
                    <span className="text-sm font-mono">{t}</span>
                    {isBuiltIn
                      ? <span className="text-xs text-gray-600">built-in</span>
                      : (
                        <button onClick={() => removeRelationType(t)} disabled={configLoading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 p-1 rounded transition">
                          <Trash2 size={13} />
                        </button>
                      )
                    }
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input value={newRelationType} onChange={e => setNewRelationType(e.target.value.toUpperCase())}
                placeholder="e.g. OVERSEES"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && addRelationType()}
              />
              <button onClick={addRelationType} disabled={configLoading || !newRelationType.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-2 rounded-lg transition">
                <Plus size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">UPPER_SNAKE_CASE only (e.g. OVERSEES, REPORTS_TO).</p>
          </div>
        </div>
      )}
    </div>
  )
}
