/**
 * React Flow Adapter
 *
 * TASK-02: GraphModel to React Flow adapter
 * - React Flow IDs map 1:1 to GraphModel IDs
 * - Positions come ONLY from VisualState
 * - No semantic logic inside UI layer
 */

import { Node as RFNode, Edge as RFEdge, MarkerType, Position } from "reactflow";
import type { Graph, Node, NodeId, SubgraphId } from "./graph.model";
import type { VisualState } from "./visual.model";

export interface ReactFlowData {
  nodes: RFNode[];
  edges: RFEdge[];
}

// Color schemes for nodes based on shape
const NODE_COLORS: Record<string, [string, string]> = {
  rect: ["#E3F2FD", "#1976D2"],
  diamond: ["#FFF3E0", "#F57C00"],
  circle: ["#E8F5E8", "#388E3C"],
  stadium: ["#F3E5F5", "#7B1FA2"],
  round: ["#FCE4EC", "#C2185B"],
};

const DEFAULT_NODE_COLORS: [string, string] = ["#F0F4F8", "#2D3748"];

// Color schemes for subgraphs
const SUBGRAPH_COLORS = [
  { bg: "rgba(227, 242, 253, 0.4)", border: "#1976D2" },
  { bg: "rgba(232, 245, 233, 0.4)", border: "#388E3C" },
  { bg: "rgba(243, 229, 245, 0.4)", border: "#7B1FA2" },
  { bg: "rgba(255, 243, 224, 0.4)", border: "#F57C00" },
  { bg: "rgba(252, 228, 236, 0.4)", border: "#C2185B" },
];

// Edge colors for variety
const EDGE_COLORS = ["#1976D2", "#388E3C", "#F57C00", "#7B1FA2", "#C2185B"];

/**
 * Convert GraphModel + VisualState to React Flow elements.
 *
 * @param graph - Semantic graph model
 * @param visualState - Layout/visual state
 * @returns React Flow nodes and edges
 */
export function toReactFlow(graph: Graph, visualState: VisualState): ReactFlowData {
  const reactFlowNodes: RFNode[] = [];
  const reactFlowEdges: RFEdge[] = [];

  const direction = graph.meta.direction;
  const isHorizontal = direction === "LR" || direction === "RL";

  // 1. Create subgraph container nodes (in hierarchical order)
  const orderedSubgraphs = getSubgraphsInHierarchicalOrder(graph);
  orderedSubgraphs.forEach((subgraphId, index) => {
    const subgraph = graph.subgraphs[subgraphId];
    const visual = visualState.subgraphs[subgraphId];
    if (!visual) return;

    const colors = SUBGRAPH_COLORS[index % SUBGRAPH_COLORS.length];

    reactFlowNodes.push({
      id: `subgraph-${subgraphId}`,
      type: "group",
      position: visual.position,
      data: {
        label: subgraph.label || subgraphId,
        isSubgraph: true,
      },
      style: {
        backgroundColor: colors.bg,
        border: `3px solid ${colors.border}`,
        borderRadius: "12px",
        width: visual.size.width,
        height: visual.size.height,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        zIndex: 0,
      },
      selectable: true,
      draggable: !visual.locked,
      connectable: true,
      parentNode: subgraph.parent ? `subgraph-${subgraph.parent}` : undefined,
      extent: subgraph.parent ? "parent" : undefined,
      zIndex: subgraph.parent ? 1 : 0,
    });
  });

  // 2. Create regular nodes
  for (const nodeId of Object.keys(graph.nodes)) {
    const node = graph.nodes[nodeId];
    const visual = visualState.nodes[nodeId];
    if (!visual) continue;

    const rfNode = createReactFlowNode(node, visual, direction);
    reactFlowNodes.push(rfNode);
  }

  // 3. Create edges
  let edgeIndex = 0;
  for (const edgeId of Object.keys(graph.edges)) {
    const edge = graph.edges[edgeId];
    const edgeVisual = visualState.edges[edgeId];

    const rfEdge = createReactFlowEdge(
      edgeId,
      edge.from,
      edge.to,
      edge.label,
      edge.kind,
      edgeIndex++,
      isHorizontal,
      graph,
      edgeVisual?.bendPoints
    );
    reactFlowEdges.push(rfEdge);
  }

  return { nodes: reactFlowNodes, edges: reactFlowEdges };
}

// --- Helper functions ---

