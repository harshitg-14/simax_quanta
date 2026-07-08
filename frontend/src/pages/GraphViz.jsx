import { useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react'
import { toPng } from 'html-to-image'
import '@xyflow/react/dist/style.css'
import { Search, RefreshCw, Info, Download, Filter, Image } from 'lucide-react'
import api from '../api'

const DEFAULT_TYPE_COLORS = {
  Scheme: '#3b82f6', Ministry: '#8b5cf6', Department: '#f59e0b',
  Beneficiary: '#10b981', Organization: '#ec4899', Policy: '#06b6d4',
  Act: '#f97316', Location: '#6b7280', Person: '#84cc16', Entity: '#374151',
}
const EXTRA_COLORS = ['#ef4444', '#a78bfa', '#34d399', '#fb923c', '#38bdf8', '#f472b6']

function layoutNodes(nodes) {
  const n = nodes.length
  const radius = Math.max(350, n * 35)
  return nodes.map((node, i) => {
    const labelLen = (node.data?.label || '').length
    const nodeWidth = Math.max(110, Math.min(240, labelLen * 7 + 24))
    return {
      ...node,
      position: {
        x: radius * Math.cos((2 * Math.PI * i) / n) + radius,
        y: radius * Math.sin((2 * Math.PI * i) / n) + radius,
      },
      style: { ...node.style, width: nodeWidth, whiteSpace: 'nowrap', overflow: 'visible' },
    }
  })
}

export default function GraphViz() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading]       = useState(true)
  const [exporting, setExporting]   = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [search, setSearch]         = useState('')
  const [stats, setStats]           = useState({ nodes: 0, edges: 0 })
  const [limit, setLimit]           = useState(80)
  const [entityTypes, setEntityTypes]   = useState([])
  const [typeFilter, setTypeFilter]     = useState('')
  const [typeColorMap, setTypeColorMap] = useState(DEFAULT_TYPE_COLORS)

  const flowWrapperRef = useRef(null)

  useEffect(() => {
    api.get('/graph/config')
      .then(({ data }) => {
        const allTypes = data.entity_types || []
        const colorMap = { ...DEFAULT_TYPE_COLORS }
        allTypes.forEach((t, i) => {
          if (!colorMap[t]) colorMap[t] = EXTRA_COLORS[i % EXTRA_COLORS.length]
        })
        setTypeColorMap(colorMap)
      })
      .catch(() => {})

    api.get('/graph/types')
      .then(({ data }) => setEntityTypes(data.types || []))
      .catch(() => {})
  }, [])

  const load = useCallback((lim = limit, ef = typeFilter) => {
    setLoading(true)
    setSelectedNode(null)
    setSelectedEdge(null)
    const params = { limit: lim, ...(ef ? { entity_type: ef } : {}) }
    api.get('/graph/viz', { params })
      .then(({ data }) => {
        const laid = layoutNodes(data.nodes || [])
        setNodes(laid)
        setEdges((data.edges || []).map(e => ({
          ...e,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#4b5563', strokeWidth: 1.5 },
          labelStyle: { fontSize: '10px', fill: '#d1d5db', fontWeight: 500 },
          labelBgStyle: { fill: '#111827', fillOpacity: 0.85 },
          labelBgPadding: [4, 2],
        })))
        setStats({ nodes: data.total_nodes, edges: data.total_edges })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [limit, typeFilter])

  useEffect(() => { load() }, [])

  const onNodeClick = (_, node) => {
    setSelectedNode({ name: node.data.label, type: node.data.type })
    setSelectedEdge(null)
  }

  const onEdgeClick = (_, edge) => {
    setSelectedEdge({ source: edge.source, relation: edge.label, target: edge.target })
    setSelectedNode(null)
  }

  const exportJson = async () => {
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

  const exportPng = async () => {
    const el = flowWrapperRef.current
    if (!el) return
    setExporting(true)
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#030712',
        quality: 1,
        pixelRatio: 2,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'knowledge_graph.png'
      a.click()
    } catch (err) {
      console.error('PNG export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const displayNodes = nodes.map(n => ({
    ...n,
    style: {
      ...n.style,
      opacity: search
        ? (n.data.label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0.1)
        : 1,
      outline: selectedNode?.name === n.data.label ? '2px solid #60a5fa' : 'none',
    }
  }))

  const filtered = search
    ? nodes.filter(n => n.data.label.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-gray-400 text-sm mt-0.5">{stats.nodes} entities · {stats.edges} relationships</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search highlight */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Highlight entity..."
              className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-44"
            />
          </div>

          {/* Entity type filter */}
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); load(limit, e.target.value) }}
              className="pl-7 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none appearance-none"
            >
              <option value="">All Types</option>
              {entityTypes.map(t => (
                <option key={t.type} value={t.type}>{t.type} ({t.count})</option>
              ))}
            </select>
          </div>

          {/* Node limit — up to 1000 */}
          <select
            value={limit}
            onChange={e => { setLimit(+e.target.value); load(+e.target.value, typeFilter) }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
          >
            <option value={40}>40 nodes</option>
            <option value={80}>80 nodes</option>
            <option value={150}>150 nodes</option>
            <option value={300}>300 nodes</option>
            <option value={500}>500 nodes</option>
            <option value={1000}>1000 nodes</option>
          </select>

          <button
            onClick={() => load(limit, typeFilter)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            <RefreshCw size={14} /> Reload
          </button>

          {/* Export JSON */}
          <button
            onClick={exportJson}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
            title="Export graph as JSON"
          >
            <Download size={14} /> JSON
          </button>

          {/* Export PNG */}
          <button
            onClick={exportPng}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm transition"
            title="Save graph as PNG image"
          >
            {exporting
              ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              : <Image size={14} />
            }
            PNG
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Canvas */}
        <div ref={flowWrapperRef} className="flex-1 rounded-xl border border-gray-800 overflow-hidden bg-gray-950">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : stats.nodes === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>No graph data yet.</p>
              <p className="text-sm mt-1">Upload documents to build the knowledge graph.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null) }}
              fitView
              fitViewOptions={{ padding: 0.15, includeHiddenNodes: false }}
              minZoom={0.05}
              maxZoom={2}
            >
              <Background color="#1f2937" gap={20} />
              <Controls style={{ background: '#111827', border: '1px solid #374151' }} />
              <MiniMap
                nodeColor={n => n.style?.background || '#374151'}
                style={{ background: '#111827', border: '1px solid #374151' }}
                maskColor="rgba(0,0,0,0.5)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Side panel */}
        <div className="w-56 space-y-4 overflow-y-auto">
          {/* Legend — shows all configured types */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Entity Types</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {Object.entries(typeColorMap)
                .filter(([t]) => t !== 'Entity')
                .map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2 text-xs text-gray-300">
                    <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: color }} />
                    {type}
                  </div>
                ))}
            </div>
          </div>

          {/* Selected node */}
          {selectedNode && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-blue-400" />
                <h3 className="text-sm font-semibold">Selected Entity</h3>
              </div>
              <div
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white mb-2 break-words"
                style={{ background: typeColorMap[selectedNode.type] || '#374151' }}
              >
                {selectedNode.name}
              </div>
              <div className="text-xs text-gray-400">
                Type: <span className="text-gray-200">{selectedNode.type}</span>
              </div>
            </div>
          )}

          {/* Selected edge */}
          {selectedEdge && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-green-400" />
                <h3 className="text-sm font-semibold">Relationship</h3>
              </div>
              <div className="text-xs space-y-1.5">
                <div><span className="text-gray-500">From: </span><span className="text-blue-300 break-words">{selectedEdge.source}</span></div>
                <div className="text-center text-gray-500 font-mono text-[10px] bg-gray-800 rounded px-2 py-0.5">[{selectedEdge.relation}]</div>
                <div><span className="text-gray-500">To: </span><span className="text-green-300 break-words">{selectedEdge.target}</span></div>
              </div>
            </div>
          )}

          {/* Search matches */}
          {search && filtered.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2">Matches ({filtered.length})</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filtered.slice(0, 20).map((n, i) => (
                  <div key={i} className="text-xs text-gray-300 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: typeColorMap[n.data.type] || '#374151' }} />
                    {n.data.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
