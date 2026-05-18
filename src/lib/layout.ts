import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

const NODE_WIDTH = 260
const ROW_HEIGHT = 28
const HEADER_HEIGHT = 40

export function layout(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of nodes) {
    const cols = (n.data as { columns?: unknown[] }).columns?.length ?? 1
    g.setNode(n.id, {
      width: NODE_WIDTH,
      height: HEADER_HEIGHT + cols * ROW_HEIGHT + 8,
    })
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
