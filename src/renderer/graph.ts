import { DiagramElement } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { layoutGraphNodes, expandGraphElementsRecursive } from './graph-layout';
import {
  CompiledGraphResult,
  GraphCompileOptions,
  GraphEdgeSpec,
  GraphNodeSpec,
  GRAPH_LAYOUTS,
} from './graph-types';
import { clamp, getNumber, getString, makeElement } from './graph-utils';
import { deriveGraphAutoVisuals, resolveReadabilityMode, READABILITY_POLICY } from './readability-policy';

export type { CompiledGraphNode } from './graph-types';
export type { CompiledGraphResult, GraphCompileOptions } from './graph-types';

/**
 * Expands and compiles graph DSL elements into primitive diagram elements.
 */
export function expandGraphElements(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement[] {
  return expandGraphElementsRecursive(elements, (graph) =>
    compileGraphElement(graph, values, traces, { includeOwnPosition: true }).elements,
  );
}

export function compileGraphElement(
  graph: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  options: GraphCompileOptions = {},
): CompiledGraphResult {
  if (graph.type !== 'graph') {
    throw new Error(`Expected graph element, received "${graph.type}".`);
  }

  const includeOwnPosition = options.includeOwnPosition ?? false;
  const readabilityMode = resolveReadabilityMode(getString(graph, values, traces, 'readability_mode', 'auto'), 'auto');
  const defaultWidth = Math.max(80, options.defaultWidth ?? 240);
  const width = clamp(
    getNumber(graph, values, traces, 'w', defaultWidth),
    80,
    options.maxWidth ?? Number.POSITIVE_INFINITY,
  );
  const defaultHeight = Math.max(120, options.defaultHeight ?? Math.max(180, Math.round(width * 0.72)));
  const height = clamp(
    getNumber(graph, values, traces, 'h', defaultHeight),
    80,
    options.maxHeight ?? Number.POSITIVE_INFINITY,
  );
  const originX = includeOwnPosition ? getNumber(graph, values, traces, 'x', 0) : 0;
  const originY = includeOwnPosition ? getNumber(graph, values, traces, 'y', 0) : 0;
  const layoutRaw = getString(graph, values, traces, 'layout', 'circle');
  const layout = GRAPH_LAYOUTS.has(layoutRaw) ? layoutRaw : 'circle';
  const seed = Math.max(1, Math.round(getNumber(graph, values, traces, 'seed', 1)));
  const iterations = Math.max(1, Math.round(getNumber(graph, values, traces, 'iterations', 120)));
  const autoVisuals = deriveGraphAutoVisuals(width, height, Math.max(1, (graph.children ?? []).filter((child) => child.type === 'node').length));
  const padding = Math.max(0, getNumber(graph, values, traces, 'padding', readabilityMode === 'legacy' ? 24 : autoVisuals.padding));

  const defaultNodeRadius = Math.max(10, getNumber(graph, values, traces, 'node_radius', readabilityMode === 'legacy' ? 24 : autoVisuals.radius));
  const defaultNodeFill = getString(graph, values, traces, 'node_fill', '#2563eb');
  const defaultNodeStroke = getString(graph, values, traces, 'node_stroke', defaultNodeFill);
  const defaultNodeStrokeWidth = Math.max(1, getNumber(graph, values, traces, 'node_strokeWidth', readabilityMode === 'legacy' ? 2 : Math.max(2, autoVisuals.edgeStrokeWidth * 0.72)));
  const defaultNodeColor = getString(graph, values, traces, 'node_color', '#ffffff');
  const defaultNodeSize = Math.max(
    READABILITY_POLICY.bodyTextMin,
    getNumber(graph, values, traces, 'node_size', readabilityMode === 'legacy' ? Math.round(defaultNodeRadius * 0.9) : autoVisuals.labelSize),
  );
  const defaultEdgeStroke = getString(graph, values, traces, 'edge_stroke', '#94a3b8');
  const defaultEdgeStrokeWidth = Math.max(1, getNumber(graph, values, traces, 'edge_strokeWidth', readabilityMode === 'legacy' ? 3 : autoVisuals.edgeStrokeWidth));
  const defaultEdgeDash = getString(graph, values, traces, 'edge_dash', '');

  const nodeSpecs: GraphNodeSpec[] = [];
  const edgeSpecs: GraphEdgeSpec[] = [];
  for (const child of graph.children ?? []) {
    if (child.type === 'node') {
      const derivedRadius = child.properties.radius
        ? getNumber(child, values, traces, 'radius', defaultNodeRadius)
        : child.properties.w && child.properties.h
          ? Math.max(10, Math.min(
              getNumber(child, values, traces, 'w', defaultNodeRadius * 2),
              getNumber(child, values, traces, 'h', defaultNodeRadius * 2),
            ) / 2)
          : defaultNodeRadius;
      nodeSpecs.push({
        name: child.name,
        label: getString(child, values, traces, 'label', child.name),
        radius: Math.max(10, derivedRadius),
        fill: getString(child, values, traces, 'fill', defaultNodeFill),
        stroke: getString(child, values, traces, 'stroke', defaultNodeStroke),
        strokeWidth: Math.max(1, getNumber(child, values, traces, 'strokeWidth', defaultNodeStrokeWidth)),
        color: getString(child, values, traces, 'color', defaultNodeColor),
        size: Math.max(10, getNumber(child, values, traces, 'size', defaultNodeSize)),
        x: child.properties.x ? getNumber(child, values, traces, 'x', 0) : undefined,
        y: child.properties.y ? getNumber(child, values, traces, 'y', 0) : undefined,
      });
      continue;
    }

    if (child.type === 'edge') {
      edgeSpecs.push({
        name: child.name,
        from: getString(child, values, traces, 'from', ''),
        to: getString(child, values, traces, 'to', ''),
        stroke: getString(child, values, traces, 'stroke', defaultEdgeStroke),
        strokeWidth: Math.max(1, getNumber(child, values, traces, 'strokeWidth', defaultEdgeStrokeWidth)),
        dash: getString(child, values, traces, 'dash', defaultEdgeDash),
      });
      continue;
    }

    throw new Error(`Graph "${graph.name}" only supports "node" and "edge" children, found "${child.type}".`);
  }

  if (!nodeSpecs.length) {
    throw new Error(`Graph "${graph.name}" must contain at least one node.`);
  }

  const positionedNodes = layoutGraphNodes(layout, nodeSpecs, edgeSpecs, width, height, padding, seed, iterations).map((node) => ({
    ...node,
    x: originX + node.x,
    y: originY + node.y,
  }));

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const elements: DiagramElement[] = [];

  for (const edge of edgeSpecs) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) {
      throw new Error(`Edge "${edge.name}" in graph "${graph.name}" references unknown nodes "${edge.from}" -> "${edge.to}".`);
    }
    if (edge.from === edge.to) {
      throw new Error(`Self-loop edge "${edge.name}" is not supported in graph "${graph.name}".`);
    }

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const distance = Math.max(0.0001, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;

    elements.push(makeElement('line', `${graph.name}-${edge.name}`, {
      x: fromNode.x + ux * fromNode.radius,
      y: fromNode.y + uy * fromNode.radius,
      x2: toNode.x - ux * toNode.radius,
      y2: toNode.y - uy * toNode.radius,
      label: '',
      stroke: edge.stroke,
      strokeWidth: edge.strokeWidth,
      dash: edge.dash,
    }));
  }

  for (const node of positionedNodes) {
    elements.push(makeElement('circle', `${graph.name}-${node.id}`, {
      x: node.x - node.radius,
      y: node.y - node.radius,
      w: node.radius * 2,
      h: node.radius * 2,
      label: '',
      fill: node.fill,
      stroke: node.stroke,
      strokeWidth: node.strokeWidth,
    }));
  }

  for (const node of positionedNodes) {
    if (!node.label) continue;
    const labelWidth = Math.max(node.radius * 1.5, node.label.length * node.size * 0.62 + 12);
    const labelHeight = Math.max(node.size + 8, node.radius * 1.15);
    elements.push(makeElement('text', `${graph.name}-${node.id}-label`, {
      x: node.x,
      y: node.y - labelHeight / 2,
      w: labelWidth,
      h: labelHeight,
      value: node.label,
      size: node.size,
      weight: '700',
      color: node.color,
      anchor: 'middle',
      allow_overlap: true,
      validation_ignore: true,
    }));
  }

  return { width, height, elements, nodes: positionedNodes };
}
