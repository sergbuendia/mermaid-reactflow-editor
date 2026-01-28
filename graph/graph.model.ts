/**
 * GraphModel - Semantic representation of the diagram
 *
 * ARCHITECTURAL RULE: GraphModel contains NO visual information.
 * This layer represents the pure semantic structure extracted from Mermaid code.
 */

// Type aliases for stable identifiers
export type NodeId = string;
export type EdgeId = string;
export type SubgraphId = string;

// Node shape types supported by Mermaid flowcharts
export type NodeKind =
  | "rect"       // [label] - rectangle
  | "round"      // (label) - rounded rectangle
  | "stadium"    // ([label]) - stadium shape
  | "circle"     // ((label)) - circle
  | "diamond";   // {label} - diamond/rhombus

// C4 Model element types
export type C4ElementType =
  | "person"           // Human user
  | "person_ext"       // External human user
  | "system"           // Software system
  | "system_ext"       // External software system
  | "system_db"        // Database system
  | "system_queue"     // Queue/messaging system
  | "container"        // Container within a system
  | "container_ext"    // External container
  | "container_db"     // Database container
  | "container_queue"  // Queue container
  | "component"        // Component within a container
  | "component_ext"    // External component
  | "component_db"     // Database component
  | "component_queue"; // Queue component

// C4 Boundary types
export type C4BoundaryType =
  | "enterprise"       // Enterprise boundary
  | "system"           // System boundary
  | "container"        // Container boundary
  | "boundary";        // Generic boundary

// Edge direction types
export type EdgeKind = "directed" | "bidirectional";

// Graph metadata
export type GraphMeta = {
  direction: "TB" | "BT" | "LR" | "RL";
  title?: string;
  diagramType?: "flowchart" | "c4context";  // Type of diagram
};

// Semantic node - NO visual properties
export type Node = {
  id: NodeId;
  label: string;
  kind: NodeKind;
  parent?: SubgraphId;
};

// C4 specific node properties
export type C4Node = Node & {
  c4Type: C4ElementType;
  description?: string;
  technology?: string;
  sprite?: string;       // Optional icon/sprite
  tags?: string[];       // Optional tags for styling
};

// Semantic edge - NO visual properties
export type Edge = {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  label?: string;
  kind: EdgeKind;
};

// C4 specific edge properties
export type C4Edge = Edge & {
  technology?: string;    // Technology/protocol used
  description?: string;   // Detailed description
  sprite?: string;        // Optional icon/sprite
  tags?: string[];        // Optional tags for styling
};

// Subgraph container - NO visual properties
export type Subgraph = {
  id: SubgraphId;
  label?: string;
  parent?: SubgraphId;
  children: NodeId[];
  direction?: "TB" | "BT" | "LR" | "RL"; // Optional per-subgraph direction
};

// C4 Boundary (extends Subgraph concept)
export type C4Boundary = Subgraph & {
  boundaryType: C4BoundaryType;
  tags?: string[];
};

// Complete semantic graph
export type Graph = {
  meta: GraphMeta;
  nodes: Record<NodeId, Node | C4Node>;
  edges: Record<EdgeId, Edge | C4Edge>;
  subgraphs: Record<SubgraphId, Subgraph | C4Boundary>;
};

// Type guard for C4 nodes
export function isC4Node(node: Node | C4Node): node is C4Node {
  return "c4Type" in node;
}

// Type guard for C4 edges
export function isC4Edge(edge: Edge | C4Edge): edge is C4Edge {
  return "technology" in edge || ("description" in edge && edge.kind !== undefined);
}

// Type guard for C4 boundaries
export function isC4Boundary(subgraph: Subgraph | C4Boundary): subgraph is C4Boundary {
  return "boundaryType" in subgraph;
}
