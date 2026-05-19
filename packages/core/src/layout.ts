import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 260
const ROW_HEIGHT = 28
const HEADER_HEIGHT = 40
// Rough extra height per node when comments are shown inline (table comment
// strip + per-column comment lines). Only used for the FIRST paint; a
// measured re-layout pass (with real rendered heights) replaces the estimate
// so nodes never overlap regardless of wrapping.
const COMMENT_PAD = 22

export interface LayoutNode {
  id: string
  /** number of columns the table has (drives the height estimate) */
  columns: number
}

export interface LayoutEdge {
  source: string
  target: string
}

export interface LayoutOptions {
  direction?: 'LR' | 'TB'
  /** set of node ids that are collapsed to just their header */
  collapsed?: Record<string, true>
  /** add height for inline comment lines in the first-paint estimate */
  commentsInline?: boolean
  /** id -> measured size; when present it wins over the estimate */
  sizes?: Map<string, { width: number; height: number }>
}

export interface Point {
  x: number
  y: number
}

/**
 * Framework-agnostic dagre layout. Given table ids + FK edges (and optionally
 * real measured sizes), returns the top-left position for each node id.
 * Adapters (e.g. the React Flow wrapper) map these onto their node objects.
 */
export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: LayoutOptions = {},
): Map<string, Point> {
  const { direction = 'LR', collapsed = {}, commentsInline = false, sizes } =
    opts
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of nodes) {
    const measured = sizes?.get(n.id)
    if (measured && measured.height > 0) {
      g.setNode(n.id, { width: measured.width, height: measured.height })
      continue
    }
    const cols = n.columns || 1
    let height = collapsed[n.id]
      ? HEADER_HEIGHT
      : HEADER_HEIGHT + cols * ROW_HEIGHT + 8
    if (!collapsed[n.id] && commentsInline) {
      height += COMMENT_PAD + Math.ceil(cols / 2) * COMMENT_PAD
    }
    g.setNode(n.id, { width: NODE_WIDTH, height })
  }
  for (const e of edges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  const out = new Map<string, Point>()
  for (const n of nodes) {
    const p = g.node(n.id)
    out.set(n.id, { x: p.x - p.width / 2, y: p.y - p.height / 2 })
  }
  return out
}
