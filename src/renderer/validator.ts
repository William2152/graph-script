import * as fs from 'fs';
import * as path from 'path';
import { DiagramDeclaration, DiagramElement, FlowDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { readNumber, readBoolean, readString, resolveValue } from './common';
import { compileSemanticDiagram } from './diagram-semantic';
import { layoutFlow } from './flow';

export const OVERLAP_TOLERANCE = 5;
export const MAX_RETRIES = 5;
export const MIN_FONT_SIZE = 14;
export const MIN_ELEMENT_SIZE = 20;
const MIN_LAYOUT_GAP = 14;
const EXCESSIVE_GAP_MULTIPLIER = 3;

export interface BoundingBox {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowOverlap: boolean;
  parentId?: string;
  validationIgnore?: boolean;
  ancestorIds?: string[];
}

export interface ValidationIssue {
  kind: 'overlap' | 'overflow' | 'tight_gap' | 'awkward_spacing' | 'connector_cross_panel' | 'math_fallback';
  element1: { id: string; type: string };
  element2: { id: string; type: string };
  overlapArea: number;
  overlapPercentage: number;
  severity: 'error' | 'warning' | 'info';
  location: { x: number; y: number; width: number; height: number };
  message?: string;
}

export type OverlapIssue = ValidationIssue;

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  readabilityScore: number;
}

export interface ReadabilityMetrics {
  minFontSize: number;
  avgFontSize: number;
  minElementSize: number;
  density: number;
  elementCount: number;
}

export interface ValidationReport {
  timestamp: string;
  file: string;
  declaration: string;
  declarationType: string;
  attempts: number;
  success: boolean;
  readabilityScore: number;
  issues: Array<{
    kind?: ValidationIssue['kind'];
    severity: 'error' | 'warning' | 'info';
    element1: string;
    element2: string;
    overlapArea: number;
    overlapPercentage: number;
    location: { x: number; y: number; width: number; height: number };
    message?: string;
  }>;
  metrics: {
    minFontSize: number;
    avgFontSize: number;
    minElementSize: number;
    density: number;
    elementCount: number;
  };
  suggestions: string[];
}

export interface RelayoutStrategy {
  type: 'spacing' | 'scaling' | 'reposition';
  factor: number;
}

interface ElementParentMap {
  elementId: string;
  parentId: string | null;
}

interface ValidationSnapshot {
  elements: DiagramElement[];
  boxes: BoundingBox[];
}

const OVERLAP_TYPES_ALLOWED = new Set(['line', 'arrow', 'connector', 'embed']);
const VALIDATABLE_DECLARATION_TYPES = new Set([
  'DiagramDeclaration',
  'FlowDeclaration',
  'ChartDeclaration',
  'TableDeclaration',
  'ErdDeclaration',
  'InfraDeclaration',
  'Plot3dDeclaration',
  'Scene3dDeclaration',
  'PageDeclaration',
]);

const NEEDS_RELAYOUT_TYPES = new Set([
  'DiagramDeclaration',
  'FlowDeclaration',
  'ErdDeclaration',
  'InfraDeclaration',
  'PageDeclaration',
]);

export function isValidatableDeclaration(declType: string): boolean {
  return VALIDATABLE_DECLARATION_TYPES.has(declType);
}

export function needsRelayout(declType: string): boolean {
  return NEEDS_RELAYOUT_TYPES.has(declType);
}

function getNumberProperty(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: number
): number {
  const expr = element.properties[key];
  if (!expr) return fallback;
  const resolved = resolveValue(expr, values, traces);
  return readNumber(resolved, fallback);
}

function getBooleanProperty(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: boolean
): boolean {
  const expr = element.properties[key];
  if (!expr) return fallback;
  const resolved = resolveValue(expr, values, traces);
  return readBoolean(resolved, fallback);
}

function getStringProperty(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: string
): string {
  const expr = element.properties[key];
  if (!expr) return fallback;
  const resolved = resolveValue(expr, values, traces);
  return readString(resolved, fallback);
}

