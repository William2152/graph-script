import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { READABILITY_POLICY } from '../readability-policy';
import { BoundingBox, ValidationIssue } from './types';
import { getBooleanProperty, getNumberProperty, getStringProperty, resolveElementBox, unionLocation } from './helpers';

const BOX_LIKE_TYPES = new Set(['panel', 'box', 'callout', 'badge']);

export function detectEmbedScaleIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const visit = (element: DiagramElement, offsetX: number, offsetY: number): void => {
    if (element.type === 'embed') {
      const scale = getNumberProperty(element, values, traces, 'scale', 1);
      const minScale = getNumberProperty(element, values, traces, 'min_scale', READABILITY_POLICY.minEmbedScale);
      const box = resolveElementBox(element, values, traces, offsetX, offsetY);
      if (scale + 1e-6 < minScale && box) {
        issues.push({
          kind: 'embed_too_small',
          element1: { id: element.name, type: element.type },
          element2: { id: getStringTarget(element, values, traces), type: 'embed-target' },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: 'warning',
          location: { x: box.x, y: box.y, width: box.width, height: box.height },
          message: `Embedded content "${getStringTarget(element, values, traces)}" is rendered below the readable minimum scale`,
        });
      }
    }

    if (element.children?.length) {
      const nextOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const nextOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      element.children.forEach((child) => visit(child, nextOffsetX, nextOffsetY));
    }
  };

  elements.forEach((element) => visit(element, 0, 0));
  return issues;
}

export function detectExcessiveEmptySpaceIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const element of elements) {
    const box = resolveElementBox(element, values, traces, offsetX, offsetY);
    const role = getStringProperty(element, values, traces, 'semantic_role', '');
    if (box && BOX_LIKE_TYPES.has(element.type) && element.children?.length && (!role || role === 'page_cell')) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      const childBoxes = element.children
        .filter((child) => !getBooleanProperty(child, values, traces, 'validation_ignore', false))
        .map((child) => resolveElementBox(child, values, traces, childOffsetX, childOffsetY))
        .filter((childBox): childBox is BoundingBox => childBox !== null);

      if (childBoxes.length && (box.height >= 160 || childBoxes.length >= 3)) {
        const used = boundsUnion(childBoxes);
        const usedAreaRatio = (used.width * used.height) / Math.max(box.width * box.height, 1);
        const usedHeightRatio = used.height / Math.max(box.height, 1);
        if (usedAreaRatio < 0.42 && usedHeightRatio < 0.6) {
          issues.push({
            kind: 'excessive_empty_space',
            element1: { id: element.name, type: element.type },
            element2: { id: element.name, type: element.type },
            overlapArea: Math.round((box.width * box.height) - (used.width * used.height)),
            overlapPercentage: Math.round((1 - usedAreaRatio) * 1000) / 10,
            severity: 'warning',
            location: { x: box.x, y: box.y, width: box.width, height: box.height },
            message: `Container "${element.name}" has excessive unused interior space`,
          });
        }
      }
    }

    if (element.children?.length) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      issues.push(...detectExcessiveEmptySpaceIssues(element.children, values, traces, childOffsetX, childOffsetY));
    }
  }

  return issues;
}

export function detectMisalignedSiblingIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const siblings = elements
    .map((element) => ({ element, box: resolveElementBox(element, values, traces, offsetX, offsetY) }))
    .filter((entry): entry is { element: DiagramElement; box: BoundingBox } =>
      entry.box !== null
      && BOX_LIKE_TYPES.has(entry.element.type)
      && !getBooleanProperty(entry.element, values, traces, 'validation_ignore', false)
      && getStringProperty(entry.element, values, traces, 'semantic_role', '') !== 'decorative');

  for (let i = 0; i < siblings.length; i += 1) {
    for (let j = i + 1; j < siblings.length; j += 1) {
      const a = siblings[i];
      const b = siblings[j];
      const sameRow = overlapLength(a.box.y, a.box.y + a.box.height, b.box.y, b.box.y + b.box.height) > 24;
      const sameColumn = overlapLength(a.box.x, a.box.x + a.box.width, b.box.x, b.box.x + b.box.width) > 24;
      const yDelta = Math.abs(a.box.y - b.box.y);
      const xDelta = Math.abs(a.box.x - b.box.x);

      if (sameRow && yDelta > 2 && yDelta <= READABILITY_POLICY.alignmentSnapTolerance) {
        issues.push({
          kind: 'misaligned_siblings',
          element1: { id: a.element.name, type: a.element.type },
          element2: { id: b.element.name, type: b.element.type },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: 'warning',
          location: unionLocation(a.box, b.box),
          message: `Sibling containers "${a.element.name}" and "${b.element.name}" are close to the same row but not properly aligned`,
        });
      } else if (sameColumn && xDelta > 2 && xDelta <= READABILITY_POLICY.alignmentSnapTolerance) {
        issues.push({
          kind: 'misaligned_siblings',
          element1: { id: a.element.name, type: a.element.type },
          element2: { id: b.element.name, type: b.element.type },
          overlapArea: 0,
          overlapPercentage: 0,
          severity: 'warning',
          location: unionLocation(a.box, b.box),
          message: `Sibling containers "${a.element.name}" and "${b.element.name}" are close to the same column but not properly aligned`,
        });
      }
    }
  }

  for (const element of elements) {
    if (element.children?.length) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      issues.push(...detectMisalignedSiblingIssues(element.children, values, traces, childOffsetX, childOffsetY));
    }
  }

  return issues;
}

function overlapLength(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function boundsUnion(boxes: BoundingBox[]): { x: number; y: number; width: number; height: number } {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function getStringTarget(
  element: DiagramElement,
  _values: Record<string, GSValue>,
  _traces: Map<string, Trace>,
): string {
  const target = element.properties.target;
  if (!target) return element.name;
  const literal = (target as { type?: string; value?: unknown }).type === 'Literal' ? (target as { value?: unknown }).value : undefined;
  if (typeof literal === 'string') return literal;
  return element.name;
}
