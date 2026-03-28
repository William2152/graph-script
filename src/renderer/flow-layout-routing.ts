import { FlowEdgeDecl, LayoutEdge, LayoutNode } from './flow-types';

/**
 * Edge routing helpers for orthogonal flow connectors.
 */
export function buildEdges(edges: FlowEdgeDecl[], nodes: LayoutNode[]): LayoutEdge[] {
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