function createReactFlowNode(
  node: Node,
  visual: { position: { x: number; y: number }; size?: { width: number; height: number }; locked?: boolean },
  direction: string
): RFNode {
  const colors = NODE_COLORS[node.kind] || DEFAULT_NODE_COLORS;
  const [backgroundColor, borderColor] = colors;

  const isHorizontal = direction === "LR" || direction === "RL";
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
  const targetPos = isHorizontal ? Position.Left : Position.Top;

  // Base style
  const baseStyle: Record<string, unknown> = {
    backgroundColor,
    borderColor,
    borderWidth: "2px",
    borderStyle: "solid",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  };

  // Adjust for shape
  switch (node.kind) {
    case "diamond":
      baseStyle.borderRadius = "0px";
      break;
    case "circle":
      baseStyle.borderRadius = "50%";
      break;
    case "stadium":
      baseStyle.borderRadius = "30px";
      break;
    case "round":
      baseStyle.borderRadius = "15px";
      break;
  }

  // Size from visual state or defaults
  const width = visual.size?.width ?? 150;
  const height = visual.size?.height ?? 60;

  // Separate visual vs layout styles
  const { backgroundColor: bg, borderColor: bc, borderWidth: bw, borderStyle: bs, borderRadius: br, boxShadow: shadow } = baseStyle;
  const visualStyle = { backgroundColor: bg, borderColor: bc, borderWidth: bw, borderStyle: bs, borderRadius: br, boxShadow: shadow };

  const nodeType = node.kind === "diamond" ? "diamond" : "custom";

  return {
    id: node.id,
    type: nodeType,
    position: visual.position,
    data: {
      label: node.label,
      imageUrl: "",
      description: "",
      shape: node.kind,
      colors: { backgroundColor, borderColor },
      style: nodeType === "diamond"
        ? { backgroundColor: bg, borderColor: bc, borderWidth: bw }
        : visualStyle,
    },
    style: { width, height },
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    parentNode: node.parent ? `subgraph-${node.parent}` : undefined,
    extent: node.parent ? "parent" : undefined,
    draggable: !visual.locked,
    zIndex: 1,
  };
}

function createReactFlowEdge(
  edgeId: string,
  fromId: NodeId,
  toId: NodeId,
  label: string | undefined,
  kind: "directed" | "bidirectional",
  index: number,
  isHorizontal: boolean,
  graph: Graph,
  bendPoints?: { x: number; y: number }[]
): RFEdge {
  const edgeColor = EDGE_COLORS[index % EDGE_COLORS.length];

  // Check if source/target are subgraphs
  const isSourceSubgraph = graph.subgraphs[fromId] !== undefined;
  const isTargetSubgraph = graph.subgraphs[toId] !== undefined;

  const sourceId = isSourceSubgraph ? `subgraph-${fromId}` : fromId;
  const targetId = isTargetSubgraph ? `subgraph-${toId}` : toId;

  const edgeStyle: Record<string, unknown> = {
    stroke: edgeColor,
    strokeWidth: 2.5,
  };

  // For bidirectional edges, add marker at start as well
  const markerStart = kind === "bidirectional"
    ? {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: edgeColor,
      }
    : undefined;

  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    label: label,
    type: "smoothstep",
    animated: true,
    style: edgeStyle,
    labelStyle: {
      fontSize: "12px",
      fontWeight: "500",
      color: edgeColor,
      backgroundColor: "white",
      padding: "2px 6px",
      borderRadius: "4px",
      border: `1px solid ${edgeColor}`,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: edgeColor,
    },
    markerStart,
    sourceHandle: isHorizontal ? "right-source" : "bottom-source",
    targetHandle: isHorizontal ? "left-target" : "top-target",
    zIndex: 0,
    // TODO: Apply bendPoints for edge routing when supported
    data: { bendPoints },
  };
}

function getSubgraphsInHierarchicalOrder(graph: Graph): SubgraphId[] {
  const result: SubgraphId[] = [];
  const processed = new Set<SubgraphId>();

  // First pass: add all subgraphs without parents
  for (const subgraphId of Object.keys(graph.subgraphs)) {
    const subgraph = graph.subgraphs[subgraphId];
    if (!subgraph.parent) {
      result.push(subgraphId);
      processed.add(subgraphId);
    }
  }

  // Process remaining in order
  let lastCount = 0;
  while (processed.size < Object.keys(graph.subgraphs).length && lastCount !== processed.size) {
    lastCount = processed.size;

    for (const subgraphId of Object.keys(graph.subgraphs)) {
      const subgraph = graph.subgraphs[subgraphId];
      if (!processed.has(subgraphId) && subgraph.parent && processed.has(subgraph.parent)) {
        result.push(subgraphId);
        processed.add(subgraphId);
      }
    }
  }

  // Add any remaining
  for (const subgraphId of Object.keys(graph.subgraphs)) {
    if (!processed.has(subgraphId)) {
      result.push(subgraphId);
    }
  }

  return result;
}

/**
 * Convenience function: Parse Mermaid code and render with auto-layout.
 * Combines parser + auto-layout + adapter in one call.
 */
export { parseMermaidToGraph } from "./mermaid-parser";
export { autoLayout } from "./auto-layout";
