/**
 * Mermaid Parser - Converts Mermaid code to GraphModel
 *
 * TASK-01: Mermaid to GraphModel parser
 * - IDs must NOT depend on node position
 * - IDs must survive layout changes
 * - Subgraphs must be preserved
 *
 * Supports:
 * - Flowchart diagrams (graph, flowchart)
 * - C4Context diagrams (C4Context)
 */

import type {
  Graph,
  Node,
  Edge,
  Subgraph,
  NodeId,
  EdgeId,
  SubgraphId,
  NodeKind,
  GraphMeta,
  C4Node,
  C4Edge,
  C4Boundary,
  C4ElementType,
  C4BoundaryType,
} from "./graph.model";

/**
 * Detect diagram type from Mermaid code.
 */
function detectDiagramType(code: string): "flowchart" | "c4context" {
  const trimmedCode = code.trim().toLowerCase();
  if (trimmedCode.startsWith("c4context")) {
    return "c4context";
  }
  return "flowchart";
}

/**
 * Parse Mermaid code and produce a semantic GraphModel.
 * No visual/layout information is included.
 * Automatically detects diagram type (flowchart or C4Context).
 */
export function parseMermaidToGraph(mermaidCode: string): Graph {
  const diagramType = detectDiagramType(mermaidCode);

  if (diagramType === "c4context") {
    return parseC4Context(mermaidCode);
  }

  return parseFlowchart(mermaidCode);
}

/**
 * Parse Flowchart/Graph diagram.
 */
function parseFlowchart(mermaidCode: string): Graph {
  const nodeMap: Record<NodeId, Node> = {};
  const edgeMap: Record<EdgeId, Edge> = {};
  const subgraphMap: Record<SubgraphId, Subgraph> = {};
  const nodeDefinitions = new Map<
    string,
    { label: string; kind: NodeKind; fullDef: string }
  >();

  // Default direction
  let direction: GraphMeta["direction"] = "TB";

  // Clean up code: remove comments and normalize
  let cleanCode = mermaidCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"))
    .join("\n");

  // Handle multi-line node definitions
  cleanCode = preprocessMultilineDefinitions(cleanCode);

  // Parse graph direction
  const directionMatch = cleanCode.match(
    /(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)/i
  );
  if (directionMatch) {
    direction = directionMatch[1].toUpperCase() as GraphMeta["direction"];
    if (direction === ("TD" as GraphMeta["direction"])) direction = "TB";
  }

  const lines = cleanCode.split("\n");
  const subgraphStack: SubgraphId[] = [];

  // Pre-scan for all node definitions
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (
      !trimmedLine ||
      trimmedLine.startsWith("subgraph") ||
      trimmedLine === "end" ||
      trimmedLine.startsWith("%%")
    ) {
      return;
    }
    scanNodeDefinitions(trimmedLine, nodeDefinitions);
  });

  // First pass: identify all subgraphs
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("subgraph")) {
      const subgraphInfo = parseSubgraphLine(line, i, subgraphStack);
      if (subgraphInfo) {
        const parentId =
          subgraphStack.length > 0
            ? subgraphStack[subgraphStack.length - 1]
            : undefined;

        subgraphStack.push(subgraphInfo.id);

        const subgraph: Subgraph = {
          id: subgraphInfo.id,
          label: subgraphInfo.label,
          parent: parentId,
          children: [],
          direction: undefined,
        };

        subgraphMap[subgraphInfo.id] = subgraph;

        // Update parent's reference
        if (parentId && subgraphMap[parentId]) {
          // Note: children[] tracks node IDs, not nested subgraph IDs
          // Nested subgraphs are tracked via the parent field on the child
        }
      }
    } else if (line.toLowerCase().startsWith("direction ")) {
      // Per-subgraph direction
      const dirMatch = line.match(/^direction\s+(TB|TD|BT|RL|LR)$/i);
      if (dirMatch && subgraphStack.length > 0) {
        const top = subgraphStack[subgraphStack.length - 1];
        if (subgraphMap[top]) {
          const d = dirMatch[1].toUpperCase();
          subgraphMap[top].direction = (
            d === "TD" ? "TB" : d
          ) as Subgraph["direction"];
        }
      }
    } else if (line === "end" && subgraphStack.length > 0) {
      subgraphStack.pop();
    }
  }

  // Reset stack for second pass
  subgraphStack.length = 0;

  // Second pass: process nodes and edges
  let edgeIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("subgraph")) {
      const info = parseSubgraphLine(line, i, subgraphStack);
      if (info) {
        subgraphStack.push(info.id);
      }
      continue;
    }

    if (line === "end") {
      if (subgraphStack.length > 0) subgraphStack.pop();
      continue;
    }

    if (
      line.startsWith("direction ") ||
      line.startsWith("flowchart ") ||
      line.startsWith("graph ") ||
      line.startsWith("%%")
    ) {
      continue;
    }

    const currentSubgraph =
      subgraphStack.length > 0
        ? subgraphStack[subgraphStack.length - 1]
        : undefined;

    // Try parsing as an edge
    const edgeResult = parseEdgeLine(line);
    if (edgeResult) {
      const { sourceId, targetId, edgeType, edgeLabel } = edgeResult;

      // Check if source/target are subgraphs
      const isSourceSubgraph = subgraphMap[sourceId] !== undefined;
      const isTargetSubgraph = subgraphMap[targetId] !== undefined;

      // Create source node if not a subgraph and not exists
      if (!isSourceSubgraph && !nodeMap[sourceId]) {
        nodeMap[sourceId] = createNode(
          sourceId,
          currentSubgraph,
          nodeDefinitions
        );
        if (currentSubgraph && subgraphMap[currentSubgraph]) {
          subgraphMap[currentSubgraph].children.push(sourceId);
        }
      }

      // Create target node if not a subgraph and not exists
      if (!isTargetSubgraph && !nodeMap[targetId]) {
        nodeMap[targetId] = createNode(
          targetId,
          currentSubgraph,
          nodeDefinitions
        );
        if (currentSubgraph && subgraphMap[currentSubgraph]) {
          subgraphMap[currentSubgraph].children.push(targetId);
        }
      }

      // Create edge
      const edgeId: EdgeId = `e-${sourceId}-${targetId}-${edgeIndex++}`;
      const edgeKind = edgeType === "<->" ? "bidirectional" : "directed";

      edgeMap[edgeId] = {
        id: edgeId,
        from: sourceId,
        to: targetId,
        label: edgeLabel || undefined,
        kind: edgeKind,
      };
    } else {
      // Try parsing as standalone node
      const standaloneNodeId = parseStandaloneNode(line, nodeMap, subgraphMap);
      if (standaloneNodeId && !nodeMap[standaloneNodeId]) {
        nodeMap[standaloneNodeId] = createNode(
          standaloneNodeId,
          currentSubgraph,
          nodeDefinitions
        );
        if (currentSubgraph && subgraphMap[currentSubgraph]) {
          subgraphMap[currentSubgraph].children.push(standaloneNodeId);
        }
      }
    }
  }

  return {
    meta: { direction, diagramType: "flowchart" },
    nodes: nodeMap,
    edges: edgeMap,
    subgraphs: subgraphMap,
  };
}

