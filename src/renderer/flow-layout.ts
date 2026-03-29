import { FlowDeclaration } from '../ast/types';
import {
  DEFAULT_TARGET_WIDTH,
  FLOW_PADDING,
  LayoutCandidate,
  LayoutNode,
  ResolvedFlowOptions,
} from './flow-types';
import { candidateModes, resolveFlowOptions } from './flow-layout-options';
import { createNode, measureNodes } from './flow-layout-measure';
import { placeNodes } from './flow-layout-place';
import { buildEdges } from './flow-layout-routing';
import { boundsFromNodes, boundsFromNodesAndEdges } from './flow-layout-bounds';
import { topologicalOrder } from './flow-layout-graph';

/**
 * Layout engine for flow declarations.
 * Rendering stays in `flow.ts` so this module only computes positions and bounds.
 */
export function layoutFlow(flow: FlowDeclaration) {
  const options = resolveFlowOptions(flow);
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const orderedNodeIds = topologicalOrder(nodes, edges);

  if (!orderedNodeIds.length) {
    return {
      nodes: [],
      edges: [],
      width: options.sizeMode === 'fixed' ? options.targetWidth : Math.max(DEFAULT_TARGET_WIDTH, options.targetWidth),
      height: options.sizeMode === 'fixed' ? options.targetHeight : Math.max(240, options.targetHeight),
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      direction: options.direction,
      options,
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (options.placementMode === 'manual') {
    return buildManualFlowLayout(orderedNodeIds, nodeById, edges, options);
  }
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

function buildCandidate(
  mode: Exclude<ResolvedFlowOptions['layoutMode'], 'auto'>,
  orderedNodeIds: string[],
  nodeById: Map<string, FlowDeclaration['nodes'][number]>,
  edges: FlowDeclaration['edges'],
  options: ResolvedFlowOptions,
): LayoutCandidate {
  let fontSize = options.preferredFontSize;
  let measured = measureNodes(orderedNodeIds, nodeById, fontSize, options.fit);
  let nodes = placeNodes(mode, orderedNodeIds, measured, options.fit, options.horizontalGap, options.verticalGap);
  let bounds = boundsFromNodes(nodes);

  const fitsPreferred = bounds.maxX - bounds.minX <= options.targetWidth - 120
    && bounds.maxY - bounds.minY <= options.targetHeight - 150;

  if (!fitsPreferred && options.readabilityMode === 'legacy') {
    const scaleX = (options.targetWidth - 120) / Math.max(bounds.maxX - bounds.minX, 1);
    const scaleY = (options.targetHeight - 150) / Math.max(bounds.maxY - bounds.minY, 1);
    const scaledFont = Math.floor(options.preferredFontSize * Math.min(scaleX, scaleY, 1));
    fontSize = Math.max(options.minFontSize, scaledFont || options.minFontSize);
    measured = measureNodes(orderedNodeIds, nodeById, fontSize, options.fit);
    nodes = placeNodes(mode, orderedNodeIds, measured, options.fit, options.horizontalGap, options.verticalGap);
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
  const score = options.readabilityMode === 'legacy'
    ? overflowX * 5 + overflowY * 4 + compactPenalty * 40 + modePenalty
    : overflowX * 1.8 + overflowY * 1.6 + compactPenalty * 140 + modePenalty;

  return {
    mode,
    nodes,
    edges: edgesLayout,
    minX: fullBounds.minX - options.padding,
    minY: fullBounds.minY - options.padding,
    maxX: fullBounds.maxX + options.padding,
    maxY: fullBounds.maxY + options.padding,
    width: options.sizeMode === 'fixed'
      ? options.targetWidth
      : Math.max(options.targetWidth, contentWidth + options.padding * 2),
    height: options.sizeMode === 'fixed'
      ? options.targetHeight
      : Math.max(options.targetHeight, contentHeight + options.padding * 2),
    fontSize,
    overflowX,
    overflowY,
    score,
  };
}

function chooseCandidate(candidates: LayoutCandidate[]): LayoutCandidate {
  return [...candidates].sort((a, b) => a.score - b.score)[0];
}

function buildManualFlowLayout(
  orderedNodeIds: string[],
  nodeById: Map<string, FlowDeclaration['nodes'][number]>,
  edges: FlowDeclaration['edges'],
  options: ResolvedFlowOptions,
) {
  const measured = measureNodes(orderedNodeIds, nodeById, options.preferredFontSize, options.fit);
  const nodes: LayoutNode[] = orderedNodeIds.map((id, index) => {
    const nodeDecl = nodeById.get(id);
    const measuredNode = createNode(id, measured.get(id));
    const nodeProps = (nodeDecl as any)?.properties ?? {};
    const x = typeof nodeProps?.x?.value === 'number'
      ? nodeProps.x.value
      : index * (measuredNode.width + options.horizontalGap);
    const y = typeof nodeProps?.y?.value === 'number'
      ? nodeProps.y.value
      : 0;
    return { ...measuredNode, x, y };
  });
  const edgesLayout = buildEdges(edges, nodes);
  const bounds = boundsFromNodesAndEdges(nodes, edgesLayout);
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  return {
    nodes,
    edges: edgesLayout,
    width: options.sizeMode === 'fixed'
      ? options.targetWidth
      : Math.max(options.targetWidth, contentWidth + options.padding * 2),
    height: options.sizeMode === 'fixed'
      ? options.targetHeight
      : Math.max(options.targetHeight, contentHeight + options.padding * 2),
    minX: bounds.minX - options.padding,
    minY: bounds.minY - options.padding,
    maxX: bounds.maxX + options.padding,
    maxY: bounds.maxY + options.padding,
    direction: options.direction,
    options,
  };
}
