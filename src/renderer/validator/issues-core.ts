import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { BoundingBox, ValidationIssue, ValidationSnapshot, MIN_LAYOUT_GAP, EXCESSIVE_GAP_MULTIPLIER } from './types';
import { getBooleanProperty, getNumberProperty, getStringProperty, resolveElementBox, boxGap, verticalGap } from './helpers';
import { detectOverlaps } from './detection';

const OVERLAP_TYPES_ALLOWED = new Set(['line', 'arrow', 'connector', 'embed']);
const BOX_LIKE_TYPES = new Set(['panel', 'box', 'callout', 'badge']);

export function collectCoreValidationIssues(
  snapshot: ValidationSnapshot,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues = detectOverlaps(snapshot.boxes);
  issues.push(...detectOverflowIssues(snapshot.elements, values, traces));
  issues.push(...detectGapIssues(snapshot.elements, values, traces));
  return issues;
}

export function detectOverflowIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
  parentBox: BoundingBox | null = null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const element of elements) {
    const box = resolveElementBox(element, values, traces, offsetX, offsetY);
    if (parentBox && box && !OVERLAP_TYPES_ALLOWED.has(element.type)) {
      const overflow = overflowBounds(box, parentBox);
      if (overflow) {
        const overflowArea = overflow.width * overflow.height;
        const parentArea = parentBox.width * parentBox.height;
        const overflowPercent = parentArea > 0 ? (overflowArea / parentArea) * 100 : 0;
        issues.push({
          kind: 'overflow',
          element1: { id: element.name, type: element.type },
          element2: { id: parentBox.id, type: parentBox.type },
          overlapArea: overflowArea,
          overlapPercentage: overflowPercent,
          severity: overflowPercent > 15 ? 'error' : 'warning',
          location: overflow,
          message: `Element "${element.name}" exceeds parent bounds "${parentBox.id}"`,
        });
      }
    }
    if (element.children?.length) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      const nextParent = box ?? parentBox;
      issues.push(...detectOverflowIssues(element.children, values, traces, childOffsetX, childOffsetY, nextParent));
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
  const OVERFLOW_TOLERANCE = 3;
  if (overflowWidth <= OVERFLOW_TOLERANCE && overflowHeight <= OVERFLOW_TOLERANCE) return null;
  return {
    x: box.x,
    y: box.y,
    width: Math.max(overflowWidth, 1),
    height: Math.max(overflowHeight, 1),
  };
}

export function detectGapIssues(
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
      const hasExplicitGap = element.properties.min_gap != null;
      const semanticRole = getStringProperty(element, values, traces, 'semantic_role', '');
      const minGap = Math.max(MIN_LAYOUT_GAP, getNumberProperty(element, values, traces, 'min_gap', MIN_LAYOUT_GAP));
      const childBoxes = element.children
        .filter((child) => !OVERLAP_TYPES_ALLOWED.has(child.type) && !getBooleanProperty(child, values, traces, 'validation_ignore', false))
        .map((child) => absoluteBox(child, values, traces, x, y))
        .filter((box): box is BoundingBox => box !== null);
      const shouldCheckSiblingGaps = hasExplicitGap || !!semanticRole || !BOX_LIKE_TYPES.has(element.type);
      if (shouldCheckSiblingGaps) {
        issues.push(...detectSiblingGapIssues(childBoxes, minGap));
        issues.push(...detectAwkwardSpacingIssues(childBoxes, minGap));
      }
      issues.push(...detectGapIssues(element.children, values, traces, x, y));
    }
  }
  return issues;
}

function absoluteBox(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX: number,
  offsetY: number,
): BoundingBox | null {
  return resolveElementBox(element, values, traces, offsetX, offsetY);
}

export function detectSiblingGapIssues(boxes: BoundingBox[], minGap: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const gap = boxGap(boxes[i], boxes[j]);
      if (gap !== null && gap + 0.5 < minGap) {
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

export function detectAwkwardSpacingIssues(boxes: BoundingBox[], minGap: number): ValidationIssue[] {
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
