import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useStore } from '../store'
import { layout } from '../lib/layout'
import { TableNode } from './TableNode'

const nodeTypes = { table: TableNode }

function Flow() {
  const schema = useStore((s) => s.schema)
  const search = useStore((s) => s.search)
  const direction = useStore((s) => s.direction)
  const focus = useStore((s) => s.focus)
  const { fitView, setCenter, getNode } = useReactFlow()

  const q = search.trim().toLowerCase()

  const { baseNodes, baseEdges } = useMemo(() => {
    const known = new Set(schema.tables.map((t) => t.name))
    const baseNodes: Node[] = schema.tables.map((t) => ({
      id: t.name,
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        label: t.name,
        columns: t.columns,
        tableComment: t.comment,
        dim: false,
        matched: false,
      },
    }))
    const baseEdges: Edge[] = schema.foreignKeys
      .filter((fk) => known.has(fk.fromTable) && known.has(fk.toTable))
      .map((fk, i) => ({
        id: `e${i}-${fk.fromTable}-${fk.toTable}`,
        source: fk.fromTable,
        target: fk.toTable,
        sourceHandle: fk.fromColumn,
        targetHandle: fk.toColumn,
        type: 'smoothstep',
        animated: false,
        data: { from: fk.fromTable, to: fk.toTable },
      }))
    return { baseNodes, baseEdges }
  }, [schema])

  const laidOut = useMemo(
    () => layout(baseNodes, baseEdges, direction),
    [baseNodes, baseEdges, direction],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut)
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges)

  // re-apply layout when schema / direction changes
  useEffect(() => {
    setNodes(laidOut)
    setEdges(baseEdges)
    requestAnimationFrame(() => fitView({ padding: 0.15, duration: 400 }))
  }, [laidOut, baseEdges, setNodes, setEdges, fitView])

  // search highlight + connected-edge emphasis (matches table OR any column)
  useEffect(() => {
    const tableMatches = (n: Node) => {
      if (q.length === 0) return false
      if (n.id.toLowerCase().includes(q)) return true
      const cols = (n.data as { columns?: { name: string }[] }).columns ?? []
      return cols.some((c) => c.name.toLowerCase().includes(q))
    }
    setNodes((ns) =>
      ns.map((n) => {
        const matched = tableMatches(n)
        return {
          ...n,
          data: {
            ...n.data,
            matched,
            dim: q.length > 0 && !matched,
            queryCol: q,
          },
        }
      }),
    )
    setEdges((es) =>
      es.map((e) => {
        const sn = getNode(e.source)
        const tn = getNode(e.target)
        return {
          ...e,
          animated:
            q.length > 0 &&
            !!((sn && tableMatches(sn)) || (tn && tableMatches(tn))),
        }
      }),
    )
  }, [q, setNodes, setEdges, getNode])

  // click-to-navigate: center + zoom on the focused table, flag its column
  useEffect(() => {
    if (!focus) return
    const n = getNode(focus.table)
    if (!n) return
    setNodes((ns) =>
      ns.map((node) => ({
        ...node,
        selected: node.id === focus.table,
        data: {
          ...node.data,
          focusCol: node.id === focus.table ? focus.column ?? null : null,
        },
      })),
    )
    const w = n.measured?.width ?? 260
    const h = n.measured?.height ?? 140
    requestAnimationFrame(() =>
      setCenter(n.position.x + w / 2, n.position.y + h / 2, {
        zoom: 1.1,
        duration: 600,
      }),
    )
  }, [focus, getNode, setCenter, setNodes])

  const wrapRef = useRef<HTMLDivElement>(null)
  const onExport = useCallback(() => {
    const vp = wrapRef.current?.querySelector(
      '.react-flow__viewport',
    ) as HTMLElement | null
    if (!vp) return
    toPng(vp, {
      backgroundColor: '#0a0b0f',
      width: vp.offsetWidth,
      height: vp.offsetHeight,
      style: { width: `${vp.offsetWidth}px`, height: `${vp.offsetHeight}px` },
    }).then((url) => {
      const a = document.createElement('a')
      a.download = 'schema.png'
      a.href = url
      a.click()
    })
  }, [])

  return (
    <div ref={wrapRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.05}
        maxZoom={2.5}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick
        panOnDrag
        zoomActivationKeyCode={['Meta', 'Control']}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#23252f" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#3b2f5c"
          maskColor="rgba(10,11,15,0.7)"
        />
      </ReactFlow>
      <button
        onClick={onExport}
        className="absolute right-4 top-4 z-10 rounded-md border border-[#2a2c37] bg-[#1a1b23] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-[#25262f]"
      >
        Export PNG
      </button>
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-md border border-[#2a2c37] bg-[#14151b]/80 px-2.5 py-1.5 text-[10px] leading-relaxed text-gray-500">
        scroll <span className="text-gray-300">pan</span> · ⌘/Ctrl+scroll{' '}
        <span className="text-gray-300">zoom</span> · double-click{' '}
        <span className="text-gray-300">zoom in</span>
      </div>
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}
