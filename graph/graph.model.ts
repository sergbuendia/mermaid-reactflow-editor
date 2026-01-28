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

// Node shape types supported by Mermaid
export type NodeKind =
  | "rect"       // [label] - rectangle
  | "round"      // (label) - rounded rectangle
  | "stadium"    // ([label]) - stadium shape
  | "circle"     // ((label)) - circle
  | "diamond";   // {label} - diamond/rhombus

// Edge direction types
export type EdgeKind = "directed" | "bidirectional";

// Graph metadata
export type GraphMeta = {
  direction: "TB" | "BT" | "LR" | "RL";
  title?: string;
};

// Semantic node - NO visual properties
export type Node = {
  id: NodeId;
  label: string;
  kind: NodeKind;
  parent?: SubgraphId;
};

// Semantic edge - NO visual properties
export type Edge = {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  label?: string;
  kind: EdgeKind;
};

// Subgraph container - NO visual properties
export type Subgraph = {
  id: SubgraphId;
  label?: string;
  parent?: SubgraphId;
  children: NodeId[];
  direction?: "TB" | "BT" | "LR" | "RL"; // Optional per-subgraph direction
};

// Complete semantic graph
export type Graph = {
  meta: GraphMeta;
  nodes: Record<NodeId, Node>;
  edges: Record<EdgeId, Edge>;
  subgraphs: Record<SubgraphId, Subgraph>;
};
