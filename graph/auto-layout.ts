/**
 * Auto-Layout Service
 *
 * Generates VisualState from GraphModel using Dagre layout algorithm.
 * This provides initial positions when no saved layout exists.
 */

import dagre from "dagre";
import type { Graph, Node, NodeId, SubgraphId } from "./graph.model";
import type { VisualState, NodeVisual, SubgraphVisual, Position, Size } from "./visual.model";
import { LAYOUT_SPACING } from "@/constants/layout";

// Layout configuration
const {
  SUBGRAPH_HEADER_HEIGHT,
  SUBGRAPH_PADDING,
  SUBGRAPH_CONTENT_TOP_MARGIN,
  NODE_SEPARATION_HORIZONTAL,
  NODE_SEPARATION_VERTICAL,
  CONTAINER_SEPARATION_HORIZONTAL,
  CONTAINER_SEPARATION_VERTICAL,
  NESTED_SUBGRAPH_SEPARATION_HORIZONTAL,
  NESTED_SUBGRAPH_SEPARATION_VERTICAL,
  META_GRAPH_MARGIN,
  NESTED_CONTENT_MARGIN,
  MIXED_CONTENT_VERTICAL_SPACING,
  MIXED_CONTENT_HORIZONTAL_SPACING,
} = LAYOUT_SPACING;

const DAGRE_RANKER: "network-simplex" | "tight-tree" | "longest-path" = "tight-tree";

/**
 * Generate VisualState with auto-computed positions from GraphModel.
 * Optionally merges with existing visual state (preserving locked positions).
 */
export function autoLayout(
  graph: Graph,
  existingState?: Partial<VisualState>
): VisualState {
  const direction = graph.meta.direction;

  // Phase 1: Layout each subgraph independently
  const subgraphLayouts = layoutSubgraphs(graph, direction);

  // Phase 2: Layout meta-graph (top-level containers + standalone nodes)
  const { subgraphPositions, standalonePositions } = layoutMetaGraph(
    graph,
    subgraphLayouts,
    direction
  );

  // Phase 3: Build VisualState
  const nodeVisuals: Record<NodeId, NodeVisual> = {};
  const subgraphVisuals: Record<SubgraphId, SubgraphVisual> = {};

  // Process subgraphs
  for (const [subgraphId, layout] of subgraphLayouts) {
    const position = subgraphPositions.get(subgraphId);
    if (!position) continue;

    // Check if locked in existing state
    const existing = existingState?.subgraphs?.[subgraphId];
    if (existing?.locked) {
      subgraphVisuals[subgraphId] = existing;
    } else {
      // Convert to relative position if nested
      const subgraph = graph.subgraphs[subgraphId];
      let finalPosition = position;
      if (subgraph.parent) {
        const parentPos = subgraphPositions.get(subgraph.parent);
        if (parentPos) {
          finalPosition = {
            x: position.x - parentPos.x,
            y: position.y - parentPos.y,
          };
        }
      }

      subgraphVisuals[subgraphId] = {
        position: finalPosition,
        size: { width: layout.width, height: layout.height },
        locked: false,
      };
    }
  }

  // Process nodes
  for (const nodeId of Object.keys(graph.nodes)) {
    const node = graph.nodes[nodeId];

    // Check if locked in existing state
    const existing = existingState?.nodes?.[nodeId];
    if (existing?.locked) {
      nodeVisuals[nodeId] = existing;
      continue;
    }

    let position: Position;
    let size: Size | undefined;

    if (node.parent) {
      // Node in a subgraph - use relative position from subgraph layout
      const subgraphLayout = subgraphLayouts.get(node.parent);
      const nodeLayout = subgraphLayout?.nodes.get(nodeId);
      if (nodeLayout) {
        // Convert from center-based to top-left coordinates
        position = {
          x: nodeLayout.x - nodeLayout.width / 2,
          y: nodeLayout.y - nodeLayout.height / 2,
        };
        size = { width: nodeLayout.width, height: nodeLayout.height };
      } else {
        position = { x: 0, y: 0 };
      }
    } else {
      // Standalone node
      const standalonePos = standalonePositions.get(nodeId);
      position = standalonePos ?? { x: 0, y: 0 };
      size = calculateNodeSize(node);
    }

    nodeVisuals[nodeId] = {
      position,
      size,
      locked: false,
    };
  }

  return {
    nodes: nodeVisuals,
    edges: existingState?.edges ?? {},
    subgraphs: subgraphVisuals,
    viewport: existingState?.viewport,
  };
}