// ============================================================================
// C4Context Parser
// ============================================================================

/**
 * Parse C4Context diagram.
 */
function parseC4Context(mermaidCode: string): Graph {
  const nodeMap: Record<NodeId, C4Node> = {};
  const edgeMap: Record<EdgeId, C4Edge> = {};
  const boundaryMap: Record<SubgraphId, C4Boundary> = {};

  // Default direction for C4 is TB
  const direction: GraphMeta["direction"] = "TB";
  let title: string | undefined;

  // Clean up code: remove comments and normalize
  const lines = mermaidCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"));

  const boundaryStack: SubgraphId[] = [];
  let edgeIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip C4Context declaration
    if (line.toLowerCase().startsWith("c4context")) {
      continue;
    }

    // Parse title
    if (line.toLowerCase().startsWith("title ")) {
      title = line.slice(6).trim();
      continue;
    }

    // Parse boundary closing
    if (line === "}") {
      if (boundaryStack.length > 0) {
        boundaryStack.pop();
      }
      continue;
    }

    // Parse boundaries (Enterprise_Boundary, System_Boundary, Container_Boundary, Boundary)
    const boundaryMatch = parseBoundaryLine(line);
    if (boundaryMatch) {
      const parentId = boundaryStack.length > 0 ? boundaryStack[boundaryStack.length - 1] : undefined;

      const boundary: C4Boundary = {
        id: boundaryMatch.id,
        label: boundaryMatch.label,
        boundaryType: boundaryMatch.boundaryType,
        parent: parentId,
        children: [],
        tags: boundaryMatch.tags,
      };

      boundaryMap[boundaryMatch.id] = boundary;
      boundaryStack.push(boundaryMatch.id);
      continue;
    }

    // Parse C4 elements (Person, System, Container, Component)
    const elementMatch = parseC4ElementLine(line);
    if (elementMatch) {
      const parentId = boundaryStack.length > 0 ? boundaryStack[boundaryStack.length - 1] : undefined;

      const node: C4Node = {
        id: elementMatch.id,
        label: elementMatch.label,
        kind: "rect", // C4 elements use rect as base
        c4Type: elementMatch.c4Type,
        description: elementMatch.description,
        technology: elementMatch.technology,
        sprite: elementMatch.sprite,
        tags: elementMatch.tags,
        parent: parentId,
      };

      nodeMap[elementMatch.id] = node;

      // Add to parent boundary's children
      if (parentId && boundaryMap[parentId]) {
        boundaryMap[parentId].children.push(elementMatch.id);
      }
      continue;
    }

    // Parse relationships (Rel, BiRel, Rel_U, Rel_D, Rel_L, Rel_R)
    const relMatch = parseC4RelLine(line);
    if (relMatch) {
      const edgeId: EdgeId = `e-${relMatch.from}-${relMatch.to}-${edgeIndex++}`;

      const edge: C4Edge = {
        id: edgeId,
        from: relMatch.from,
        to: relMatch.to,
        label: relMatch.label,
        kind: relMatch.bidirectional ? "bidirectional" : "directed",
        technology: relMatch.technology,
        description: relMatch.description,
        tags: relMatch.tags,
      };

      edgeMap[edgeId] = edge;
      continue;
    }
  }

  return {
    meta: { direction, title, diagramType: "c4context" },
    nodes: nodeMap,
    edges: edgeMap,
    subgraphs: boundaryMap,
  };
}

