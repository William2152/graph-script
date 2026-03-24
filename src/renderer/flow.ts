import { Expression, FlowDeclaration } from '../ast/types';
import { escapeXml, looksLikeFormula, normalizeFormulaText, renderFormulaText, round, wrapText } from './common';

type FlowDirection = 'top_down' | 'left_right';
type LayoutMode = 'auto' | 'single_row' | 'snake' | 'vertical';
type FitMode = 'readable' | 'compact';

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  direction: FlowDirection;
  options: ResolvedFlowOptions;
}

export interface LayoutNode {
  id: string;
  label: string;
  nodeType?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textMode: 'plain' | 'formula';
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
}

interface NodeBox {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textMode: 'plain' | 'formula';
  label: string;
  nodeType?: string;
}

interface ResolvedFlowOptions {
  targetWidth: number;
  targetHeight: number;
  minFontSize: number;
  preferredFontSize: number;
  layoutMode: LayoutMode;
  fit: FitMode;
  direction: FlowDirection;
}

interface LayoutCandidate {
  mode: Exclude<LayoutMode, 'auto'>;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  fontSize: number;
  overflowX: number;
  overflowY: number;
  score: number;
}

const FLOW_PADDING = 52;
const DEFAULT_TARGET_WIDTH = 1400;
const DEFAULT_TARGET_HEIGHT = 860;