// --- Internal types ---

interface SubgraphLayout {
  id: SubgraphId;
  nodes: Map<NodeId, { x: number; y: number; width: number; height: number }>;
  width: number;
  height: number;
  parentId?: SubgraphId;
}

// --- Helper functions ---

function calculateNodeSize(node: Node): Size {
  const lines = node.label.split("\n");

  // Measure text width (simplified heuristic)
  function measureLineWidth(text: string): number {
    // Approximate width based on character count
    return text.length * 8;
  }

  const maxLineWidth = Math.max(...lines.map((line) => Math.ceil(measureLineWidth(line))));

  const baseWidth = maxLineWidth + 30;
  const baseHeight = lines.length * 18 + 20;

  let width = Math.max(80, baseWidth + 30);
  let height = Math.max(40, baseHeight + 20);

  if (node.kind === "diamond") {
    return {
      width: Math.max(90, Math.ceil(width * 1.05)),
      height: Math.max(90, Math.ceil(height * 1.05)),
    };
  }
  if (node.kind === "circle") {
    const size = Math.max(width, height) + 10;
    return { width: size, height: size };
  }
  return { width, height };
}

function layoutSubgraphs(
  graph: Graph,
  direction: string
): Map<SubgraphId, SubgraphLayout> {
  const layouts = new Map<SubgraphId, SubgraphLayout>();

  // Process subgraphs in hierarchical order (parents before children)
  const orderedSubgraphs = getSubgraphsInHierarchicalOrder(graph);

  for (const subgraphId of orderedSubgraphs) {
    const subgraph = graph.subgraphs[subgraphId];
    if (!subgraph) continue;

    // Get nodes in this subgraph
    const subgraphNodeIds = subgraph.children;
    const subgraphNodes = subgraphNodeIds
      .map((id) => graph.nodes[id])
      .filter((n) => n !== undefined);

    // Get edges within this subgraph
    const subgraphEdges = Object.values(graph.edges).filter((edge) => {
      const sourceNode = graph.nodes[edge.from];
      const targetNode = graph.nodes[edge.to];
      return sourceNode?.parent === subgraphId && targetNode?.parent === subgraphId;
    });

    // Create Dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: subgraph.direction ?? direction,
      nodesep: NODE_SEPARATION_HORIZONTAL,
      ranksep: NODE_SEPARATION_VERTICAL,
      marginx: SUBGRAPH_PADDING,
      marginy: SUBGRAPH_PADDING + SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN,
      ranker: DAGRE_RANKER,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes
    for (const node of subgraphNodes) {
      const size = calculateNodeSize(node);
      g.setNode(node.id, { width: size.width, height: size.height });
    }

    // Add edges
    for (const edge of subgraphEdges) {
      g.setEdge(edge.from, edge.to);
    }

    // Run layout
    dagre.layout(g);

    // Extract positions and calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodePositions = new Map<NodeId, { x: number; y: number; width: number; height: number }>();

    for (const node of subgraphNodes) {
      const nodeLayout = g.node(node.id);
      if (!nodeLayout) continue;

      const size = calculateNodeSize(node);
      nodePositions.set(node.id, {
        x: nodeLayout.x,
        y: nodeLayout.y,
        width: size.width,
        height: size.height,
      });

      minX = Math.min(minX, nodeLayout.x - size.width / 2);
      maxX = Math.max(maxX, nodeLayout.x + size.width / 2);
      minY = Math.min(minY, nodeLayout.y - size.height / 2);
      maxY = Math.max(maxY, nodeLayout.y + size.height / 2);
    }

    // Handle empty subgraphs
    if (subgraphNodes.length === 0 || minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 200;
      maxY = 100;
    }

    // Normalize positions for React Flow coordinate system
    const offsetX = -minX + SUBGRAPH_PADDING;
    const offsetY = -minY + SUBGRAPH_PADDING + SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN;

    nodePositions.forEach((pos, nodeId) => {
      nodePositions.set(nodeId, {
        ...pos,
        x: pos.x + offsetX,
        y: pos.y + offsetY,
      });
    });

    // Calculate subgraph size
    const baseWidth = maxX - minX + SUBGRAPH_PADDING * 2;
    const baseHeight = maxY - minY + SUBGRAPH_PADDING * 2 + SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN;
    const width = baseWidth + 4;
    const height = baseHeight + 4;

    layouts.set(subgraphId, {
      id: subgraphId,
      nodes: nodePositions,
      width,
      height,
      parentId: subgraph.parent,
    });
  }

  // Recalculate parent sizes to accommodate nested subgraphs
  recalculateParentSizes(layouts, graph, direction);

  return layouts;
}

