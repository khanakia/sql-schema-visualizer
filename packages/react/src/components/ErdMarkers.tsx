// Crow's-foot ERD marker SVG <defs>. Rendered once per canvas; React
// Flow edges reference them by id (`erd-one`, `erd-many-mandatory`,
// `erd-many-optional`). Color-coded by role to match the in-table
// glyphs (sky FK ↗, amber PK ◆). Stroke comes from CSS classes
// `.erd-marker` / `.erd-marker-fk` / `.erd-marker-pk` in styles.css —
// avoids `context-stroke` which needs Chrome 121+/Safari 16+.
//
// Library consumers building a custom canvas: drop <ErdMarkers /> next
// to your <ReactFlow> and set edge `markerStart`/`markerEnd` to one of
// the exported `ERD_MARKER_*` constants below.

/** Marker id for the "one" side (PK / parent). Single bar + arrowhead. */
export const ERD_MARKER_ONE = 'erd-one'
/** Marker id for the "many" side (FK / child) when the FK is NOT NULL. */
export const ERD_MARKER_MANY_MANDATORY = 'erd-many-mandatory'
/** Marker id for the "many" side when the FK is nullable. */
export const ERD_MARKER_MANY_OPTIONAL = 'erd-many-optional'

export function ErdMarkers() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* PK / "one" end: perpendicular bar PLUS a filled triangle
            arrowhead pointing along the line. */}
        <marker
          id={ERD_MARKER_ONE}
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
          <path d="M 10 4 L 20 10 L 10 16 Z" className="erd-arrow-fill" />
        </marker>
        {/* FK / "many" end, NOT NULL: classic crow's foot. */}
        <marker
          id={ERD_MARKER_MANY_MANDATORY}
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
            front of the crow's foot. */}
        <marker
          id={ERD_MARKER_MANY_OPTIONAL}
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
  )
}