// --- C4 Parsing Helpers ---

interface BoundaryParseResult {
  id: string;
  label: string;
  boundaryType: C4BoundaryType;
  tags?: string[];
}

function parseBoundaryLine(line: string): BoundaryParseResult | null {
  // Enterprise_Boundary(alias, "label") {
  // System_Boundary(alias, "label") {
  // Container_Boundary(alias, "label") {
  // Boundary(alias, "label", "type") {

  const patterns: Array<{ regex: RegExp; type: C4BoundaryType }> = [
    { regex: /^Enterprise_Boundary\s*\(\s*([^,]+)\s*,\s*"([^"]*)"\s*\)\s*\{?$/i, type: "enterprise" },
    { regex: /^System_Boundary\s*\(\s*([^,]+)\s*,\s*"([^"]*)"\s*\)\s*\{?$/i, type: "system" },
    { regex: /^Container_Boundary\s*\(\s*([^,]+)\s*,\s*"([^"]*)"\s*\)\s*\{?$/i, type: "container" },
    { regex: /^Boundary\s*\(\s*([^,]+)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)\s*\{?$/i, type: "boundary" },
  ];

  for (const { regex, type } of patterns) {
    const match = line.match(regex);
    if (match) {
      return {
        id: match[1].trim(),
        label: match[2],
        boundaryType: type,
      };
    }
  }

  return null;
}

interface C4ElementParseResult {
  id: string;
  label: string;
  c4Type: C4ElementType;
  description?: string;
  technology?: string;
  sprite?: string;
  tags?: string[];
}

function parseC4ElementLine(line: string): C4ElementParseResult | null {
  // Person(alias, "label", "description")
  // Person_Ext(alias, "label", "description")
  // System(alias, "label", "description")
  // System_Ext(alias, "label", "description")
  // SystemDb(alias, "label", "description")
  // SystemQueue(alias, "label", "description")
  // Container(alias, "label", "technology", "description")
  // Container_Ext(alias, "label", "technology", "description")
  // ContainerDb(alias, "label", "technology", "description")
  // ContainerQueue(alias, "label", "technology", "description")
  // Component(alias, "label", "technology", "description")
  // Component_Ext(alias, "label", "technology", "description")
  // ComponentDb(alias, "label", "technology", "description")
  // ComponentQueue(alias, "label", "technology", "description")

  // Map of element names to their C4ElementType
  const elementTypeMap: Record<string, C4ElementType> = {
    "person": "person",
    "person_ext": "person_ext",
    "system": "system",
    "system_ext": "system_ext",
    "systemdb": "system_db",
    "systemqueue": "system_queue",
    "container": "container",
    "container_ext": "container_ext",
    "containerdb": "container_db",
    "containerqueue": "container_queue",
    "component": "component",
    "component_ext": "component_ext",
    "componentdb": "component_db",
    "componentqueue": "component_queue",
  };

  // Elements without technology: Person, Person_Ext, System, System_Ext, SystemDb, SystemQueue
  const noTechPattern = /^(Person|Person_Ext|System|System_Ext|SystemDb|SystemQueue)\s*\(\s*([^,]+)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)$/i;

  // Elements with technology: Container*, Component*
  const withTechPattern = /^(Container|Container_Ext|ContainerDb|ContainerQueue|Component|Component_Ext|ComponentDb|ComponentQueue)\s*\(\s*([^,]+)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?(?:\s*,\s*"([^"]*)")?\s*\)$/i;

  let match = line.match(noTechPattern);
  if (match) {
    const typeName = match[1].toLowerCase().replace("_", "_");
    const c4Type = elementTypeMap[typeName];
    if (c4Type) {
      return {
        id: match[2].trim(),
        label: match[3],
        c4Type,
        description: match[4] || undefined,
      };
    }
  }

  match = line.match(withTechPattern);
  if (match) {
    const typeName = match[1].toLowerCase().replace("_", "_");
    const c4Type = elementTypeMap[typeName];
    if (c4Type) {
      return {
        id: match[2].trim(),
        label: match[3],
        c4Type,
        technology: match[4] || undefined,
        description: match[5] || undefined,
      };
    }
  }

  return null;
}

interface C4RelParseResult {
  from: string;
  to: string;
  label?: string;
  technology?: string;
  description?: string;
  bidirectional: boolean;
  tags?: string[];
}

function parseC4RelLine(line: string): C4RelParseResult | null {
  // Rel(from, to, "label", "technology", "description")
  // BiRel(from, to, "label", "technology", "description")
  // Rel_U(from, to, "label", "technology", "description")
  // Rel_D(from, to, "label", "technology", "description")
  // Rel_L(from, to, "label", "technology", "description")
  // Rel_R(from, to, "label", "technology", "description")
  // Rel_Up, Rel_Down, Rel_Left, Rel_Right (aliases)
  // Rel_Back, Rel_Neighbor (other variants)

  const relPattern = /^(Rel|BiRel|Rel_U|Rel_D|Rel_L|Rel_R|Rel_Up|Rel_Down|Rel_Left|Rel_Right|Rel_Back|Rel_Neighbor)\s*\(\s*([^,]+)\s*,\s*([^,]+)(?:\s*,\s*"([^"]*)")?(?:\s*,\s*"([^"]*)")?(?:\s*,\s*"([^"]*)")?\s*\)$/i;

  const match = line.match(relPattern);
  if (match) {
    const relType = match[1].toLowerCase();
    const bidirectional = relType === "birel";

    return {
      from: match[2].trim(),
      to: match[3].trim(),
      label: match[4] || undefined,
      technology: match[5] || undefined,
      description: match[6] || undefined,
      bidirectional,
    };
  }

  return null;
}

// --- Flowchart Helper functions ---

function preprocessMultilineDefinitions(code: string): string {
  const rawLines = code.split("\n");
  const preprocessedLines: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i].trim();
    const openBrackets = (line.match(/[\[\(\{]/g) || []).length;
    const closeBrackets = (line.match(/[\]\)\}]/g) || []).length;

    if (openBrackets > closeBrackets && i < rawLines.length - 1) {
      let combinedLine = line;
      let j = i + 1;
      let currentOpen = openBrackets;
      let currentClose = closeBrackets;

      while (j < rawLines.length && currentOpen > currentClose) {
        const nextLine = rawLines[j].trim();
        combinedLine += " " + nextLine;
        currentOpen += (nextLine.match(/[\[\(\{]/g) || []).length;
        currentClose += (nextLine.match(/[\]\)\}]/g) || []).length;
        j++;
      }

      preprocessedLines.push(combinedLine);
      i = j;
    } else {
      preprocessedLines.push(line);
      i++;
    }
  }

  return preprocessedLines.join("\n");
}