function recalculateParentSizes(
  layouts: Map<SubgraphId, SubgraphLayout>,
  graph: Graph,
  direction: string
): void {
  const orderedSubgraphs = getSubgraphsInHierarchicalOrder(graph);

  // Process in reverse order (children first)
  for (let i = orderedSubgraphs.length - 1; i >= 0; i--) {
    const subgraphId = orderedSubgraphs[i];
    const layout = layouts.get(subgraphId);
    if (!layout) continue;

    // Find child subgraphs
    const childSubgraphs = orderedSubgraphs.filter(
      (id) => graph.subgraphs[id]?.parent === subgraphId
    );

    if (childSubgraphs.length === 0) continue;

    const isHorizontal = direction === "LR" || direction === "RL";

    let maxContentRight = 0;
    let maxContentBottom = 0;

    // Consider existing nodes
    layout.nodes.forEach((nodePos) => {
      maxContentRight = Math.max(maxContentRight, nodePos.x + nodePos.width / 2);
      maxContentBottom = Math.max(maxContentBottom, nodePos.y + nodePos.height / 2);
    });

    // Consider child subgraphs
    for (const childId of childSubgraphs) {
      const childLayout = layouts.get(childId);
      if (!childLayout) continue;

      const estimatedChildX = isHorizontal
        ? Math.max(
            SUBGRAPH_PADDING + childLayout.width / 2,
            maxContentRight + MIXED_CONTENT_HORIZONTAL_SPACING + childLayout.width / 2
          )
        : SUBGRAPH_PADDING + childLayout.width / 2;

      const estimatedChildY = isHorizontal
        ? Math.max(
            SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN + SUBGRAPH_PADDING + childLayout.height / 2,
            childLayout.height / 2
          )
        : Math.max(
            SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN + SUBGRAPH_PADDING + childLayout.height / 2,
            maxContentBottom + MIXED_CONTENT_VERTICAL_SPACING + childLayout.height / 2
          );

      maxContentRight = Math.max(maxContentRight, estimatedChildX + childLayout.width / 2);
      maxContentBottom = Math.max(maxContentBottom, estimatedChildY + childLayout.height / 2);
    }

    const minRequiredWidth = maxContentRight + SUBGRAPH_PADDING * 3;
    const minRequiredHeight = maxContentBottom + SUBGRAPH_PADDING * 3;

    layout.width = Math.max(layout.width, minRequiredWidth, 300);
    layout.height = Math.max(layout.height, minRequiredHeight, 200);
  }
}

