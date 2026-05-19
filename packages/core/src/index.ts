// @sqlviz/core — framework-agnostic SQL schema parsing, layout & share codec.
// Zero runtime deps except dagre. Works in Node, browsers and workers.

export {
  parseSchema,
  type Schema,
  type Table,
  type Column,
  type ForeignKey,
} from './parser'

export {
  layoutGraph,
  type LayoutNode,
  type LayoutEdge,
  type LayoutOptions,
  type Point,
} from './layout'

export { encodeSql, decodeSql } from './share'

export { samples, type Sample } from './samples'
