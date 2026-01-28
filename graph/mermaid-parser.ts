/**
 * Mermaid Parser - Converts Mermaid code to GraphModel
 *
 * TASK-01: Mermaid to GraphModel parser
 * - IDs must NOT depend on node position
 * - IDs must survive layout changes
 * - Subgraphs must be preserved
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
} from "./graph.model";

/**
 * Parse Mermaid code and produce a semantic GraphModel.
 * No visual/layout information is included.
 */
export function parseMermaidToGraph(mermaidCode: string): Graph {
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
    meta: { direction },
    nodes: nodeMap,
    edges: edgeMap,
    subgraphs: subgraphMap,
  };
}

// --- Helper functions ---

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