export function extractBoundingBoxes(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
  parentId: string | null = null,
  ancestorIds: string[] = []
): BoundingBox[] {
  const boxes: BoundingBox[] = [];

  for (const element of elements) {
    const validationIgnore = getBooleanProperty(element, values, traces, 'validation_ignore', false);
    if (OVERLAP_TYPES_ALLOWED.has(element.type)) continue;

    const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
    const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
    const w = getNumberProperty(element, values, traces, 'w', 0);
    const h = getNumberProperty(element, values, traces, 'h', 0);

    if (w > 0 && h > 0 && !validationIgnore) {
      const allowOverlap = isIntendedOverlap(element, values, traces, parentId);
      boxes.push({
        id: element.name,
        type: element.type,
        x,
        y,
        width: w,
        height: h,
        allowOverlap,
        parentId: parentId || undefined,
        validationIgnore,
        ancestorIds,
      });
    }

    if (element.children?.length) {
      boxes.push(...extractBoundingBoxes(element.children, values, traces, x, y, element.name, [...ancestorIds, element.name]));
    }
  }

  return boxes;
}

export function isIntendedOverlap(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  parentId: string | null = null
): boolean {
  const fillOpacity = getNumberProperty(element, values, traces, 'fillOpacity', 1);
  if (fillOpacity < 1) return true;

  const strokeOpacity = getNumberProperty(element, values, traces, 'strokeOpacity', 1);
  if (strokeOpacity < 1) return true;

  if (getBooleanProperty(element, values, traces, 'allow_overlap', false)) return true;

  if (parentId && getBooleanProperty(element, values, traces, 'allow_overlap_with_parent', false)) return true;

  return false;
}

export function calculateOverlap(
  a: BoundingBox,
  b: BoundingBox
): { area: number; percentage: number; bounds: BoundingBox } {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const area = xOverlap * yOverlap;

  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  const percentage = smallerArea > 0 ? (area / smallerArea) * 100 : 0;

  return {
    area,
    percentage,
    bounds: {
      id: 'overlap-region',
      type: 'overlap',
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      width: xOverlap,
      height: yOverlap,
      allowOverlap: false,
    },
  };
}

export function detectOverlaps(
  boxes: BoundingBox[],
  tolerance = OVERLAP_TOLERANCE
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const toleranceArea = tolerance * tolerance;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];

      if (a.allowOverlap || b.allowOverlap) continue;
      if ((a.ancestorIds ?? []).includes(b.id) || (b.ancestorIds ?? []).includes(a.id)) continue;

      const overlap = calculateOverlap(a, b);

      if (overlap.area > toleranceArea) {
        const severity: 'error' | 'warning' | 'info' =
          overlap.percentage > 30 ? 'error' : overlap.percentage > 10 ? 'warning' : 'info';

        issues.push({
          kind: 'overlap',
          element1: { id: a.id, type: a.type },
          element2: { id: b.id, type: b.type },
          overlapArea: Math.round(overlap.area),
          overlapPercentage: Math.round(overlap.percentage * 10) / 10,
          severity,
          location: {
            x: Math.round(overlap.bounds.x),
            y: Math.round(overlap.bounds.y),
            width: Math.round(overlap.bounds.width),
            height: Math.round(overlap.bounds.height),
          },
          message: `Elements "${a.id}" and "${b.id}" overlap`,
        });
      }
    }
  }

  return issues;
}

export function calculateReadability(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>
): ReadabilityMetrics {
  let minFontSize = Infinity;
  let totalFontSize = 0;
  let fontSizeCount = 0;
  let minElementSize = Infinity;
  let totalArea = 0;
  let elementCount = 0;

  function processElements(elems: DiagramElement[]): void {
    for (const element of elems) {
      elementCount++;

      if (element.type === 'text' || element.type === 'formula') {
        const fontSize = getNumberProperty(element, values, traces, 'size', 16);
        minFontSize = Math.min(minFontSize, fontSize);
        totalFontSize += fontSize;
        fontSizeCount++;
      }

      const w = getNumberProperty(element, values, traces, 'w', 0);
      const h = getNumberProperty(element, values, traces, 'h', 0);
      const area = w * h;
      if (area > 0) {
        minElementSize = Math.min(minElementSize, Math.min(w, h));
        totalArea += area;
      }

      if (element.children?.length) {
        processElements(element.children);
      }
    }
  }

  processElements(elements);

  return {
    minFontSize: minFontSize === Infinity ? MIN_FONT_SIZE : minFontSize,
    avgFontSize: fontSizeCount > 0 ? totalFontSize / fontSizeCount : 16,
    minElementSize: minElementSize === Infinity ? MIN_ELEMENT_SIZE : minElementSize,
    density: totalArea,
    elementCount,
  };
}