export function layoutFlow(flow: FlowDeclaration): FlowLayout {
  const options = resolveFlowOptions(flow);
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const orderedNodeIds = topologicalOrder(nodes, edges);

  if (!orderedNodeIds.length) {
    return {
      nodes: [],
      edges: [],
      width: DEFAULT_TARGET_WIDTH,
      height: 240,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      direction: options.direction,
      options,
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const candidates = candidateModes(options, orderedNodeIds.length).map((mode) =>
    buildCandidate(mode, orderedNodeIds, nodeById, edges, options),
  );

  const chosen = chooseCandidate(candidates);
  return {
    nodes: chosen.nodes,
    edges: chosen.edges,
    width: chosen.width,
    height: chosen.height,
    minX: chosen.minX,
    minY: chosen.minY,
    maxX: chosen.maxX,
    maxY: chosen.maxY,
    direction: options.direction,
    options,
  };
}

export function renderFlow(layout: FlowLayout, title?: string): string {
  const titleBlock = title ? 72 : 24;
  const contentWidth = Math.max(0, layout.maxX - layout.minX);
  const contentHeight = Math.max(0, layout.maxY - layout.minY);
  const targetWidth = Math.max(layout.options.targetWidth, contentWidth + 120);
  const targetHeight = Math.max(layout.options.targetHeight, contentHeight + titleBlock + 90);
  const svgWidth = Math.max(560, targetWidth);
  const svgHeight = Math.max(360, targetHeight);
  const horizontalPadding = Math.max(50, (svgWidth - contentWidth) / 2);
  const offsetX = horizontalPadding - layout.minX;
  const verticalSlack = Math.max(24, svgHeight - (contentHeight + titleBlock + 34));
  const offsetY = titleBlock + verticalSlack / 2 - layout.minY;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${round(svgWidth)}" height="${round(svgHeight)}" viewBox="0 0 ${round(svgWidth)} ${round(svgHeight)}">`;
  svg += `<rect width="${round(svgWidth)}" height="${round(svgHeight)}" fill="#ffffff"/>`;
  if (title) {
    svg += `<text x="${round(svgWidth / 2)}" y="36" text-anchor="middle" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>`;
  }

  svg += `<defs>`;
  svg += `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`;
  svg += `<path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>`;
  svg += `</defs>`;
  svg += `<g transform="translate(${round(offsetX)}, ${round(offsetY)})">`;

  layout.edges.forEach((edge) => {
    if (edge.points.length < 2) return;
    const polyline = edge.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
    svg += `<polyline points="${polyline}" fill="none" stroke="#475569" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" marker-end="url(#arrow)"/>`;
    if (edge.label) {
      const mid = edge.points[Math.floor(edge.points.length / 2)];
      const chipWidth = Math.max(56, edge.label.length * 8 + 24);
      svg += `<rect x="${round(mid.x - chipWidth / 2)}" y="${round(mid.y - 22)}" width="${round(chipWidth)}" height="24" rx="12" fill="#ffffff" stroke="#cbd5e1"/>`;
      svg += `<text x="${round(mid.x)}" y="${round(mid.y - 7)}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${escapeXml(edge.label)}</text>`;
    }
  });

  layout.nodes.forEach((node) => {
    svg += renderNode(node);
  });

  svg += `</g></svg>`;
  return svg;
}

function renderNode(node: LayoutNode): string {
  const type = (node.nodeType ?? 'process').toLowerCase();
  const theme = nodeTheme(type);
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const textBlockHeight = node.lines.length * node.lineHeight;
  const textStart = node.y - textBlockHeight / 2 + node.fontSize * 0.82;

  let svg = `<g>`;
  switch (type) {
    case 'start':
    case 'end':
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" rx="${round(node.height / 2)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    case 'decision': {
      const top = `${round(node.x)},${round(y)}`;
      const right = `${round(node.x + node.width / 2)},${round(node.y)}`;
      const bottom = `${round(node.x)},${round(node.y + node.height / 2)}`;
      const left = `${round(node.x - node.width / 2)},${round(node.y)}`;
      svg += `<polygon points="${top} ${right} ${bottom} ${left}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    }
    case 'data': {
      const skew = 18;
      svg += `<polygon points="${round(x + skew)},${round(y)} ${round(x + node.width)},${round(y)} ${round(x + node.width - skew)},${round(y + node.height)} ${round(x)},${round(y + node.height)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    }
    default:
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" rx="16" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
  }

  node.lines.forEach((line, index) => {
    const lineY = textStart + index * node.lineHeight;
    if (node.textMode === 'formula') {
      svg += renderFormulaText(line, node.x, lineY, {
        fontSize: node.fontSize,
        color: theme.text,
        anchor: 'middle',
        weight: '700',
      });
    } else {
      svg += `<text x="${round(node.x)}" y="${round(lineY)}" text-anchor="middle" font-size="${round(node.fontSize)}" font-weight="700" fill="${theme.text}">${escapeXml(line)}</text>`;
    }
  });
  svg += `</g>`;
  return svg;
}

function resolveFlowOptions(flow: FlowDeclaration): ResolvedFlowOptions {
  const direction = resolveDirection(flow);
  const preferredFontSize = Math.max(16, readFlowNumber(flow.properties.preferred_font_size, 17));
  const minFontSize = Math.min(preferredFontSize, Math.max(12, readFlowNumber(flow.properties.min_font_size, 14)));
  const layoutMode = readFlowString(flow.properties.layout_mode, 'auto');
  const fit = readFlowString(flow.properties.fit, 'readable') === 'compact' ? 'compact' : 'readable';

  return {
    targetWidth: Math.max(900, readFlowNumber(flow.properties.target_width, DEFAULT_TARGET_WIDTH)),
    targetHeight: Math.max(420, readFlowNumber(flow.properties.target_height, DEFAULT_TARGET_HEIGHT)),
    minFontSize,
    preferredFontSize,
    layoutMode: normalizeLayoutMode(layoutMode),
    fit,
    direction,
  };
}

function candidateModes(options: ResolvedFlowOptions, nodeCount: number): Exclude<LayoutMode, 'auto'>[] {
  if (options.layoutMode !== 'auto') return [options.layoutMode];

  if (options.direction === 'top_down') return ['vertical', 'snake', 'single_row'];
  if (nodeCount >= 5 && nodeCount <= 8) return ['snake', 'single_row', 'vertical'];
  if (nodeCount <= 4) return ['single_row', 'snake', 'vertical'];
  return ['snake', 'vertical', 'single_row'];
}

function buildCandidate(
  mode: Exclude<LayoutMode, 'auto'>,
  orderedNodeIds: string[],
  nodeById: Map<string, FlowDeclaration['nodes'][number]>,
  edges: FlowDeclaration['edges'],
  options: ResolvedFlowOptions,
): LayoutCandidate {
  let fontSize = options.preferredFontSize;
  let measured = measureNodes(orderedNodeIds, nodeById, fontSize, options.fit);
  let nodes = placeNodes(mode, orderedNodeIds, measured, options.fit);
  let bounds = boundsFromNodes(nodes);

  const fitsPreferred = bounds.maxX - bounds.minX <= options.targetWidth - 120
    && bounds.maxY - bounds.minY <= options.targetHeight - 150;

  if (!fitsPreferred) {
    const scaleX = (options.targetWidth - 120) / Math.max(bounds.maxX - bounds.minX, 1);
    const scaleY = (options.targetHeight - 150) / Math.max(bounds.maxY - bounds.minY, 1);
    const scaledFont = Math.floor(options.preferredFontSize * Math.min(scaleX, scaleY, 1));
    fontSize = Math.max(options.minFontSize, scaledFont || options.minFontSize);
    measured = measureNodes(orderedNodeIds, nodeById, fontSize, options.fit);
    nodes = placeNodes(mode, orderedNodeIds, measured, options.fit);
    bounds = boundsFromNodes(nodes);
  }

  const edgesLayout = buildEdges(edges, nodes);
  const fullBounds = boundsFromNodesAndEdges(nodes, edgesLayout);
  const contentWidth = fullBounds.maxX - fullBounds.minX;
  const contentHeight = fullBounds.maxY - fullBounds.minY;
  const overflowX = Math.max(0, contentWidth - (options.targetWidth - 120));
  const overflowY = Math.max(0, contentHeight - (options.targetHeight - 150));
  const modePenalty = mode === 'snake' ? 0 : mode === 'single_row' ? 24 : 36;
  const compactPenalty = options.preferredFontSize - fontSize;
  const score = overflowX * 5 + overflowY * 4 + compactPenalty * 40 + modePenalty;

  return {
    mode,
    nodes,
    edges: edgesLayout,
    minX: fullBounds.minX - FLOW_PADDING,
    minY: fullBounds.minY - FLOW_PADDING,
    maxX: fullBounds.maxX + FLOW_PADDING,
    maxY: fullBounds.maxY + FLOW_PADDING,
    width: contentWidth + FLOW_PADDING * 2,
    height: contentHeight + FLOW_PADDING * 2,
    fontSize,
    overflowX,
    overflowY,
    score,
  };
}

function chooseCandidate(candidates: LayoutCandidate[]): LayoutCandidate {
  return [...candidates].sort((a, b) => a.score - b.score)[0];
}

function measureNodes(
  orderedNodeIds: string[],
  nodeById: Map<string, FlowDeclaration['nodes'][number]>,
  fontSize: number,
  fit: FitMode,
): Map<string, NodeBox> {
  const measured = new Map<string, NodeBox>();
  orderedNodeIds.forEach((id) => {
    const node = nodeById.get(id);
    if (!node) return;
    measured.set(id, measureNode(node.label || node.id, node.nodeType, fontSize, fit));
  });
  return measured;
}

function placeNodes(
  mode: Exclude<LayoutMode, 'auto'>,
  orderedNodeIds: string[],
  measured: Map<string, NodeBox>,
  fit: FitMode,
): LayoutNode[] {
  switch (mode) {
    case 'single_row':
      return placeSingleRow(orderedNodeIds, measured, fit);
    case 'snake':
      return placeSnake(orderedNodeIds, measured, fit);
    case 'vertical':
      return placeVertical(orderedNodeIds, measured, fit);
  }
}

function placeSingleRow(orderedNodeIds: string[], measured: Map<string, NodeBox>, fit: FitMode): LayoutNode[] {
  const horizontalGap = fit === 'compact' ? 54 : 76;
  const nodes = orderedNodeIds.map((id) => createNode(id, measured.get(id)));
  const totalWidth = nodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, nodes.length - 1) * horizontalGap;
  let cursor = -totalWidth / 2;
  return nodes.map((node) => {
    const positioned = { ...node, x: cursor + node.width / 2, y: 0 };
    cursor += node.width + horizontalGap;
    return positioned;
  });
}

function placeVertical(orderedNodeIds: string[], measured: Map<string, NodeBox>, fit: FitMode): LayoutNode[] {
  const verticalGap = fit === 'compact' ? 60 : 84;
  const nodes = orderedNodeIds.map((id) => createNode(id, measured.get(id)));
  const totalHeight = nodes.reduce((sum, node) => sum + node.height, 0) + Math.max(0, nodes.length - 1) * verticalGap;
  let cursor = -totalHeight / 2;
  return nodes.map((node) => {
    const positioned = { ...node, x: 0, y: cursor + node.height / 2 };
    cursor += node.height + verticalGap;
    return positioned;
  });
}

function placeSnake(orderedNodeIds: string[], measured: Map<string, NodeBox>, fit: FitMode): LayoutNode[] {
  const horizontalGap = fit === 'compact' ? 52 : 72;
  const verticalGap = fit === 'compact' ? 110 : 136;
  const splitIndex = Math.ceil(orderedNodeIds.length / 2);
  const topIds = orderedNodeIds.slice(0, splitIndex);
  const bottomIds = orderedNodeIds.slice(splitIndex).reverse();

  const topNodes = topIds.map((id) => createNode(id, measured.get(id)));
  const bottomNodes = bottomIds.map((id) => createNode(id, measured.get(id)));

  const topWidth = rowWidth(topNodes, horizontalGap);
  const bottomWidth = rowWidth(bottomNodes, horizontalGap);
  const rowSpan = Math.max(topWidth, bottomWidth);

  let topCursor = -rowSpan / 2 + (rowSpan - topWidth) / 2;
  const placedTop = topNodes.map((node) => {
    const positioned = { ...node, x: topCursor + node.width / 2, y: -verticalGap / 2 };
    topCursor += node.width + horizontalGap;
    return positioned;
  });

  let bottomCursor = -rowSpan / 2 + (rowSpan - bottomWidth) / 2;
  const placedBottom = bottomNodes.map((node) => {
    const positioned = { ...node, x: bottomCursor + node.width / 2, y: verticalGap / 2 };
    bottomCursor += node.width + horizontalGap;
    return positioned;
  });

  return [...placedTop, ...placedBottom];
}

function buildEdges(edges: FlowDeclaration['edges'], nodes: LayoutNode[]): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return { from: edge.from, to: edge.to, label: edge.label, points: [] };
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      points: routeEdge(fromNode, toNode),
    };
  });
}

