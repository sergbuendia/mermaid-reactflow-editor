export type VisualState = {
  nodes: Record<NodeId, NodeVisual>
  edges: Record<EdgeId, EdgeVisual>
  viewport?: Viewport
}

export type NodeVisual = {
  position: { x: number; y: number }
  locked?: boolean
}

export type EdgeVisual = {
  bendPoints?: { x: number; y: number }[]
}

export type Viewport = {
  zoom: number
  pan: { x: number; y: number }
}
