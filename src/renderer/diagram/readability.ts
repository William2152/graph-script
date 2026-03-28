import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { resolveValue } from '../common';
import {
  ReadabilityMode,
  READABILITY_POLICY,
  readReadabilityMode,
  clamp,
} from '../readability-policy';

const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

type BoxLikeElement = DiagramElement & { properties: Record<string, any> };

export interface DiagramReadabilityOptions {
  mode: ReadabilityMode;
}

export function normalizeDiagramElementsForReadability(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  options: DiagramReadabilityOptions,
): DiagramElement[] {
  if (options.mode === 'legacy') return elements;
  const normalized = elements.map((element) => normalizeElementTypography(element, values, traces));
  return normalizeSiblingBoxes(normalized, values, traces);
}

export function readDiagramReadabilityMode(
  element: { properties?: Record<string, any> } | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: ReadabilityMode = 'auto',
): ReadabilityMode {
  return readReadabilityMode(element?.properties?.readability_mode, values, traces, fallback);
}

function normalizeElementTypography(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement {
  const properties = { ...element.properties };

  if (element.type === 'text') {
    const current = readNumberProperty(properties.size, values, traces, READABILITY_POLICY.bodyTextMin);
    setLiteral(properties, 'size', Math.max(READABILITY_POLICY.bodyTextMin, current));
  } else if (element.type === 'formula') {
    const current = readNumberProperty(properties.size, values, traces, READABILITY_POLICY.formulaTextMin);
    setLiteral(properties, 'size', Math.max(READABILITY_POLICY.formulaTextMin, current));
  } else if (isBoxLike(element)) {
    const titleSize = readNumberProperty(properties.title_size ?? properties.size, values, traces, READABILITY_POLICY.cardTitleMin);
    const subtitleSize = readNumberProperty(properties.subtitle_size, values, traces, READABILITY_POLICY.bodyTextMin);
    setLiteral(properties, 'title_size', Math.max(READABILITY_POLICY.cardTitleMin, titleSize));
    setLiteral(properties, 'size', Math.max(READABILITY_POLICY.cardTitleMin, titleSize));
    if (properties.subtitle || properties.semantic_subtitle_role) {
      setLiteral(properties, 'subtitle_size', Math.max(READABILITY_POLICY.bodyTextMin, subtitleSize));
    }
  }

  let result: DiagramElement = { ...element, properties };
  if (element.children?.length) {
    const children = element.children.map((child) => normalizeElementTypography(child, values, traces));
    result = { ...result, children: normalizeSiblingBoxes(children, values, traces) };
  }
  return resizeContainerToContent(result, values, traces);
}

function normalizeSiblingBoxes(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement[] {
  const boxes = elements
    .map((element, index) => ({ element, index, box: resolveBox(element, values, traces) }))
    .filter((entry): entry is { element: DiagramElement; index: number; box: BoxMetrics } => entry.box !== null && isBoxLike(entry.element));
  if (boxes.length < 2) return elements;

  const next = [...elements];
  const snapTolerance = READABILITY_POLICY.alignmentSnapTolerance;
  const horizontalGapTarget = 44;
  const verticalGapTarget = 34;

  const rowAnchors = clusterAnchors(boxes.map((entry) => entry.box.y), snapTolerance);
  const colAnchors = clusterAnchors(boxes.map((entry) => entry.box.x), snapTolerance);

  for (const entry of boxes) {
    const alignedY = nearestAnchor(entry.box.y, rowAnchors, snapTolerance);
    const alignedX = nearestAnchor(entry.box.x, colAnchors, snapTolerance);
    if (alignedY !== null) next[entry.index] = setNumberProperty(next[entry.index], 'y', alignedY);
    if (alignedX !== null) next[entry.index] = setNumberProperty(next[entry.index], 'x', alignedX);
  }

  const byRows = groupBoxes(next, values, traces, 'row', snapTolerance);
  for (const row of byRows) {
    for (let index = 1; index < row.length; index += 1) {
      const previous = resolveBox(next[row[index - 1].index], values, traces);
      const current = resolveBox(next[row[index].index], values, traces);
      if (!previous || !current) continue;
      const gap = current.x - (previous.x + previous.width);
      const blocked = hasInterveningContent(next, values, traces, previous, current, 'horizontal', row[index - 1].index, row[index].index);
      if (!blocked && gap > horizontalGapTarget * READABILITY_POLICY.excessiveGapMultiplier) {
        const shift = gap - horizontalGapTarget;
        next[row[index].index] = shiftElement(next[row[index].index], -shift, 0);
      }
    }
  }

  const byCols = groupBoxes(next, values, traces, 'col', snapTolerance);
  for (const col of byCols) {
    for (let index = 1; index < col.length; index += 1) {
      const previous = resolveBox(next[col[index - 1].index], values, traces);
      const current = resolveBox(next[col[index].index], values, traces);
      if (!previous || !current) continue;
      const gap = current.y - (previous.y + previous.height);
      const blocked = hasInterveningContent(next, values, traces, previous, current, 'vertical', col[index - 1].index, col[index].index);
      if (!blocked && gap > verticalGapTarget * READABILITY_POLICY.excessiveGapMultiplier) {
        const shift = gap - verticalGapTarget;
        next[col[index].index] = shiftElement(next[col[index].index], 0, -shift);
      }
    }
  }

  return next;
}

function resizeContainerToContent(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement {
  if (!isBoxLike(element) || !element.children?.length) return element;

  const width = readNumberProperty(element.properties.w, values, traces, 0);
  const height = readNumberProperty(element.properties.h, values, traces, 0);
  if (width <= 0 || height <= 0) return element;

  const titleSize = readNumberProperty(element.properties.title_size ?? element.properties.size, values, traces, READABILITY_POLICY.cardTitleMin);
  const subtitle = readStringProperty(element.properties.subtitle, values, traces, '');
  const padding = READABILITY_POLICY.panelPaddingMin;
  const headerHeight = Math.max(58, padding + titleSize + (subtitle ? READABILITY_POLICY.bodyTextMin + 10 : 0));
  const childBounds = element.children
    .map((child) => resolveBox(child, values, traces))
    .filter((box): box is BoxMetrics => box !== null);
  if (!childBounds.length) return element;

  const bottom = Math.max(...childBounds.map((box) => box.y + box.height));
  const requiredHeight = Math.max(height * 0.55, bottom + padding, headerHeight + padding);
  const roomyHeight = requiredHeight * (1 + READABILITY_POLICY.whitespaceSlackRatio);

  let next = element;
  if (requiredHeight > height + 6) return setNumberProperty(next, 'h', requiredHeight);
  if (height > roomyHeight) return setNumberProperty(next, 'h', clamp(requiredHeight, requiredHeight, height));
  return next;
}

function groupBoxes(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  axis: 'row' | 'col',
  tolerance: number,
): Array<Array<{ index: number; box: BoxMetrics }>> {
  const entries = elements
    .map((element, index) => ({ index, box: resolveBox(element, values, traces), element }))
    .filter((entry): entry is { index: number; box: BoxMetrics; element: DiagramElement } => entry.box !== null && isBoxLike(entry.element))
    .sort((a, b) => axis === 'row' ? a.box.y - b.box.y || a.box.x - b.box.x : a.box.x - b.box.x || a.box.y - b.box.y);

  const groups: Array<Array<{ index: number; box: BoxMetrics }>> = [];
  for (const entry of entries) {
    const anchor = axis === 'row' ? entry.box.y : entry.box.x;
    const group = groups.find((candidate) => Math.abs((axis === 'row' ? candidate[0].box.y : candidate[0].box.x) - anchor) <= tolerance);
    if (group) group.push({ index: entry.index, box: entry.box });
    else groups.push([{ index: entry.index, box: entry.box }]);
  }
  return groups.filter((group) => group.length > 1);
}

function clusterAnchors(values: number[], tolerance: number): number[] {
  const anchors: number[] = [];
  for (const value of values.sort((a, b) => a - b)) {
    const existing = anchors.find((anchor) => Math.abs(anchor - value) <= tolerance);
    if (existing == null) anchors.push(value);
  }
  return anchors;
}

function nearestAnchor(value: number, anchors: number[], tolerance: number): number | null {
  const match = anchors.find((anchor) => Math.abs(anchor - value) <= tolerance);
  return match == null ? null : match;
}

function shiftElement(element: DiagramElement, dx: number, dy: number): DiagramElement {
  return setNumberProperty(setNumberProperty(element, 'x', readLiteralNumber(element.properties.x) + dx), 'y', readLiteralNumber(element.properties.y) + dy);
}

function setNumberProperty(element: DiagramElement, key: string, value: number): DiagramElement {
  return {
    ...element,
    properties: {
      ...element.properties,
      [key]: { type: 'Literal', value, location: ZERO_LOC },
    },
  };
}

function setLiteral(properties: Record<string, any>, key: string, value: string | number | boolean): void {
  properties[key] = { type: 'Literal', value, location: ZERO_LOC };
}

function readLiteralNumber(expr: any): number {
  return expr?.type === 'Literal' && typeof expr.value === 'number' ? expr.value : 0;
}

function readNumberProperty(
  expr: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: number,
): number {
  if (!expr) return fallback;
  const value = resolveValue(expr, values, traces);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringProperty(
  expr: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: string,
): string {
  if (!expr) return fallback;
  const value = resolveValue(expr, values, traces);
  return typeof value === 'string' ? value : fallback;
}

function resolveBox(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): BoxMetrics | null {
  const x = readNumberProperty(element.properties.x, values, traces, 0);
  const y = readNumberProperty(element.properties.y, values, traces, 0);
  const width = readNumberProperty(element.properties.w, values, traces, 0);
  const height = readNumberProperty(element.properties.h, values, traces, 0);
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function isBoxLike(element: DiagramElement): element is BoxLikeElement {
  return element.type === 'panel' || element.type === 'box' || element.type === 'callout' || element.type === 'badge';
}

interface BoxMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

function hasInterveningContent(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  start: BoxMetrics,
  end: BoxMetrics,
  axis: 'horizontal' | 'vertical',
  startIndex: number,
  endIndex: number,
): boolean {
  return elements.some((element, index) => {
    if (index === startIndex || index === endIndex) return false;
    const box = resolveBox(element, values, traces);
    if (!box) return false;

    if (axis === 'horizontal') {
      const between = box.x < end.x && (box.x + box.width) > (start.x + start.width);
      const overlapsBand = box.y < Math.max(start.y + start.height, end.y + end.height)
        && (box.y + box.height) > Math.min(start.y, end.y);
      return between && overlapsBand;
    }

    const between = box.y < end.y && (box.y + box.height) > (start.y + start.height);
    const overlapsBand = box.x < Math.max(start.x + start.width, end.x + end.width)
      && (box.x + box.width) > Math.min(start.x, end.x);
    return between && overlapsBand;
  });
}
