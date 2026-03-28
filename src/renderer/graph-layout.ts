import { DiagramElement } from '../ast/types';
import { GraphEdgeSpec, GraphNodeSpec, CompiledGraphNode } from './graph-types';
import { clamp, seededRandom } from './graph-utils';

/**
 * Computes node positions for manual/circle/force graph layouts.
 */
export function layoutGraphNodes(
  layout: string,
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[],
  width: number,
  height: number,
  padding: number,
  seed: number,
  iterations: number,
): CompiledGraphNode[] {
  const maxRadius = Math.max(...nodes.map((node) => node.radius));
  const innerLeft = padding + maxRadius;
  const innerRight = Math.max(innerLeft, width - padding - maxRadius);
  const innerTop = padding + maxRadius;
  const innerBottom = Math.max(innerTop, height - padding - maxRadius);
  const innerWidth = Math.max(0, innerRight - innerLeft);
  const innerHeight = Math.max(0, innerBottom - innerTop);

  if (layout === 'manual') {
    return nodes.map((node) => {
      if (node.x == null || node.y == null) {
        throw new Error(`Node "${node.name}" in manual graph is missing x/y coordinates.`);
      }
      return {
        id: node.name,
        label: node.label,
        x: clamp(node.x, padding + node.radius, width - padding - node.radius),
        y: clamp(node.y, padding + node.radius, height - padding - node.radius),
        radius: node.radius,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
        color: node.color,
        size: node.size,
      };
    });
  }

  if (layout === 'circle') {
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = Math.max(0, innerWidth / 2);
    const radiusY = Math.max(0, innerHeight / 2);
    return nodes.map((node, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(nodes.length, 1);
      return {
        id: node.name,
        label: node.label,
        x: clamp(centerX + radiusX * Math.cos(angle), padding + node.radius, width - padding - node.radius),
        y: clamp(centerY + radiusY * Math.sin(angle), padding + node.radius, height - padding - node.radius),
        radius: node.radius,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
        color: node.color,
        size: node.size,
      };
    });
  }

  const initial = layoutGraphNodes('circle', nodes, edges, width, height, padding, seed, iterations).map((node) => ({
    ...node,
    x: node.x,
    y: node.y,
  }));
  const rand = seededRandom(seed);
  const jitterX = Math.min(28, Math.max(8, innerWidth * 0.08));
  const jitterY = Math.min(28, Math.max(8, innerHeight * 0.08));
  const positions = initial.map((node) => ({
    ...node,
    x: clamp(node.x + (rand() - 0.5) * jitterX, padding + node.radius, width - padding - node.radius),
    y: clamp(node.y + (rand() - 0.5) * jitterY, padding + node.radius, height - padding - node.radius),
  }));
  if (positions.length <= 1) return positions;

  const nodeIndex = new Map(positions.map((node, index) => [node.id, index]));
  const usableWidth = Math.max(40, innerWidth);
  const usableHeight = Math.max(40, innerHeight);
  const area = Math.max(usableWidth * usableHeight, 1);
  const k = Math.sqrt(area / positions.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const disp = positions.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const repel = (k * k) / distance;
        const ux = dx / distance;
        const uy = dy / distance;
        disp[i].x += ux * repel;
        disp[i].y += uy * repel;
        disp[j].x -= ux * repel;
        disp[j].y -= uy * repel;
      }
    }

    for (const edge of edges) {
      const fromIndex = nodeIndex.get(edge.from);
      const toIndex = nodeIndex.get(edge.to);
      if (fromIndex == null || toIndex == null) continue;
      const dx = positions[fromIndex].x - positions[toIndex].x;
      const dy = positions[fromIndex].y - positions[toIndex].y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const attract = (distance * distance) / Math.max(k, 0.01);
      const ux = dx / distance;
      const uy = dy / distance;
      disp[fromIndex].x -= ux * attract;
      disp[fromIndex].y -= uy * attract;
      disp[toIndex].x += ux * attract;
      disp[toIndex].y += uy * attract;
    }

    const temperature = Math.max(2, Math.min(usableWidth, usableHeight) * 0.08 * (1 - iteration / Math.max(iterations, 1)));
    for (let index = 0; index < positions.length; index += 1) {
      const length = Math.max(0.01, Math.hypot(disp[index].x, disp[index].y));
      positions[index].x = clamp(
        positions[index].x + (disp[index].x / length) * Math.min(length, temperature) * 0.14,
        padding + positions[index].radius,
        width - padding - positions[index].radius,
      );
      positions[index].y = clamp(
        positions[index].y + (disp[index].y / length) * Math.min(length, temperature) * 0.14,
        padding + positions[index].radius,
        height - padding - positions[index].radius,
      );
    }
  }

  return positions;
}

export function expandGraphElementsRecursive(
  elements: DiagramElement[],
  expandGraph: (graph: DiagramElement) => DiagramElement[],
): DiagramElement[] {
  const expanded: DiagramElement[] = [];

  for (const element of elements) {
    if (element.type === 'graph') {
      expanded.push(...expandGraph(element));
      continue;
    }

    if (element.type === 'node' || element.type === 'edge') {
      throw new Error(`Diagram element "${element.name}" of type "${element.type}" must be declared inside a graph element.`);
    }

    if (element.children?.length) {
      expanded.push({
        ...element,
        children: expandGraphElementsRecursive(element.children, expandGraph),
      });
      continue;
    }

    expanded.push(element);
  }

  return expanded;
}
