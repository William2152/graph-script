import { FlowDeclaration, FlowNode, FlowEdge } from '../ast/types';

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
}

export function layoutFlow(flow: FlowDeclaration): FlowLayout {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  const nodeWidth = 120;
  const nodeHeight = 50;
  const horizontalGap = 80;
  const verticalGap = 60;
  const padding = 40;

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  const levels: string[][] = [];
  let currentLevel = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);

  if (currentLevel.length === 0) {
    currentLevel = nodes.map(n => n.id);
  }

  levels.push([...currentLevel]);
  const assigned = new Set(currentLevel);

  while (assigned.size < nodes.length) {
    const nextLevel: string[] = [];

    for (const nodeId of currentLevel) {
      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!assigned.has(neighbor)) {
          const allParentsAssigned = edges
            .filter(e => e.to === neighbor)
            .every(e => assigned.has(e.from));

          if (allParentsAssigned && !nextLevel.includes(neighbor)) {
            nextLevel.push(neighbor);
          }
        }
      }
    }

    if (nextLevel.length === 0) {
      for (const node of nodes) {
        if (!assigned.has(node.id)) {
          nextLevel.push(node.id);
          break;
        }
      }
    }

    if (nextLevel.length === 0) break;

    levels.push([...nextLevel]);
    nextLevel.forEach(n => assigned.add(n));
    currentLevel = nextLevel;
  }

  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  levels.forEach((level, row) => {
    const levelWidth = level.length * nodeWidth + (level.length - 1) * horizontalGap;
    const startX = (levelWidth > 0 ? -levelWidth / 2 : 0) + nodeWidth / 2;

    level.forEach((nodeId, col) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const x = startX + col * (nodeWidth + horizontalGap);
      const y = row * (nodeHeight + verticalGap);
      const label = node.label || node.id;

      const layoutNode: LayoutNode = {
        id: node.id,
        label,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight
      };

      layoutNodes.push(layoutNode);
      nodeMap.set(node.id, layoutNode);
    });
  });

  const layoutEdges: LayoutEdge[] = edges.map(edge => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

    if (!fromNode || !toNode) {
      return { from: edge.from, to: edge.to, label: edge.label, points: [] };
    }

    const startX = fromNode.x + fromNode.width / 2;
    const startY = fromNode.y + fromNode.height;
    const endX = toNode.x + toNode.width / 2;
    const endY = toNode.y;

    const midY = (startY + endY) / 2;
    const points = [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY }
    ];

    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      points
    };
  });

  let maxX = 0, maxY = 0;
  for (const node of layoutNodes) {
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  const width = maxX + padding;
  const height = maxY + padding;

  return { nodes: layoutNodes, edges: layoutEdges, width, height };
}

export function renderFlow(layout: FlowLayout, title?: string): string {
  const { width, height, nodes, edges } = layout;
  const svgWidth = Math.max(width + 100, 400);
  const svgHeight = Math.max(height + 100, 300);
  const offsetX = svgWidth / 2;
  const offsetY = 60;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
  svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="white"/>`;

  if (title) {
    svg += `<text x="${svgWidth / 2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${escapeXml(title)}</text>`;
  }

  svg += `<g transform="translate(${offsetX}, ${offsetY})">`;

  for (const edge of edges) {
    if (edge.points.length < 2) continue;

    const pathPoints = edge.points.map(p => `${p.x},${p.y}`).join(' ');
    svg += `<polyline points="${pathPoints}" fill="none" stroke="#666" stroke-width="2" marker-end="url(#arrow)"/>`;

    if (edge.label) {
      const midIdx = Math.floor(edge.points.length / 2);
      const midX = edge.points[midIdx].x;
      const midY = edge.points[midIdx].y;
      svg += `<text x="${midX}" y="${midY - 8}" text-anchor="middle" font-size="11" fill="#666">${escapeXml(edge.label)}</text>`;
    }
  }

  svg += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`;
  svg += `<path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/></marker></defs>`;

  const nodeColors: Record<string, string> = {
    start: '#27ae60',
    end: '#e74c3c',
    decision: '#f39c12',
    process: '#3498db',
    data: '#9b59b6'
  };

  for (const node of nodes) {
    const fillColor = nodeColors[node.label.toLowerCase()] || '#3498db';

    svg += `<g transform="translate(${node.x - node.width / 2}, ${node.y - node.height / 2})">`;

    svg += `<rect width="${node.width}" height="${node.height}" rx="6" fill="${fillColor}" stroke="#2c3e50" stroke-width="2"/>`;

    svg += `<text x="${node.width / 2}" y="${node.height / 2 + 5}" text-anchor="middle" font-size="12" fill="white" font-weight="500">${escapeXml(node.label)}</text>`;

    svg += `</g>`;
  }

  svg += `</g>`;
  svg += `</svg>`;

  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