function layoutMetaGraph(
  graph: Graph,
  subgraphLayouts: Map<SubgraphId, SubgraphLayout>,
  direction: string
): {
  subgraphPositions: Map<SubgraphId, Position>;
  standalonePositions: Map<NodeId, Position>;
} {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: CONTAINER_SEPARATION_HORIZONTAL,
    ranksep: CONTAINER_SEPARATION_VERTICAL,
    marginx: META_GRAPH_MARGIN,
    marginy: META_GRAPH_MARGIN,
    ranker: DAGRE_RANKER,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add top-level subgraphs as nodes
  for (const [subgraphId, layout] of subgraphLayouts) {
    if (!layout.parentId) {
      g.setNode(subgraphId, { width: layout.width, height: layout.height });
    }
  }

  // Add standalone nodes
  const standaloneNodes = Object.values(graph.nodes).filter((n) => !n.parent);
  for (const node of standaloneNodes) {
    const size = calculateNodeSize(node);
    g.setNode(node.id, { width: size.width, height: size.height });
  }

  // Add edges between containers
  const connectionWeights = calculateConnectionWeights(graph);
  for (const [sourceId, targets] of connectionWeights) {
    for (const [targetId, weight] of targets) {
      const sourceLayout = subgraphLayouts.get(sourceId);
      const targetLayout = subgraphLayouts.get(targetId);

      // Skip parent-child relationships
      if (
        (sourceLayout && sourceLayout.parentId === targetId) ||
        (targetLayout && targetLayout.parentId === sourceId)
      ) {
        continue;
      }

      const sourceIsTopLevel = !sourceLayout || !sourceLayout.parentId;
      const targetIsTopLevel = !targetLayout || !targetLayout.parentId;

      if (sourceIsTopLevel && targetIsTopLevel && g.hasNode(sourceId) && g.hasNode(targetId)) {
        if (!g.hasEdge(sourceId, targetId)) {
          g.setEdge(sourceId, targetId, { weight });
        }
      }
    }
  }

  dagre.layout(g);

  // Extract positions
  const subgraphPositions = new Map<SubgraphId, Position>();
  const standalonePositions = new Map<NodeId, Position>();

  // Position top-level subgraphs
  for (const [subgraphId, layout] of subgraphLayouts) {
    if (!layout.parentId) {
      const node = g.node(subgraphId);
      if (node) {
        subgraphPositions.set(subgraphId, {
          x: node.x - layout.width / 2,
          y: node.y - layout.height / 2,
        });
      }
    }
  }

  // Position nested subgraphs
  positionNestedSubgraphs(graph, subgraphLayouts, subgraphPositions, connectionWeights, direction);

  // Position standalone nodes
  for (const node of standaloneNodes) {
    const nodeLayout = g.node(node.id);
    if (nodeLayout) {
      const size = calculateNodeSize(node);
      standalonePositions.set(node.id, {
        x: nodeLayout.x - size.width / 2,
        y: nodeLayout.y - size.height / 2,
      });
    }
  }

  return { subgraphPositions, standalonePositions };
}

function positionNestedSubgraphs(
  graph: Graph,
  layouts: Map<SubgraphId, SubgraphLayout>,
  positions: Map<SubgraphId, Position>,
  connectionWeights: Map<string, Map<string, number>>,
  direction: string
): void {
  const processedParents = new Set<SubgraphId>();
  let madeProgress = true;
  let iterations = 0;

  while (madeProgress && iterations < 100) {
    iterations++;
    madeProgress = false;

    for (const [subgraphId] of layouts) {
      if (positions.has(subgraphId) && !processedParents.has(subgraphId)) {
        const progressed = layoutChildrenWithinParent(
          subgraphId,
          graph,
          layouts,
          positions,
          connectionWeights,
          direction
        );
        if (progressed) {
          madeProgress = true;
          processedParents.add(subgraphId);
        }
      }
    }
  }
}

