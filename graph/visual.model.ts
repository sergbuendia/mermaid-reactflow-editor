/**
 * VisualState - Layout-only representation
 *
 * ARCHITECTURAL RULE: VisualState contains NO semantic information.
 * This layer stores visual layout data that can be persisted separately from the graph.
 */

import type { NodeId, EdgeId, SubgraphId } from "./graph.model";

// Position in 2D space
export type Position = {
  x: number;
  y: number;
};

// Size dimensions
export type Size = {
  width: number;
  height: number;
};

// Visual properties for a node
export type NodeVisual = {
  position: Position;
  size?: Size;       // Optional - can be computed from content if not specified
  locked?: boolean;  // If true, node position should not be changed by auto-layout
};

// Visual properties for an edge
export type EdgeVisual = {
  bendPoints?: Position[];  // Control points for edge routing
};

// Visual properties for a subgraph container
export type SubgraphVisual = {
  position: Position;
  size: Size;
  locked?: boolean;
};

// Canvas viewport state
export type Viewport = {
  zoom: number;
  pan: Position;
};

// Complete visual state for the entire diagram
export type VisualState = {
  nodes: Record<NodeId, NodeVisual>;
  edges: Record<EdgeId, EdgeVisual>;
  subgraphs: Record<SubgraphId, SubgraphVisual>;
  viewport?: Viewport;
};

// Re-export types used from graph.model for convenience
export type { NodeId, EdgeId, SubgraphId };
