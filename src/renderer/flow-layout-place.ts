import { FitMode, LayoutNode, NodeBox } from './flow-types';
import { createNode } from './flow-layout-measure';

/**
 * Positioning strategies for flow layout candidates.
 */
export function placeNodes(
  mode: 'single_row' | 'snake' | 'vertical',
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

function rowWidth(nodes: LayoutNode[], gap: number): number {
  return nodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, nodes.length - 1) * gap;
}