function routeEdge(fromNode: LayoutNode, toNode: LayoutNode): { x: number; y: number }[] {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const startX = fromNode.x + Math.sign(dx || 1) * fromNode.width / 2;
    const startY = fromNode.y;
    const endX = toNode.x - Math.sign(dx || 1) * toNode.width / 2;
    const endY = toNode.y;
    const midX = (startX + endX) / 2;
    return [
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: endY },
      { x: endX, y: endY },
    ];
  }

  const startX = fromNode.x;
  const startY = fromNode.y + Math.sign(dy || 1) * fromNode.height / 2;
  const endX = toNode.x;
  const endY = toNode.y - Math.sign(dy || 1) * toNode.height / 2;
  const midY = (startY + endY) / 2;
  return [
    { x: startX, y: startY },
    { x: startX, y: midY },
    { x: endX, y: midY },
    { x: endX, y: endY },
  ];
}

function boundsFromNodes(nodes: LayoutNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = nodes.flatMap((node) => [node.x - node.width / 2, node.x + node.width / 2]);
  const ys = nodes.flatMap((node) => [node.y - node.height / 2, node.y + node.height / 2]);
  return {
    minX: Math.min(...xs, 0),
    minY: Math.min(...ys, 0),
    maxX: Math.max(...xs, 0),
    maxY: Math.max(...ys, 0),
  };
}