export function calculateReadabilityScore(metrics: ReadabilityMetrics, issues: ValidationIssue[] = []): number {
  let score = 100;

  if (metrics.minFontSize < MIN_FONT_SIZE) {
    score -= (MIN_FONT_SIZE - metrics.minFontSize) * 5;
  }

  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    score -= (MIN_ELEMENT_SIZE - metrics.minElementSize) * 2;
  }

  if (metrics.elementCount > 50) {
    score -= Math.min(10, (metrics.elementCount - 50) * 0.2);
  }

   for (const issue of issues) {
    if (issue.severity === 'error') score -= 12;
    else if (issue.severity === 'warning') score -= 6;
    else score -= 2;
  }

  return Math.max(0, Math.min(100, score));
}

async function buildValidationSnapshot(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ValidationSnapshot> {
  if (decl.type === 'DiagramDeclaration') {
    const diagram = decl as DiagramDeclaration;
    const width = readNumber(resolveValue(diagram.properties.width, values, traces), 1280);
    const height = readNumber(resolveValue(diagram.properties.height, values, traces), 720);
    const compiled = await compileSemanticDiagram(diagram.elements || [], values, traces, width, height);
    return {
      elements: compiled.elements,
      boxes: extractBoundingBoxes(compiled.elements, values, traces),
    };
  }

  if (decl.type === 'FlowDeclaration') {
    const layout = layoutFlow(decl as FlowDeclaration);
    const boxes = layout.nodes.map((node) => ({
      id: node.id,
      type: 'flow-node',
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
      width: node.width,
      height: node.height,
      allowOverlap: false,
    }));
    return { elements: [], boxes };
  }

  const elements = decl.elements || [];
  return { elements, boxes: extractBoundingBoxes(elements, values, traces) };
}

function collectValidationIssues(
  snapshot: ValidationSnapshot,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues = detectOverlaps(snapshot.boxes);
  issues.push(...detectOverflowIssues(snapshot.elements, values, traces));
  issues.push(...detectGapIssues(snapshot.elements, values, traces));
  issues.push(...detectConnectorCrossPanelIssues(snapshot.elements, snapshot.boxes, values, traces));
  issues.push(...detectMathFallbackIssues(snapshot.elements, values, traces));
  return dedupeIssues(issues);
}

function detectOverflowIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
  parentBox: BoundingBox | null = null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const element of elements) {
    const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
    const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
    const w = getNumberProperty(element, values, traces, 'w', 0);
    const h = getNumberProperty(element, values, traces, 'h', 0);
    const box: BoundingBox = { id: element.name, type: element.type, x, y, width: w, height: h, allowOverlap: false };
    if (parentBox && w > 0 && h > 0 && !OVERLAP_TYPES_ALLOWED.has(element.type)) {
      const overflow = overflowBounds(box, parentBox);
      if (overflow) {
        issues.push({
          kind: 'overflow',
          element1: { id: element.name, type: element.type },
          element2: { id: parentBox.id, type: parentBox.type },
          overlapArea: overflow.width * overflow.height,
          overlapPercentage: 0,
          severity: 'error',
          location: overflow,
          message: `Element "${element.name}" exceeds parent bounds "${parentBox.id}"`,
        });
      }
    }
    if (element.children?.length) {
      const nextParent = w > 0 && h > 0 ? box : parentBox;
      issues.push(...detectOverflowIssues(element.children, values, traces, x, y, nextParent));
    }
  }
  return issues;
}

function overflowBounds(box: BoundingBox, parentBox: BoundingBox): { x: number; y: number; width: number; height: number } | null {
  const overflowLeft = Math.max(0, parentBox.x - box.x);
  const overflowTop = Math.max(0, parentBox.y - box.y);
  const overflowRight = Math.max(0, box.x + box.width - (parentBox.x + parentBox.width));
  const overflowBottom = Math.max(0, box.y + box.height - (parentBox.y + parentBox.height));
  const overflowWidth = overflowLeft || overflowRight;
  const overflowHeight = overflowTop || overflowBottom;
  if (!overflowWidth && !overflowHeight) return null;
  return {
    x: box.x,
    y: box.y,
    width: Math.max(overflowWidth, 1),
    height: Math.max(overflowHeight, 1),
  };
}

function detectGapIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const element of elements) {
    const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
    const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
    if (element.children?.length) {
      const minGap = Math.max(MIN_LAYOUT_GAP, getNumberProperty(element, values, traces, 'min_gap', MIN_LAYOUT_GAP));
      const childBoxes = element.children
        .filter((child) => !OVERLAP_TYPES_ALLOWED.has(child.type) && !getBooleanProperty(child, values, traces, 'validation_ignore', false))
        .map((child) => absoluteBox(child, values, traces, x, y))
        .filter((box): box is BoundingBox => box !== null);
      issues.push(...detectSiblingGapIssues(childBoxes, minGap));
      issues.push(...detectAwkwardSpacingIssues(childBoxes, minGap));
      issues.push(...detectGapIssues(element.children, values, traces, x, y));
    }
  }
  return issues;
}