function getNodeKind(nodeDefinition: string): NodeKind {
  if (nodeDefinition.includes("{") && nodeDefinition.includes("}"))
    return "diamond";
  if (nodeDefinition.includes("((") && nodeDefinition.includes("))"))
    return "circle";
  if (nodeDefinition.includes("([") && nodeDefinition.includes("])"))
    return "stadium";
  if (nodeDefinition.includes("[") && nodeDefinition.includes("]"))
    return "rect";
  if (nodeDefinition.includes("(") && nodeDefinition.includes(")"))
    return "round";
  return "rect";
}

function cleanLabel(label: string): string {
  return label
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, code) => {
      try {
        return String.fromCharCode(parseInt(code, 16));
      } catch {
        return _match;
      }
    })
    .replace(/\\n/g, "\n")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function scanNodeDefinitions(
  line: string,
  definitions: Map<string, { label: string; kind: NodeKind; fullDef: string }>
): void {
  const nodeDefPattern = /(^|[\s\-\>]|\|[^|]*\|)([A-Za-z0-9_]+)([\[\(\{])/g;
  let match;
  const processedMatches = new Set<number>();

  while ((match = nodeDefPattern.exec(line)) !== null) {
    const prefix = match[1];
    const nodeId = match[2];
    const openChar = match[3];
    const matchStart = match.index + prefix.length;

    if (processedMatches.has(matchStart) || definitions.has(nodeId)) continue;
    processedMatches.add(matchStart);

    const openIndex = matchStart + nodeId.length;
    const closeChar = openChar === "[" ? "]" : openChar === "(" ? ")" : "}";

    let closeIndex = -1;
    let depth = 0;
    for (let i = openIndex; i < line.length; i++) {
      const char = line[i];
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }

    let fullDef = nodeId;
    let shapeDef = "";
    if (closeIndex !== -1) {
      fullDef = line.slice(matchStart, closeIndex + 1);
      shapeDef = line.slice(openIndex, closeIndex + 1);
    } else {
      const remainingLine = line.slice(matchStart);
      const fallback = remainingLine.match(
        /([A-Za-z0-9_]+)([\[\(\{][^\]\)\}]*[\]\)\}])/
      );
      if (fallback && fallback[1] === nodeId) {
        fullDef = fallback[0];
        shapeDef = fallback[2];
      }
    }

    if (shapeDef) {
      const kind = getNodeKind(fullDef);
      let rawLabel = nodeId;
      const labelContentMatch = shapeDef.match(/^[\[\(\{](.*)[\]\)\}]$/s);
      if (labelContentMatch) {
        rawLabel = labelContentMatch[1];
        rawLabel = rawLabel.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      }
      const label = cleanLabel(rawLabel);
      definitions.set(nodeId, { label, kind, fullDef });
    }
  }
}

