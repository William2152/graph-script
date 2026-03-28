import { FlowDeclaration } from '../ast/types';
import {
  DEFAULT_TARGET_WIDTH,
  FLOW_PADDING,
  LayoutCandidate,
  ResolvedFlowOptions,
} from './flow-types';
import { candidateModes, resolveFlowOptions } from './flow-layout-options';
import { measureNodes } from './flow-layout-measure';
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

function buildCandidate(
  mode: Exclude<ResolvedFlowOptions['layoutMode'], 'auto'>,
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

  if (!fitsPreferred && options.readabilityMode === 'legacy') {
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
  const score = options.readabilityMode === 'legacy'
    ? overflowX * 5 + overflowY * 4 + compactPenalty * 40 + modePenalty
    : overflowX * 1.8 + overflowY * 1.6 + compactPenalty * 140 + modePenalty;

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