function detectSiblingGapIssues(boxes: BoundingBox[], minGap: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const gap = boxGap(boxes[i], boxes[j]);
      if (gap !== null && gap < minGap) {
        issues.push({
          kind: 'tight_gap',
          element1: { id: boxes[i].id, type: boxes[i].type },
          element2: { id: boxes[j].id, type: boxes[j].type },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: gap < Math.max(4, minGap / 2) ? 'error' : 'warning',
          location: {
            x: Math.min(boxes[i].x, boxes[j].x),
            y: Math.min(boxes[i].y, boxes[j].y),
            width: Math.abs((boxes[i].x + boxes[i].width / 2) - (boxes[j].x + boxes[j].width / 2)),
            height: Math.abs((boxes[i].y + boxes[i].height / 2) - (boxes[j].y + boxes[j].height / 2)),
          },
          message: `Gap between "${boxes[i].id}" and "${boxes[j].id}" is too small`,
        });
      }
    }
  }
  return issues;
}

function detectAwkwardSpacingIssues(boxes: BoundingBox[], minGap: number): ValidationIssue[] {
  const vertical = boxes
    .slice()
    .sort((a, b) => a.y - b.y)
    .filter((_box, index, list) => index < list.length - 1);
  const gaps = vertical
    .map((box, index) => verticalGap(box, boxes.slice().sort((a, b) => a.y - b.y)[index + 1]))
    .filter((gap): gap is number => gap !== null);
  if (gaps.length < 2) return [];
  const minObserved = Math.min(...gaps);
  const maxObserved = Math.max(...gaps);
  if (maxObserved <= Math.max(minGap * EXCESSIVE_GAP_MULTIPLIER, 56) || maxObserved <= minObserved * EXCESSIVE_GAP_MULTIPLIER) {
    return [];
  }
  return [{
    kind: 'awkward_spacing',
    element1: { id: vertical[0].id, type: vertical[0].type },
    element2: { id: vertical[vertical.length - 1].id, type: vertical[vertical.length - 1].type },
    overlapArea: 0,
    overlapPercentage: 0,
    severity: 'warning',
    location: {
      x: Math.min(...vertical.map((box) => box.x)),
      y: Math.min(...vertical.map((box) => box.y)),
      width: Math.max(...vertical.map((box) => box.x + box.width)) - Math.min(...vertical.map((box) => box.x)),
      height: Math.max(...vertical.map((box) => box.y + box.height)) - Math.min(...vertical.map((box) => box.y)),
    },
    message: 'Sibling spacing is inconsistent and visually awkward',
  }];
}

