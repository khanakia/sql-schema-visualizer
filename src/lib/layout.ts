import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

const NODE_WIDTH = 260
const ROW_HEIGHT = 28
const HEADER_HEIGHT = 40
// Rough extra height per node when comments are shown inline (table comment
// strip + per-column comment lines). Only used for the FIRST paint; the
// measured re-layout pass in Canvas replaces these estimates with real
// rendered heights so nodes never overlap regardless of wrapping.
const COMMENT_PAD = 22

export function layout(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
  collapsed: Record<string, true> = {},
  commentsInline = false,
  /** id -> measured size; when present it wins over the estimate */
  sizes?: Map<string, { width: number; height: number }>,
): Node[] {
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
    const cols = (n.data as { columns?: unknown[] }).columns?.length ?? 1
    let height = collapsed[n.id]
      ? HEADER_HEIGHT
      : HEADER_HEIGHT + cols * ROW_HEIGHT + 8
    if (!collapsed[n.id] && commentsInline) {
      // assume ~half the columns carry a (possibly wrapped) comment line
      height += COMMENT_PAD + Math.ceil(cols / 2) * COMMENT_PAD
    }
    g.setNode(n.id, { width: NODE_WIDTH, height })
  }
  for (const e of edges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  return nodes.map((n) => {
    const p = g.node(n.id)
    return {
      ...n,
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
    }
  })
}
