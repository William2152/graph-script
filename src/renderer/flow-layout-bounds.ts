import { LayoutEdge, LayoutNode } from './flow-types';

/**
 * Bounds helpers for node/edge envelopes.
 */
export function boundsFromNodes(nodes: LayoutNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = nodes.flatMap((node) => [node.x - node.width / 2, node.x + node.width / 2]);
  const ys = nodes.flatMap((node) => [node.y - node.height / 2, node.y + node.height / 2]);
  return {
    minX: Math.min(...xs, 0),
    minY: Math.min(...ys, 0),
    maxX: Math.max(...xs, 0),
    maxY: Math.max(...ys, 0),
  };
}

export function boundsFromNodesAndEdges(nodes: LayoutNode[], edges: LayoutEdge[]): { minX: number; minY: number; maxX: number; maxY: number } {
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