function detectConnectorCrossPanelIssues(
  elements: DiagramElement[],
  boxes: BoundingBox[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const segments = collectConnectorSegments(elements, values, traces);
  const panels = boxes.filter((box) => (box.type === 'panel' || box.type === 'box') && !box.validationIgnore);
  const issues: ValidationIssue[] = [];
  for (const segment of segments) {
    for (const panel of panels) {
      if (panel.id === segment.from || panel.id === segment.to) continue;
      if (segmentIntersectsPanel(segment, panel)) {
        issues.push({
          kind: 'connector_cross_panel',
          element1: { id: segment.id, type: 'connector-segment' },
          element2: { id: panel.id, type: panel.type },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: 'warning',
          location: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
          message: `Connector "${segment.id}" crosses panel "${panel.id}"`,
        });
      }
    }
  }
  return issues;
}

function detectMathFallbackIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const visit = (list: DiagramElement[]) => {
    for (const element of list) {
      if (getBooleanProperty(element, values, traces, 'math_fallback', false)) {
        const x = getNumberProperty(element, values, traces, 'x', 0);
        const y = getNumberProperty(element, values, traces, 'y', 0);
        const w = getNumberProperty(element, values, traces, 'w', 0);
        const h = getNumberProperty(element, values, traces, 'h', 0);
        issues.push({
          kind: 'math_fallback',
          element1: { id: element.name, type: element.type },
          element2: { id: element.name, type: element.type },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: 'warning',
          location: { x, y, width: w, height: h },
          message: `Math rendering for "${element.name}" fell back to plain text`,
        });
      }
      if (element.children?.length) visit(element.children);
    }
  };
  visit(elements);
  return issues;
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.kind}:${issue.element1.id}:${issue.element2.id}:${issue.location.x}:${issue.location.y}:${issue.location.width}:${issue.location.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function absoluteBox(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX: number,
  offsetY: number,
): BoundingBox | null {
  const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
  const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
  const w = getNumberProperty(element, values, traces, 'w', 0);
  const h = getNumberProperty(element, values, traces, 'h', 0);
  if (w <= 0 || h <= 0) return null;
  return {
    id: element.name,
    type: element.type,
    x,
    y,
    width: w,
    height: h,
    allowOverlap: false,
  };
}

function boxGap(a: BoundingBox, b: BoundingBox): number | null {
  const verticalOverlap = rangesOverlap(a.y, a.y + a.height, b.y, b.y + b.height);
  const horizontalOverlap = rangesOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
  if (verticalOverlap) {
    const gap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
    return gap;
  }
  if (horizontalOverlap) {
    const gap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
    return gap;
  }
  return null;
}

function verticalGap(a: BoundingBox, b: BoundingBox | undefined): number | null {
  if (!b) return null;
  if (!rangesOverlap(a.x, a.x + a.width, b.x, b.x + b.width)) return null;
  return Math.max(0, b.y - (a.y + a.height));
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.min(a2, b2) - Math.max(a1, b1) > 0;
}

function collectConnectorSegments(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
): Array<{ id: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string }> {
  const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string }> = [];
  for (const element of elements) {
    const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
    const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
    if ((element.type === 'line' || element.type === 'arrow') && getStringProperty(element, values, traces, 'connector_id', '')) {
      segments.push({
        id: getStringProperty(element, values, traces, 'connector_id', element.name),
        x1: x,
        y1: y,
        x2: offsetX + getNumberProperty(element, values, traces, 'x2', x),
        y2: offsetY + getNumberProperty(element, values, traces, 'y2', y),
        from: getStringProperty(element, values, traces, 'connector_from', ''),
        to: getStringProperty(element, values, traces, 'connector_to', ''),
      });
    }
    if (element.children?.length) {
      segments.push(...collectConnectorSegments(element.children, values, traces, x, y));
    }
  }
  return segments;
}

function segmentIntersectsPanel(
  segment: { x1: number; y1: number; x2: number; y2: number },
  panel: BoundingBox,
): boolean {
  const minX = Math.min(segment.x1, segment.x2);
  const maxX = Math.max(segment.x1, segment.x2);
  const minY = Math.min(segment.y1, segment.y2);
  const maxY = Math.max(segment.y1, segment.y2);
  const inset = 2;
  const left = panel.x + inset;
  const right = panel.x + panel.width - inset;
  const top = panel.y + inset;
  const bottom = panel.y + panel.height - inset;

  if (segment.y1 === segment.y2) {
    return segment.y1 > top && segment.y1 < bottom && maxX > left && minX < right;
  }
  if (segment.x1 === segment.x2) {
    return segment.x1 > left && segment.x1 < right && maxY > top && minY < bottom;
  }
  return false;
}

function getRelayoutStrategy(attempt: number): RelayoutStrategy {
  const strategies: RelayoutStrategy[] = [
    { type: 'spacing', factor: 1.1 },
    { type: 'spacing', factor: 1.2 },
    { type: 'scaling', factor: 0.95 },
    { type: 'spacing', factor: 1.3 },
    { type: 'scaling', factor: 0.9 },
  ];

  return strategies[Math.min(attempt, strategies.length - 1)];
}

function applySpacingToElement(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  factor: number,
  centerX: number,
  centerY: number
): DiagramElement {
  const x = getNumberProperty(element, values, traces, 'x', 0);
  const y = getNumberProperty(element, values, traces, 'y', 0);

  const newX = centerX + (x - centerX) * factor;
  const newY = centerY + (y - centerY) * factor;

  const newProperties = { ...element.properties };
  newProperties.x = { type: 'Literal', value: newX, location: ZERO_LOC };
  newProperties.y = { type: 'Literal', value: newY, location: ZERO_LOC };

  const result: DiagramElement = {
    ...element,
    properties: newProperties,
  };

  if (element.children?.length) {
    result.children = element.children.map((child) =>
      applySpacingToElement(child, values, traces, factor, 0, 0)
    );
  }

  return result;
}

