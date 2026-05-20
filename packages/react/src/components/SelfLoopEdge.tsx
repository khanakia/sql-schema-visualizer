import { BaseEdge, type EdgeProps } from '@xyflow/react'

/**
 * Self-referential FK edge (e.g. employees.manager_id -> employees.id).
 * A normal smoothstep edge degenerates when source and target are the same
 * node, so we draw a clean rounded loop off the node's right side, entering
 * back at the target row. This is the conventional ER representation.
 */
export function SelfLoopEdge({
  id,
  sourceX,
  sourceY,
  targetY,
  markerStart,
  markerEnd,
  style,
}: EdgeProps) {
  // bow out to the right and curve back to the target row's right edge
  const reach = 60
  const path = `M ${sourceX} ${sourceY} C ${sourceX + reach} ${sourceY}, ${
    sourceX + reach
  } ${targetY}, ${sourceX} ${targetY}`
  // Forward BOTH markers so self-referential FKs (e.g. employees.manager_id
  // -> employees.id) still show the crow's-foot/one ERD notation at both
  // ends — same convention as cross-table edges.
  return (
    <BaseEdge
      id={id}
      path={path}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
    />
  )
}
