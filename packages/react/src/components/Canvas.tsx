import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useStore } from '../store'
import { layoutGraph, type LayoutOptions } from '@khanakia/sql-schema-core'
import { TableNode } from './TableNode'
import { Toolbar } from './Toolbar'
import { SelfLoopEdge } from './SelfLoopEdge'

const nodeTypes = { table: TableNode }
const edgeTypes = { selfloop: SelfLoopEdge }

/** Adapt React Flow nodes to the framework-agnostic core layout. */
function applyLayout(
  rfNodes: Node[],
  edges: Edge[],
  opts: LayoutOptions,
): Node[] {
  const pos = layoutGraph(
    rfNodes.map((n) => ({
      id: n.id,
      columns: (n.data as { columns?: unknown[] }).columns?.length ?? 1,
    })),
    edges,
    opts,
  )
  return rfNodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
}

function Flow(props: SchemaCanvasProps) {
  const schema = useStore((s) => s.schema)
  const search = useStore((s) => s.search)
  const direction = useStore((s) => s.direction)
  const collapsed = useStore((s) => s.collapsed)
  const focus = useStore((s) => s.focus)
  const theme = useStore((s) => s.theme)
  const commentMode = useStore((s) => s.commentMode)
  const { fitView, setCenter, getNode, getNodes, getViewport, setViewport } =
    useReactFlow()
  const nodesInitialized = useNodesInitialized()

  const pal =
    theme === 'light'
      ? {
          dots: '#d2d6df',
          exportBg: '#f6f7f9',
          mmNode: '#c4b5fd',
          mmMask: 'rgba(255,255,255,0.6)',
        }
      : {
          dots: '#23252f',
          exportBg: '#0a0b0f',
          mmNode: '#3b2f5c',
          mmMask: 'rgba(10,11,15,0.7)',
        }

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
        type: fk.fromTable === fk.toTable ? 'selfloop' : 'smoothstep',
        animated: false,
        data: { from: fk.fromTable, to: fk.toTable },
      }))
    return { baseNodes, baseEdges }
  }, [schema])

  const laidOut = useMemo(
    () =>
      applyLayout(baseNodes, baseEdges, {
        direction,
        collapsed,
        commentsInline: commentMode === 'inline',
      }),
    [baseNodes, baseEdges, direction, collapsed, commentMode],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut)
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges)

  const relayoutNonce = useStore((s) => s.relayoutNonce)

  // estimate paint; the measured pass below owns fit-view
  useEffect(() => {
    setNodes(laidOut)
    setEdges(baseEdges)
  }, [laidOut, baseEdges, setNodes, setEdges, relayoutNonce])

  // Measured re-layout: once nodes have rendered, re-run dagre using their
  // REAL heights (estimates ignore wrapped comment lines), so nodes never
  // overlap regardless of comment mode / text wrapping. Keyed by a signature
  // so it runs once per layout-affecting change, not on every render.
  const lastSig = useRef('')
  const lastFitSig = useRef('')
  useEffect(() => {
    if (!nodesInitialized) return
    // everything that changes layout EXCEPT a manual Reset
    const fitSig = JSON.stringify([
      schema.tables.map((t) => t.name),
      direction,
      Object.keys(collapsed).sort(),
      commentMode,
    ])
    const sig = JSON.stringify([fitSig, relayoutNonce])
    if (sig === lastSig.current) return
    // Reset (only relayoutNonce changed) repositions nodes but must NOT
    // move the viewport — the user stays where they are.
    const shouldFit = fitSig !== lastFitSig.current
    const measure = () => {
      const cur = getNodes()
      const sizes = new Map(
        cur.map((n) => [
          n.id,
          {
            width: n.measured?.width ?? 260,
            height: n.measured?.height ?? 0,
          },
        ]),
      )
      // bail until heights are actually known, retry next frame
      if ([...sizes.values()].some((s) => s.height === 0)) {
        requestAnimationFrame(measure)
        return
      }
      lastSig.current = sig
      lastFitSig.current = fitSig
      const vp = getViewport()
      setNodes(
        applyLayout(cur, baseEdges, { direction, collapsed, sizes }),
      )
      requestAnimationFrame(() => {
        if (shouldFit) fitView({ padding: 0.15, duration: 300 })
        // Reset (no fit): pin the camera exactly where the user left it,
        // overriding any internal viewport change from replacing nodes.
        else setViewport(vp)
      })
    }
    requestAnimationFrame(measure)
  }, [
    nodesInitialized,
    schema,
    direction,
    collapsed,
    commentMode,
    relayoutNonce,
    baseEdges,
    getNodes,
    setNodes,
    fitView,
    getViewport,
    setViewport,
  ])

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
      backgroundColor: pal.exportBg,
      width: vp.offsetWidth,
      height: vp.offsetHeight,
      style: { width: `${vp.offsetWidth}px`, height: `${vp.offsetHeight}px` },
    }).then((url) => {
      const a = document.createElement('a')
      a.download = 'schema.png'
      a.href = url
      a.click()
    })
  }, [pal.exportBg])

  const {
    showToolbar = true,
    showMinimap = true,
    showControls = true,
    showBackground = true,
    showHint = true,
    minZoom = 0.05,
    maxZoom = 2.5,
    fitViewPadding = 0.15,
    panOnScroll = true,
    zoomOnScroll = false,
    zoomOnDoubleClick = true,
    panOnDrag = true,
    className,
    style,
    onTableClick,
    reactFlowProps,
  } = props

  return (
    <div
      ref={wrapRef}
      className={`h-full w-full${className ? ` ${className}` : ''}`}
      style={style}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, n) => onTableClick?.(n.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={minZoom}
        maxZoom={maxZoom}
        panOnScroll={panOnScroll}
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch
        zoomOnDoubleClick={zoomOnDoubleClick}
        panOnDrag={panOnDrag}
        zoomActivationKeyCode={['Meta', 'Control']}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        {...reactFlowProps}
      >
        {showBackground && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color={pal.dots}
          />
        )}
        {showControls && <Controls showInteractive={false} />}
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            nodeColor={pal.mmNode}
            maskColor={pal.mmMask}
          />
        )}
      </ReactFlow>
      {showToolbar && (
        <Toolbar
          onFit={() => fitView({ padding: fitViewPadding, duration: 400 })}
          onExport={onExport}
        />
      )}
      {showHint && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--text-soft)]">
          scroll <span className="text-[var(--text)]">pan</span> ·
          ⌘/Ctrl+scroll <span className="text-[var(--text)]">zoom</span> ·
          double-click <span className="text-[var(--text)]">zoom in</span>
        </div>
      )}
    </div>
  )
}

export interface SchemaCanvasProps {
  /** floating toolbar (default true) */
  showToolbar?: boolean
  /** minimap (default true) */
  showMinimap?: boolean
  /** zoom controls (default true) */
  showControls?: boolean
  /** dotted background (default true) */
  showBackground?: boolean
  /** the pan/zoom hint chip (default true) */
  showHint?: boolean
  /** zoom bounds (defaults 0.05 / 2.5) */
  minZoom?: number
  maxZoom?: number
  /** padding used by fit-view (default 0.15) */
  fitViewPadding?: number
  /** Figma-style nav — override any of these */
  panOnScroll?: boolean
  zoomOnScroll?: boolean
  zoomOnDoubleClick?: boolean
  panOnDrag?: boolean
  className?: string
  style?: CSSProperties
  /** fires with the table name when a node is clicked */
  onTableClick?: (table: string) => void
  /** escape hatch: props spread onto the underlying <ReactFlow> (wins) */
  reactFlowProps?: Record<string, unknown>
}

export function Canvas(props: SchemaCanvasProps = {}) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  )
}