function applyScalingToElement(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  factor: number
): DiagramElement {
  const w = getNumberProperty(element, values, traces, 'w', 0);
  const h = getNumberProperty(element, values, traces, 'h', 0);

  const newW = w * factor;
  const newH = h * factor;

  const newProperties = { ...element.properties };
  if (w > 0) newProperties.w = { type: 'Literal', value: newW, location: ZERO_LOC };
  if (h > 0) newProperties.h = { type: 'Literal', value: newH, location: ZERO_LOC };

  const fontSize = getNumberProperty(element, values, traces, 'size', 16);
  if (fontSize !== 16 && (element.type === 'text' || element.type === 'formula')) {
    newProperties.size = { type: 'Literal', value: fontSize * factor, location: ZERO_LOC };
  }

  const result: DiagramElement = {
    ...element,
    properties: newProperties,
  };

  if (element.children?.length) {
    result.children = element.children.map((child) =>
      applyScalingToElement(child, values, traces, factor)
    );
  }

  return result;
}

const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

function adjustFlowDeclaration(decl: any, strategy: RelayoutStrategy): any {
  const newProperties = { ...decl.properties };

  if (strategy.type === 'spacing') {
    const currentWidth = getNumberFromExpr(newProperties.target_width, 1400);
    const currentHeight = getNumberFromExpr(newProperties.target_height, 860);

    newProperties.target_width = { type: 'Literal', value: currentWidth * strategy.factor, location: ZERO_LOC };
    newProperties.target_height = { type: 'Literal', value: currentHeight * strategy.factor, location: ZERO_LOC };
  }

  return { ...decl, properties: newProperties };
}

function getNumberFromExpr(expr: any, fallback: number): number {
  if (!expr) return fallback;
  if (expr.type === 'Literal' && typeof expr.value === 'number') return expr.value;
  return fallback;
}

function setLiteralProperty(properties: Record<string, any>, key: string, value: number | string | boolean): void {
  properties[key] = { type: 'Literal', value, location: ZERO_LOC };
}

function adjustSemanticDiagramDeclaration(decl: any, strategy: RelayoutStrategy, attempt: number): any {
  const newProperties = { ...decl.properties };
  const currentWidth = getNumberFromExpr(newProperties.width, 1280);
  const currentHeight = getNumberFromExpr(newProperties.height, 720);
  if (strategy.type === 'spacing') {
    setLiteralProperty(newProperties, 'height', currentHeight * Math.max(strategy.factor, 1.08));
    if (attempt >= 2) setLiteralProperty(newProperties, 'width', currentWidth * 1.06);
  }

  const adjustedElements = (decl.elements || []).map((element: DiagramElement) =>
    adjustSemanticElement(element, strategy, attempt),
  );

  const laneElements = adjustedElements.filter((element: DiagramElement) => element.type === 'lane');
  if (attempt >= 2 && laneElements.length === 2) {
    const rightLane = laneElements[laneElements.length - 1];
    const leftLane = laneElements[0];
    const rightRatio = getNumberFromExpr(rightLane.properties.ratio, 1);
    const leftRatio = getNumberFromExpr(leftLane.properties.ratio, 1);
    setLiteralProperty(rightLane.properties, 'ratio', rightRatio * 1.05);
    setLiteralProperty(leftLane.properties, 'ratio', Math.max(0.25, leftRatio * 0.98));
  }

  return { ...decl, properties: newProperties, elements: adjustedElements };
}