function boundsFromNodesAndEdges(nodes: LayoutNode[], edges: LayoutEdge[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const nodeBounds = boundsFromNodes(nodes);
  const edgeXs = edges.flatMap((edge) => edge.points.map((point) => point.x));
  const edgeYs = edges.flatMap((edge) => edge.points.map((point) => point.y));
  return {
    minX: Math.min(nodeBounds.minX, ...edgeXs, 0),
    minY: Math.min(nodeBounds.minY, ...edgeYs, 0),
    maxX: Math.max(nodeBounds.maxX, ...edgeXs, 0),
    maxY: Math.max(nodeBounds.maxY, ...edgeYs, 0),
  };
}

function createNode(id: string, box?: NodeBox): LayoutNode {
  const measured = box ?? measureNode(id, undefined, 17, 'readable');
  return {
    id,
    label: measured.label,
    nodeType: measured.nodeType,
    width: measured.width,
    height: measured.height,
    lines: measured.lines,
    x: 0,
    y: 0,
    fontSize: measured.fontSize,
    lineHeight: measured.lineHeight,
    textMode: measured.textMode,
  };
}

function rowWidth(nodes: LayoutNode[], gap: number): number {
  return nodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, nodes.length - 1) * gap;
}

function topologicalOrder(nodes: FlowDeclaration['nodes'], edges: FlowDeclaration['edges']): string[] {
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    indegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  });

  let frontier = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  if (!frontier.length) frontier = nodes.map((node) => node.id);
  const ordered: string[] = [];
  const assigned = new Set<string>();

  while (frontier.length) {
    const current = frontier.shift()!;
    if (assigned.has(current)) continue;
    ordered.push(current);
    assigned.add(current);
    (adjacency.get(current) ?? []).forEach((neighbor) => {
      indegree.set(neighbor, (indegree.get(neighbor) ?? 1) - 1);
      if ((indegree.get(neighbor) ?? 0) <= 0) frontier.push(neighbor);
    });
    if (!frontier.length && assigned.size < nodes.length) {
      const fallback = nodes.find((node) => !assigned.has(node.id));
      if (fallback) frontier.push(fallback.id);
    }
  }

  return ordered;
}