function layoutChildrenWithinParent(
  parentId: SubgraphId,
  graph: Graph,
  layouts: Map<SubgraphId, SubgraphLayout>,
  positions: Map<SubgraphId, Position>,
  connectionWeights: Map<string, Map<string, number>>,
  direction: string
): boolean {
  const parentPos = positions.get(parentId);
  const parentLayout = layouts.get(parentId);
  if (!parentPos || !parentLayout) return false;

  // Find direct child subgraphs
  const childIds = Array.from(layouts.keys()).filter(
    (id) => graph.subgraphs[id]?.parent === parentId
  );

  if (childIds.length === 0) return false;

  // Calculate occupied space by parent nodes
  let maxNodeBottom = 0;
  parentLayout.nodes.forEach((nodePos) => {
    maxNodeBottom = Math.max(maxNodeBottom, nodePos.y + nodePos.height / 2);
  });

  // Build Dagre graph for children
  const cg = new dagre.graphlib.Graph();
  cg.setGraph({
    rankdir: direction,
    nodesep: NESTED_SUBGRAPH_SEPARATION_HORIZONTAL,
    ranksep: NESTED_SUBGRAPH_SEPARATION_VERTICAL,
    marginx: NESTED_CONTENT_MARGIN,
    marginy: NESTED_CONTENT_MARGIN,
    ranker: DAGRE_RANKER,
  });
  cg.setDefaultEdgeLabel(() => ({}));

  // Add children
  for (const childId of childIds) {
    const childLayout = layouts.get(childId)!;
    cg.setNode(childId, { width: childLayout.width, height: childLayout.height });
  }

  // Add edges between children
  let hasEdges = false;
  for (const sourceId of childIds) {
    const targets = connectionWeights.get(sourceId);
    if (!targets) continue;
    for (const [targetId, weight] of targets) {
      if (childIds.includes(targetId) && !cg.hasEdge(sourceId, targetId)) {
        cg.setEdge(sourceId, targetId, { weight });
        hasEdges = true;
      }
    }
  }

  // Create simple chain if no edges
  if (!hasEdges && childIds.length > 1) {
    for (let i = 0; i < childIds.length - 1; i++) {
      cg.setEdge(childIds[i], childIds[i + 1], { weight: 1 });
    }
  }

  dagre.layout(cg);

  // Compute bounding box
  let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  const childTopLefts = new Map<string, Position>();

  for (const childId of childIds) {
    const n = cg.node(childId);
    const cl = layouts.get(childId)!;
    const left = n.x - cl.width / 2;
    const top = n.y - cl.height / 2;
    childTopLefts.set(childId, { x: left, y: top });
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, n.x + cl.width / 2);
    maxBottom = Math.max(maxBottom, n.y + cl.height / 2);
  }

  // Calculate content origin
  const isHorizontal = direction === "LR" || direction === "RL";
  let contentOriginX = parentPos.x + SUBGRAPH_PADDING;
  let contentOriginY = parentPos.y + SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN + SUBGRAPH_PADDING;

  if (isHorizontal) {
    const parentNodesMaxRight = Array.from(parentLayout.nodes.values()).reduce(
      (acc, n) => Math.max(acc, n.x + n.width / 2),
      0
    );
    if (parentNodesMaxRight > 0) {
      contentOriginX = Math.max(
        contentOriginX,
        parentPos.x + parentNodesMaxRight + MIXED_CONTENT_HORIZONTAL_SPACING
      );
    }
  } else if (maxNodeBottom > 0) {
    contentOriginY = Math.max(
      contentOriginY,
      parentPos.y + maxNodeBottom + MIXED_CONTENT_VERTICAL_SPACING
    );
  }

  // Calculate centering offset
  const availableWidth = parentLayout.width - SUBGRAPH_PADDING * 2;
  const contentWidth = maxRight - minLeft;
  const centerOffsetX = isHorizontal ? Math.max(0, (availableWidth - contentWidth) / 2) : 0;

  // Position children
  for (const childId of childIds) {
    const tl = childTopLefts.get(childId)!;
    const absX = contentOriginX + centerOffsetX + (tl.x - minLeft);
    const absY = contentOriginY + (tl.y - minTop);
    positions.set(childId, { x: absX, y: absY });
  }

  return true;
}

function calculateConnectionWeights(
  graph: Graph
): Map<string, Map<string, number>> {
  const weights = new Map<string, Map<string, number>>();

  for (const edge of Object.values(graph.edges)) {
    const sourceNode = graph.nodes[edge.from];
    const targetNode = graph.nodes[edge.to];
    if (!sourceNode || !targetNode) continue;

    const sourceContainer = sourceNode.parent || sourceNode.id;
    const targetContainer = targetNode.parent || targetNode.id;

    if (sourceContainer === targetContainer) continue;

    if (!weights.has(sourceContainer)) {
      weights.set(sourceContainer, new Map<string, number>());
    }

    const sourceWeights = weights.get(sourceContainer)!;
    const currentWeight = sourceWeights.get(targetContainer) || 0;
    sourceWeights.set(targetContainer, currentWeight + 1);
  }

  return weights;
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

  // Add any remaining (circular references)
  for (const subgraphId of Object.keys(graph.subgraphs)) {
    if (!processed.has(subgraphId)) {
      result.push(subgraphId);
    }
  }

  return result;
}