function adjustSemanticElement(element: DiagramElement, strategy: RelayoutStrategy, attempt: number): DiagramElement {
  const properties = { ...element.properties };
  if (strategy.type === 'spacing') {
    if (element.type === 'lane') {
      const gapX = getNumberFromExpr(properties.gap_x, getNumberFromExpr(properties.gap, MIN_LAYOUT_GAP));
      const gapY = getNumberFromExpr(properties.gap_y, getNumberFromExpr(properties.gap, MIN_LAYOUT_GAP));
      const padding = getNumberFromExpr(properties.padding, 22);
      setLiteralProperty(properties, 'gap_x', gapX * strategy.factor);
      setLiteralProperty(properties, 'gap_y', gapY * strategy.factor);
      setLiteralProperty(properties, 'padding', padding * Math.min(strategy.factor, 1.18));
    }
    if (element.type === 'card' || element.type === 'group') {
      const gap = getNumberFromExpr(properties.gap, MIN_LAYOUT_GAP);
      const padding = getNumberFromExpr(properties.padding, element.type === 'card' ? 22 : 0);
      const minH = getNumberFromExpr(properties.min_h, 0);
      setLiteralProperty(properties, 'gap', gap * strategy.factor);
      if (padding > 0) setLiteralProperty(properties, 'padding', padding * Math.min(strategy.factor, 1.15));
      if (minH > 0) setLiteralProperty(properties, 'min_h', minH * Math.min(strategy.factor, 1.12));
    }
    if (element.type === 'header' || element.type === 'separator') {
      const gap = getNumberFromExpr(properties.gap, MIN_LAYOUT_GAP);
      setLiteralProperty(properties, 'gap', gap * Math.min(strategy.factor, 1.15));
    }
    if (element.type === 'connector' && attempt >= 3) {
      setLiteralProperty(properties, 'route', 'hvh');
    }
  }

  if (strategy.type === 'scaling' && element.type === 'image') {
    const w = getNumberFromExpr(properties.w, 0);
    const h = getNumberFromExpr(properties.h, 0);
    if (w > 0) setLiteralProperty(properties, 'w', w * strategy.factor);
    if (h > 0) setLiteralProperty(properties, 'h', h * strategy.factor);
  }

  const result: DiagramElement = { ...element, properties };
  if (element.children?.length) {
    result.children = element.children.map((child) => adjustSemanticElement(child, strategy, attempt));
  }
  return result;
}

export function attemptRelayout(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  attempt: number
): { success: boolean; adjustedDecl: any } {
  const strategy = getRelayoutStrategy(attempt);

  if (decl.type === 'FlowDeclaration') {
    return {
      success: true,
      adjustedDecl: adjustFlowDeclaration(decl, strategy),
    };
  }

  if (decl.type === 'DiagramDeclaration' && Array.isArray(decl.elements) && decl.elements.some((element: DiagramElement) => ['header', 'separator', 'lane', 'card', 'connector', 'loop_label'].includes(element.type))) {
    return {
      success: true,
      adjustedDecl: adjustSemanticDiagramDeclaration(decl, strategy, attempt),
    };
  }

  if (!decl.elements || !Array.isArray(decl.elements)) {
    return { success: false, adjustedDecl: decl };
  }

  let centerX = 0;
  let centerY = 0;
  let count = 0;

  for (const element of decl.elements) {
    const x = getNumberProperty(element, values, traces, 'x', 0);
    const y = getNumberProperty(element, values, traces, 'y', 0);
    centerX += x;
    centerY += y;
    count++;
  }

  centerX = count > 0 ? centerX / count : 0;
  centerY = count > 0 ? centerY / count : 0;

  let adjustedElements: DiagramElement[];

  if (strategy.type === 'spacing') {
    adjustedElements = decl.elements.map((element: DiagramElement) =>
      applySpacingToElement(element, values, traces, strategy.factor, centerX, centerY)
    );
  } else if (strategy.type === 'scaling') {
    adjustedElements = decl.elements.map((element: DiagramElement) =>
      applyScalingToElement(element, values, traces, strategy.factor)
    );
  } else {
    adjustedElements = decl.elements;
  }

  const adjustedDecl = {
    ...decl,
    elements: adjustedElements,
  };

  return { success: true, adjustedDecl };
}

export function generateReport(
  attempts: number,
  issues: ValidationIssue[],
  metrics: ReadabilityMetrics,
  success: boolean,
  declName: string,
  declType: string
): ValidationReport {
  const suggestions: string[] = [];

  if (!success) {
    suggestions.push('Consider increasing canvas dimensions');
    suggestions.push('Reduce the number of elements or simplify the layout');
    suggestions.push('Use allow_overlap: true only for intentional overlaps');
  }

  if (metrics.minFontSize < MIN_FONT_SIZE) {
    suggestions.push(`Increase minimum font size to at least ${MIN_FONT_SIZE}px`);
  }

  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    suggestions.push(`Increase minimum element size to at least ${MIN_ELEMENT_SIZE}px`);
  }

  if (metrics.elementCount > 50) {
    suggestions.push('Consider splitting into multiple diagrams for better readability');
  }

  if (issues.some((issue) => issue.kind === 'math_fallback')) {
    suggestions.push('Use explicit TeX or supported shorthand for formulas that fell back to plain text');
  }

  if (issues.some((issue) => issue.kind === 'tight_gap' || issue.kind === 'awkward_spacing')) {
    suggestions.push('Increase card, lane, or child gap settings to improve readability');
  }

  return {
    timestamp: new Date().toISOString(),
    file: '',
    declaration: declName,
    declarationType: declType,
    attempts,
    success,
    readabilityScore: calculateReadabilityScore(metrics, issues),
    issues: issues.map((i) => ({
      kind: i.kind,
      severity: i.severity,
      element1: i.element1.id,
      element2: i.element2.id,
      overlapArea: i.overlapArea,
      overlapPercentage: i.overlapPercentage,
      location: i.location,
      message: i.message,
    })),
    metrics: {
      minFontSize: Math.round(metrics.minFontSize * 10) / 10,
      avgFontSize: Math.round(metrics.avgFontSize * 10) / 10,
      minElementSize: Math.round(metrics.minElementSize * 10) / 10,
      density: Math.round(metrics.density),
      elementCount: metrics.elementCount,
    },
    suggestions,
  };
}

