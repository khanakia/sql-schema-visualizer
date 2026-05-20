import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  const groups = useStore((s) => s.groups)
  const activeGroup = useStore((s) => s.activeGroup)
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

  // Visible-table set when a group is active. Members are filtered to
  // tables that still exist in the current schema (stale names — e.g.
  // a table removed from SQL — silently drop from the view but stay
  // in `groups` so re-adding the table re-includes it). When no group
  // is active, this is null → show every table.
  const visibleSet = useMemo<Set<string> | null>(() => {
    if (!activeGroup) return null
    const members = groups[activeGroup]
    if (!members) return null
    const known = new Set(schema.tables.map((t) => t.name))
    return new Set(members.filter((m) => known.has(m)))
  }, [activeGroup, groups, schema])

  const { baseNodes, baseEdges } = useMemo(() => {
    const known = new Set(schema.tables.map((t) => t.name))
    const visTables = visibleSet
      ? schema.tables.filter((t) => visibleSet.has(t.name))
      : schema.tables
    const baseNodes: Node[] = visTables.map((t) => ({
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
    // For crow's-foot markers we need the FK column's nullability:
    // NOT NULL FK -> exactly "one or many" (mandatory many); nullable
    // FK -> "zero or many" (optional many, drawn with the extra circle).
    // Build a quick name -> column lookup so we don't scan tables per
    // edge.
    const colByTable = new Map(
      schema.tables.map((t) => [
        t.name,
        new Map(t.columns.map((c) => [c.name, c])),
      ]),
    )
    const inView = (name: string) =>
      visibleSet ? visibleSet.has(name) : known.has(name)
    const baseEdges: Edge[] = schema.foreignKeys
      .filter((fk) => inView(fk.fromTable) && inView(fk.toTable))
      .map((fk, i) => {
        const fkCol = colByTable.get(fk.fromTable)?.get(fk.fromColumn)
        const optional = fkCol?.nullable ?? false
        return {
          id: `e${i}-${fk.fromTable}-${fk.toTable}`,
          source: fk.fromTable,
          target: fk.toTable,
          sourceHandle: fk.fromColumn,
          targetHandle: fk.toColumn,
          type: fk.fromTable === fk.toTable ? 'selfloop' : 'smoothstep',
          animated: false,
          // Crow's-foot ERD notation:
          //   source = FK side ("many"); marker is crow's foot, with an
          //     extra circle when the FK is nullable ("zero or many").
          //   target = referenced PK side ("one"); marker is a single
          //     perpendicular bar.
          // Markers themselves are defined in the <svg defs> rendered
          // inside the canvas wrapper and reference context-stroke so
          // they inherit the edge's color in light/dark/hover states.
          // React Flow wraps the given marker id in `url(#…)` itself, so
          // pass the BARE id here — not `url(#erd-…)` (that double-wraps
          // into `url('#url(#erd-…)')`, which is invalid and renders
          // nothing).
          markerStart: optional ? 'erd-many-optional' : 'erd-many-mandatory',
          markerEnd: 'erd-one',
          data: { from: fk.fromTable, to: fk.toTable },
        }
      })
    return { baseNodes, baseEdges }
  }, [schema, visibleSet])

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

  // If the active group has zero visible members in the current schema
  // (e.g. its tables were renamed/removed in the SQL), auto-clear the
  // filter so the user sees the (full) schema rather than a blank
  // canvas. Group membership itself is left untouched — re-adding the
  // tables in SQL would restore the group.
  useEffect(() => {
    if (activeGroup && visibleSet && visibleSet.size === 0) {
      useStore.getState().setActiveGroup(null)
    }
  }, [activeGroup, visibleSet])

  // Right-click context menu state for the "Groups" submenu. Targets
  // ONE OR MORE tables: if the right-clicked node is part of a current
  // multi-selection (Shift- / ⌘-Cmd-clicked), the menu acts on the
  // whole selection in one shot — that's the bulk-add affordance. If
  // not, it acts on just that single node. Null when closed.
  const [ctxMenu, setCtxMenu] = useState<
    { x: number; y: number; tableIds: string[] } | null
  >(null)

  // Dismiss the ctx menu on Escape or any mousedown outside it.
  useEffect(() => {
    if (!ctxMenu) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t && t.closest('[data-groups-ctxmenu]')) return
      setCtxMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  // Keyboard shortcuts for "navigation back". Two combos, either works:
  //   - Alt/Option + ←   (browser-back convention; Cmd+← also fires here)
  //   - Cmd/Ctrl + [     (Safari / VS Code "Navigate Back")
  // Deliberately NOT plain Backspace — React Flow's default
  // `deleteKeyCode` is Backspace/Delete and on macOS the Delete key IS
  // Backspace, so binding Backspace to back-nav would clash with the
  // "delete selected table" behavior we want to keep working.
  // Bound on window in CAPTURE phase so React Flow's own listeners
  // can't intercept first. Suppressed inside text inputs so it doesn't
  // hijack caret movement / word-jump shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isBracketBack = e.key === '[' && (e.metaKey || e.ctrlKey)
      const isArrowBack =
        e.key === 'ArrowLeft' && (e.altKey || e.metaKey)
      if (!isBracketBack && !isArrowBack) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      )
        return
      const { history, back } = useStore.getState()
      if (history.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      back()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

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
      {/*
        Crow's-foot ERD marker definitions, rendered once per canvas.
        Hidden zero-sized SVG so the markers exist in the DOM and can be
        referenced by id from edge markerStart/markerEnd. `context-stroke`
        makes them inherit the referencing edge's stroke color, so they
        automatically follow theme (light/dark via --edge) AND hover/
        selected state (--accent) without needing parallel marker sets.
        Conventions:
          erd-one             single bar  — "exactly one" (target / PK)
          erd-many-mandatory  crow's foot — "one or many"    (NOT NULL FK)
          erd-many-optional   circle + foot — "zero or many" (nullable FK)
      */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          {/* PK / "one" end: perpendicular bar PLUS a filled triangle
              arrowhead pointing along the line. Bar = traditional ER
              notation; arrowhead = obvious directional cue (the line
              points TO the parent table). Amber matches the in-table
              PK ◆ glyph. */}
          <marker
            id="erd-one"
            viewBox="0 0 22 20"
            markerWidth="11"
            markerHeight="10"
            refX="20"
            refY="10"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <line
              x1="6"
              y1="2"
              x2="6"
              y2="18"
              className="erd-marker erd-marker-pk"
            />
            <path
              d="M 10 4 L 20 10 L 10 16 Z"
              className="erd-arrow-fill"
            />
          </marker>
          {/* FK / "many" end, NOT NULL: classic crow's foot in sky-blue,
              matches the in-table FK ↗ glyph. */}
          <marker
            id="erd-many-mandatory"
            viewBox="0 0 24 24"
            markerWidth="12"
            markerHeight="12"
            refX="2"
            refY="12"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M 2 12 L 22 2 M 2 12 L 22 12 M 2 12 L 22 22"
              className="erd-marker erd-marker-fk"
            />
          </marker>
          {/* FK / "many" end, nullable: a small circle ("zero or") in
              front of the crow's foot. Same sky-blue. */}
          <marker
            id="erd-many-optional"
            viewBox="0 0 32 24"
            markerWidth="16"
            markerHeight="12"
            refX="2"
            refY="12"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <circle
              cx="9"
              cy="12"
              r="3.5"
              className="erd-marker erd-marker-fk"
            />
            <path
              d="M 14 12 L 30 2 M 14 12 L 30 12 M 14 12 L 30 22"
              className="erd-marker erd-marker-fk"
            />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, n) => onTableClick?.(n.id)}
        onNodeContextMenu={(e, n) => {
          // Suppress browser context menu so our Groups submenu can own
          // the right-click on table nodes. The pane and edges still
          // get the default browser menu — keeps debugging accessible.
          e.preventDefault()
          // Collect the current multi-selection. If the right-clicked
          // node is part of it, the menu acts on the whole selection
          // (bulk add). Otherwise act on just the right-clicked node.
          const selectedIds = getNodes()
            .filter((node) => node.selected)
            .map((node) => node.id)
          const tableIds =
            selectedIds.length > 1 && selectedIds.includes(n.id)
              ? selectedIds
              : [n.id]
          setCtxMenu({ x: e.clientX, y: e.clientY, tableIds })
        }}
        // Click an FK edge -> jump to the OPPOSITE end of where we're
        // currently focused (ping-pong). With no current focus, jump
        // to the target (the referenced PK side) — the natural "follow"
        // direction. stopPropagation prevents the pane click from
        // clearing selection mid-animation.
        onEdgeClick={(e, edge) => {
          e.stopPropagation()
          const { focus, focusTable } = useStore.getState()
          const onTarget = focus?.table === edge.target
          const next = onTarget ? edge.source : edge.target
          const nextCol = onTarget
            ? edge.sourceHandle ?? undefined
            : edge.targetHandle ?? undefined
          focusTable(next, nextCol)
        }}
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
      {ctxMenu && (
        <GroupsContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          tableIds={ctxMenu.tableIds}
          onClose={() => setCtxMenu(null)}
        />
      )}
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

/**
 * The right-click "Groups ▸" menu for a table node. Lists current
 * memberships with ✓ (click toggles off) and other groups (click adds).
 * "+ New group" prompts a name. Positioned absolutely at the click;
 * dismissed by the parent's click-outside / Escape effect.
 *
 * The `data-groups-ctxmenu` attribute is the marker that effect uses to
 * detect clicks inside the menu and NOT dismiss.
 */
function GroupsContextMenu({
  x,
  y,
  tableIds,
  onClose,
}: {
  x: number
  y: number
  tableIds: string[]   // 1+ targets; >1 = bulk multi-select action
  onClose: () => void
}) {
  const groups = useStore((s) => s.groups)
  const addToGroup = useStore((s) => s.addToGroup)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const createGroup = useStore((s) => s.createGroup)
  const entries = Object.entries(groups)
  const isMulti = tableIds.length > 1
  // Friendly label for the menu header + buttons.
  const targetLabel = isMulti
    ? `${tableIds.length} tables selected`
    : tableIds[0]
  return (
    <div
      data-groups-ctxmenu
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 240),
        top: Math.min(y, window.innerHeight - 220),
        zIndex: 50,
      }}
      className="min-w-[220px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 text-xs shadow-xl"
    >
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
        Groups — {targetLabel}
      </div>
      {entries.length === 0 && (
        <div className="px-3 py-1 text-[11px] text-[var(--text-soft)]">
          No groups yet.
        </div>
      )}
      {entries.map(([name, members]) => {
        // For bulk semantics: all-in => "Remove all"; some-in or none-in
        // => "Add missing" (adds the ones not already members). This is
        // the most common intent and keeps the menu single-button per
        // group rather than two confusing modes.
        const memberSet = new Set(members)
        const inCount = tableIds.filter((t) => memberSet.has(t)).length
        const allIn = inCount === tableIds.length
        return (
          <button
            key={name}
            type="button"
            onClick={() => {
              if (allIn) {
                // Remove every selected from this group.
                for (const t of tableIds) removeFromGroup(name, t)
              } else {
                // Add only the ones not already in (addToGroup dedups
                // internally but skipping known ones is clearer).
                addToGroup(
                  name,
                  tableIds.filter((t) => !memberSet.has(t)),
                )
              }
              onClose()
            }}
            className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[var(--surface-2)]"
          >
            <span className="w-3 text-purple-400">{allIn ? '✓' : ''}</span>
            <span className="flex-1 truncate text-[var(--text)]">{name}</span>
            <span className="text-[10px] text-[var(--text-soft)]">
              {allIn
                ? isMulti
                  ? `Remove all (${inCount})`
                  : 'Remove'
                : isMulti
                  ? `Add ${tableIds.length - inCount}${
                      inCount > 0 ? ` (${inCount} already in)` : ''
                    }`
                  : 'Add'}
            </span>
          </button>
        )
      })}
      <div className="my-1 h-px bg-[var(--border-soft)]" />
      <button
        type="button"
        onClick={() => {
          const placeholder = isMulti ? '' : tableIds[0]
          const n = window.prompt(
            isMulti
              ? `New group containing ${tableIds.length} tables:`
              : `New group from "${tableIds[0]}":`,
            placeholder,
          )
          if (n === null) return
          const trimmed = n.trim()
          if (!trimmed) return
          createGroup(trimmed)
          addToGroup(trimmed, tableIds)
          onClose()
        }}
        className="flex w-full items-center gap-2 px-3 py-1 text-left text-[var(--text)] hover:bg-[var(--surface-2)]"
      >
        <span className="w-3 text-[var(--text-soft)]">+</span>
        <span>
          {isMulti
            ? `New group from ${tableIds.length} tables…`
            : 'New group from this table…'}
        </span>
      </button>
    </div>
  )
}