function parseSubgraphLine(
  line: string,
  lineIndex: number,
  _stack: SubgraphId[]
): { id: SubgraphId; label: string } | null {
  const rest = line.slice("subgraph".length).trim();

  let subgraphId: string | undefined;
  let subgraphLabel: string | undefined;

  // Check for quoted title first
  const quoteMatch = rest.match(/^(["'])(.*?)\1/);
  if (quoteMatch) {
    subgraphLabel = quoteMatch[2];
    subgraphId =
      subgraphLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `sg-${lineIndex}`;
  } else {
    // Try to extract id and optional bracketed title
    const bracketMatch = rest.match(/^([^\s\[]+)(?:\s*\[(.+?)\])?/);
    if (bracketMatch) {
      subgraphId = bracketMatch[1];
      if (bracketMatch[2]) subgraphLabel = bracketMatch[2];
    }

    // If no bracketed title and rest contains spaces, treat whole as title
    if (!subgraphLabel && rest.indexOf(" ") !== -1) {
      subgraphLabel = rest;
      subgraphId =
        subgraphLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `sg-${lineIndex}`;
    }

    // Check for quoted title after id
    if (!subgraphLabel) {
      const altQuote = rest.match(/^[^\s]+\s+(["'])(.*?)\1/);
      if (altQuote) subgraphLabel = altQuote[2];
    }
  }

  if (subgraphId) {
    const cleanedLabel = subgraphLabel ? cleanLabel(subgraphLabel) : subgraphId;
    return { id: subgraphId, label: cleanedLabel };
  }

  return null;
}

function parseEdgeLine(line: string): {
  sourceId: string;
  targetId: string;
  edgeType: string;
  edgeLabel: string;
} | null {
  try {
    let i = 0;

    // Extract source token
    const src = extractToken(line, i);
    if (!src) return null;
    i = src.endIndex;

    // Skip whitespace
    while (i < line.length && /\s/.test(line[i])) i++;

    // Find arrow operator
    const arrowHeads = ["-.->" , "-->", "==>", "->>", "<->", "-<>", "<-", "->"];
    let foundArrowIndex = -1;
    let foundArrow = "";
    for (const ah of arrowHeads) {
      const idx = line.indexOf(ah, i);
      if (idx !== -1 && (foundArrowIndex === -1 || idx < foundArrowIndex)) {
        foundArrowIndex = idx;
        foundArrow = ah;
      }
    }

    let op: string | null = null;
    let edgeLabel = "";

    if (foundArrowIndex !== -1) {
      const between = line.slice(i, foundArrowIndex);

      // Check for pipe label before arrow
      const prePipeMatch = between.match(/\|(.*?)\|/);
      if (prePipeMatch) {
        edgeLabel = prePipeMatch[1];
      } else {
        // Extract inline label
        const inline = between
          .replace(/^\s*[\-\.=:\~]+\s*/g, "")
          .replace(/\s*[\-\.=:\~]+\s*$/g, "")
          .trim();
        if (inline) edgeLabel = inline;
      }

      op = foundArrow;
      i = foundArrowIndex + foundArrow.length;

      // Check for pipe label after arrow
      while (i < line.length && /\s/.test(line[i])) i++;
      if (line[i] === "|") {
        const next = line.indexOf("|", i + 1);
        if (next !== -1) {
          edgeLabel = line.slice(i + 1, next);
          i = next + 1;
        }
      }
    } else {
      // Legacy operators
      const operators = ["---", "-.-", "::", ":-:", "...", "~", "==="];
      for (const o of operators.sort((a, b) => b.length - a.length)) {
        if (line.startsWith(o, i)) {
          op = o;
          i += o.length;
          break;
        }
      }
      if (!op) return null;

      // Check for pipe label
      while (i < line.length && /\s/.test(line[i])) i++;
      if (line[i] === "|") {
        const next = line.indexOf("|", i + 1);
        if (next !== -1) {
          edgeLabel = line.slice(i + 1, next);
          i = next + 1;
        }
      }
    }

    // Skip whitespace and parse target
    while (i < line.length && /\s/.test(line[i])) i++;
    const tgt = extractToken(line, i);
    if (!tgt) return null;

    return {
      sourceId: src.id,
      targetId: tgt.id,
      edgeType: op!,
      edgeLabel: cleanLabel(edgeLabel),
    };
  } catch {
    return null;
  }
}

function extractToken(
  str: string,
  startIndex: number
): { id: string; full: string; endIndex: number } | null {
  const idMatch = str.slice(startIndex).match(/^\s*([A-Za-z0-9_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  let idx = startIndex + idMatch[0].length;

  const rest = str.slice(idx);
  const openCharMatch = rest.match(/^[\s]*([\[\(\{])/);
  if (openCharMatch) {
    const openChar = openCharMatch[1];
    const openPos = idx + rest.indexOf(openChar);
    const closeChar = openChar === "[" ? "]" : openChar === "(" ? ")" : "}";
    const closePos = str.indexOf(closeChar, openPos + 1);
    if (closePos !== -1) {
      const full = str
        .slice(startIndex + idMatch[0].search(/\S/), closePos + 1)
        .trim();
      return { id, full, endIndex: closePos + 1 };
    }
  }

  return { id, full: id, endIndex: idx };
}

function parseStandaloneNode(
  line: string,
  existingNodes: Record<NodeId, Node>,
  subgraphMap: Record<SubgraphId, Subgraph>
): string | null {
  const nodePatterns = [
    /^([A-Za-z0-9_]+)([\[\(\{][^\]\)\}]*[\]\)\}])/,
    /^([A-Za-z0-9_]+)$/,
  ];

  for (const pattern of nodePatterns) {
    const match = line.match(pattern);
    if (match && !existingNodes[match[1]] && !subgraphMap[match[1]]) {
      return match[1];
    }
  }

  return null;
}

function createNode(
  nodeId: NodeId,
  parentSubgraph: SubgraphId | undefined,
  definitions: Map<string, { label: string; kind: NodeKind; fullDef: string }>
): Node {
  const def = definitions.get(nodeId);

  return {
    id: nodeId,
    label: def?.label ?? nodeId,
    kind: def?.kind ?? "rect",
    parent: parentSubgraph,
  };
}