export function writeValidationReport(
  report: ValidationReport,
  filePath: string,
  declarationName: string
): void {
  const finalReport = {
    ...report,
    declaration: declarationName,
  };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(finalReport, null, 2), 'utf-8');
}

export async function validateAndAdjust(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  maxRetries = MAX_RETRIES
): Promise<{
  adjustedDecl: any;
  validation: ValidationResult;
  report: ValidationReport;
}> {
  const declType = decl.type || 'Unknown';
  const declName = decl.name || 'unnamed';

  if (!needsRelayout(declType)) {
    const snapshot = await buildValidationSnapshot(decl, values, traces);
    const metrics = calculateReadability(snapshot.elements, values, traces);
    const issues = collectValidationIssues(snapshot, values, traces);
    const score = calculateReadabilityScore(metrics, issues);

    return {
      adjustedDecl: decl,
      validation: {
        valid: !issues.some((issue) => issue.severity === 'error' || issue.severity === 'warning'),
        issues,
        readabilityScore: score,
      },
      report: generateReport(0, issues, metrics, !issues.some((issue) => issue.severity === 'error' || issue.severity === 'warning'), declName, declType),
    };
  }

  let currentDecl = decl;
  let attempt = 0;
  let lastIssues: ValidationIssue[] = [];

  while (attempt <= maxRetries) {
    const snapshot = await buildValidationSnapshot(currentDecl, values, traces);
    if (snapshot.elements.length === 0 && snapshot.boxes.length === 0) {
      const metrics = calculateReadability([], values, traces);
      return {
        adjustedDecl: currentDecl,
        validation: { valid: true, issues: [], readabilityScore: 100 },
        report: generateReport(attempt, [], metrics, true, declName, declType),
      };
    }

    const issues = collectValidationIssues(snapshot, values, traces);
    lastIssues = issues;

    const metrics = calculateReadability(snapshot.elements, values, traces);
    const hasErrors = issues.some((i) => i.severity === 'error');
    const hasWarnings = issues.some((i) => i.severity === 'warning');

    if (!hasErrors && !hasWarnings) {
      return {
        adjustedDecl: currentDecl,
        validation: {
          valid: true,
          issues,
          readabilityScore: calculateReadabilityScore(metrics, issues),
        },
        report: generateReport(attempt, issues, metrics, true, declName, declType),
      };
    }

    if (attempt >= maxRetries) break;

    const { success, adjustedDecl } = attemptRelayout(currentDecl, values, traces, attempt);

    if (!success) break;

    currentDecl = adjustedDecl;
    attempt++;
  }

  const finalSnapshot = await buildValidationSnapshot(currentDecl, values, traces);
  const finalMetrics = calculateReadability(finalSnapshot.elements, values, traces);

  return {
    adjustedDecl: currentDecl,
    validation: {
      valid: false,
      issues: lastIssues,
      readabilityScore: calculateReadabilityScore(finalMetrics, lastIssues),
    },
    report: generateReport(attempt, lastIssues, finalMetrics, false, declName, declType),
  };
}

export async function validateDiagram(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>
): Promise<ValidationResult> {
  const snapshot = await buildValidationSnapshot(decl, values, traces);
  if (snapshot.elements.length === 0 && snapshot.boxes.length === 0) {
    return { valid: true, issues: [], readabilityScore: 100 };
  }

  const issues = collectValidationIssues(snapshot, values, traces);
  const metrics = calculateReadability(snapshot.elements, values, traces);

  const hasErrors = issues.some((i) => i.severity === 'error' || i.severity === 'warning');

  return {
    valid: !hasErrors,
    issues,
    readabilityScore: calculateReadabilityScore(metrics, issues),
  };
}