function resolveDirection(flow: FlowDeclaration): FlowDirection {
  const directionExpr = flow.properties.direction;
  if (directionExpr?.type === 'Identifier' && directionExpr.name === 'left_right') return 'left_right';
  if (directionExpr?.type === 'Literal' && directionExpr.value === 'left_right') return 'left_right';
  return 'top_down';
}

function measureNode(label: string, type: string | undefined, fontSize: number, fit: FitMode): NodeBox {
  const kind = (type ?? 'process').toLowerCase();
  const textMode: 'plain' | 'formula' = looksLikeFormula(label) ? 'formula' : 'plain';
  const normalized = textMode === 'formula' ? normalizeFormulaText(label) : label;
  const lineHeight = Math.round(fontSize * 1.28);
  const maxChars = fit === 'compact'
    ? (kind === 'decision' ? 16 : 20)
    : (kind === 'decision' ? 18 : 24);
  const lines = textMode === 'formula' ? [normalized] : wrapText(normalized, maxChars, 5);
  const longest = Math.max(...lines.map((line) => line.length), 8);
  const charWidth = textMode === 'formula' ? fontSize * 0.7 : fontSize * 0.64;
  const textWidth = longest * charWidth;
  const textHeight = lines.length * lineHeight;
  const widthPadding = textMode === 'formula' ? 74 : 58;

  switch (kind) {
    case 'decision':
      return {
        width: Math.max(230, textWidth + 86),
        height: Math.max(128, textHeight + 64),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    case 'start':
    case 'end':
      return {
        width: Math.max(180, textWidth + 70),
        height: Math.max(72, textHeight + 38),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    case 'data':
      return {
        width: Math.max(220, textWidth + 62),
        height: Math.max(88, textHeight + 42),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    default:
      return {
        width: Math.max(250, textWidth + widthPadding),
        height: Math.max(98, textHeight + 42),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
  }
}

function nodeTheme(type: string): { fill: string; stroke: string; text: string } {
  switch (type) {
    case 'start':
      return { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' };
    case 'end':
      return { fill: '#fee2e2', stroke: '#dc2626', text: '#991b1b' };
    case 'decision':
      return { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' };
    case 'data':
      return { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' };
    default:
      return { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' };
  }
}

function normalizeLayoutMode(value: string): LayoutMode {
  if (value === 'single_row' || value === 'snake' || value === 'vertical') return value;
  return 'auto';
}

function readFlowString(expr: Expression | undefined, fallback: string): string {
  if (!expr) return fallback;
  if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value;
  if (expr.type === 'Identifier') return expr.name;
  return fallback;
}

function readFlowNumber(expr: Expression | undefined, fallback: number): number {
  if (!expr) return fallback;
  if (expr.type === 'Literal' && typeof expr.value === 'number') return expr.value;
  return fallback;
}
