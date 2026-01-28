/**
 * Graph Module - MVP Implementation
 *
 * Architecture:
 *   Mermaid Code → GraphModel → VisualState → React Flow
 *
 * Key Components:
 * - GraphModel (graph.model.ts): Semantic representation of the diagram
 * - VisualState (visual.model.ts): Layout-only representation
 * - MermaidParser (mermaid-parser.ts): Mermaid code → GraphModel
 * - AutoLayout (auto-layout.ts): GraphModel → VisualState (using Dagre)
 * - ReactFlowAdapter (reactflow-adapter.ts): GraphModel + VisualState → React Flow
 *
 * Rules (from ARCHITECTURE.md):
 * - GraphModel contains NO visual information
 * - VisualState contains NO semantic information
 * - UI changes VisualState only
 * - Mermaid code is never mutated in MVP
 */

// Types - GraphModel (semantic)
export type {
  Graph,
  Node,
  Edge,
  Subgraph,
  NodeId,
  EdgeId,
  SubgraphId,
  NodeKind,
  EdgeKind,
  GraphMeta,
  // C4 types
  C4Node,
  C4Edge,
  C4Boundary,
  C4ElementType,
  C4BoundaryType,
} from "./graph.model";

// Type guards for C4
export { isC4Node, isC4Edge, isC4Boundary } from "./graph.model";

// Types - VisualState (layout)
export type {
  VisualState,
  NodeVisual,
  EdgeVisual,
  SubgraphVisual,
  Viewport,
  Position,
  Size,
} from "./visual.model";

// Parser: Mermaid → GraphModel
export { parseMermaidToGraph } from "./mermaid-parser";

// Layout: GraphModel → VisualState
export { autoLayout } from "./auto-layout";

// Adapter: GraphModel + VisualState → React Flow
export { toReactFlow } from "./reactflow-adapter";
export type { ReactFlowData } from "./reactflow-adapter";

/**
 * High-level convenience function for the full pipeline:
 * Mermaid code → React Flow elements (with auto-layout)
 */
import { parseMermaidToGraph } from "./mermaid-parser";
import { autoLayout } from "./auto-layout";
import { toReactFlow, ReactFlowData } from "./reactflow-adapter";
import type { Graph } from "./graph.model";
import type { VisualState } from "./visual.model";

export interface ConversionResult {
  graph: Graph;
  visualState: VisualState;
  reactFlow: ReactFlowData;
}

/**
 * Convert Mermaid code to React Flow elements using the three-layer architecture.
 *
 * @param mermaidCode - Mermaid diagram source code
 * @param existingVisualState - Optional existing layout to preserve (e.g., from saved file)
 * @returns Graph model, visual state, and React Flow elements
 */
export function convertMermaid(
  mermaidCode: string,
  existingVisualState?: Partial<VisualState>
): ConversionResult {
  // Layer 1: Parse Mermaid → GraphModel (semantic)
  const graph = parseMermaidToGraph(mermaidCode);

  // Layer 2: Generate VisualState (auto-layout, preserving locked positions)
  const visualState = autoLayout(graph, existingVisualState);

  // Layer 3: Convert to React Flow elements
  const reactFlow = toReactFlow(graph, visualState);

  return { graph, visualState, reactFlow };
}
