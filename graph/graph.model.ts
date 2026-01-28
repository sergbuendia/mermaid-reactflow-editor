export type Graph = {
  meta: GraphMeta
  nodes: Record<NodeId, Node>
  edges: Record<EdgeId, Edge>
  subgraphs: Record<SubgraphId, Subgraph>
}

export type Node = {
  id: NodeId
  label: string
  kind: string
  parent?: SubgraphId
}

export type Edge = {
  id: EdgeId
  from: NodeId
  to: NodeId
  label?: string
  kind: "directed" | "bidirectional"
}

export type Subgraph = {
  id: SubgraphId
  label?: string
  parent?: SubgraphId
  children: NodeId[]
}
