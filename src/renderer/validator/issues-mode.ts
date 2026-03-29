import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { readNumber, resolveValue } from '../common';
import {
  hasExplicitProperty,
  readRendererLayoutMode,
  readRendererSizeModeWithLegacyFixed,
} from '../readability-policy';
import { OVERFLOW_TOLERANCE, ValidationIssue, ValidationSnapshot } from './types';

export function detectManualCoordinateModeIssues(
  snapshot: ValidationSnapshot,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const decl = snapshot.decl;
  if (!decl || (decl.type !== 'DiagramDeclaration' && decl.type !== 'InfraDeclaration')) return [];
  const layoutMode = readRendererLayoutMode(decl.properties?.layout_mode, values, traces, 'dynamic');
  if (layoutMode !== 'dynamic') return [];

  const explicitCoordinateElement = collectCoordinateElements(decl.elements ?? [])[0];
  if (!explicitCoordinateElement) return [];

  return [{
    kind: 'manual_coordinates_in_dynamic_mode',
    element1: { id: explicitCoordinateElement.name, type: explicitCoordinateElement.type },
    element2: { id: decl.name ?? 'root', type: decl.type },
    overlapArea: 0,
    overlapPercentage: 0,
    severity: 'warning',
    location: resolveSourceLocation(explicitCoordinateElement, values, traces),
    message: `Element "${explicitCoordinateElement.name}" still defines manual coordinates while renderer default is dynamic.`,
  }];
}

export function detectHardConstraintOverflowIssues(
  snapshot: ValidationSnapshot,
  existingIssues: ValidationIssue[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const decl = snapshot.decl;
  if (!decl || !decl.properties) return [];
  const hasHardConstraint = hasExplicitProperty(decl.properties.width)
    || hasExplicitProperty(decl.properties.height)
    || hasExplicitProperty(decl.properties.margin)
    || hasExplicitProperty(decl.properties.padding)
    || hasExplicitProperty(decl.properties.gap)
    || readRendererSizeModeWithLegacyFixed(decl.properties.size_mode, decl.properties.fixed_canvas, values, traces, 'dynamic') === 'fixed';
  if (!hasHardConstraint) return [];

  const blocking = existingIssues.find((issue) =>
    issue.kind === 'overflow'
    || issue.kind === 'embed_too_small'
    || issue.kind === 'dense_panel'
    || issue.kind === 'canvas_overflow_clipping');
  if (!blocking) return [];

  return [{
    kind: 'hard_constraint_overflow',
    element1: blocking.element1,
    element2: { id: decl.name ?? 'root', type: decl.type },
    overlapArea: blocking.overlapArea,
    overlapPercentage: blocking.overlapPercentage,
    severity: 'error',
    location: blocking.location,
    message: 'Explicit size or spacing constraints are forcing unreadable overflow. Relax the hard constraint or switch to fixed/manual intentionally.',
  }];
}

export function detectCanvasOverflowClippingIssues(snapshot: ValidationSnapshot): ValidationIssue[] {
  const canvas = snapshot.canvas;
  if (!canvas) return [];

  return snapshot.boxes.flatMap((box) => {
    if (box.type === 'text' || box.type === 'formula') return [];
    const overflowLeft = Math.max(0, -box.x);
    const overflowTop = Math.max(0, -box.y);
    const overflowRight = Math.max(0, box.x + box.width - canvas.width);
    const overflowBottom = Math.max(0, box.y + box.height - canvas.height);
    if (
      overflowLeft <= OVERFLOW_TOLERANCE
      && overflowTop <= OVERFLOW_TOLERANCE
      && overflowRight <= OVERFLOW_TOLERANCE
      && overflowBottom <= OVERFLOW_TOLERANCE
    ) {
      return [];
    }

    return [{
      kind: 'canvas_overflow_clipping',
      element1: { id: box.id, type: box.type },
      element2: { id: snapshot.decl?.name ?? 'canvas', type: snapshot.decl?.type ?? 'canvas' },
      overlapArea: Math.round((overflowLeft + overflowRight) * Math.max(box.height, 1) + (overflowTop + overflowBottom) * Math.max(box.width, 1)),
      overlapPercentage: 0,
      severity: 'error',
      location: {
        x: Math.max(0, Math.min(box.x, canvas.width)),
        y: Math.max(0, Math.min(box.y, canvas.height)),
        width: Math.max(1, overflowLeft + overflowRight),
        height: Math.max(1, overflowTop + overflowBottom),
      },
      message: `Element "${box.id}" exceeds the final canvas and will be clipped.`,
    }];
  });
}

function collectCoordinateElements(elements: DiagramElement[]): DiagramElement[] {
  const collected: DiagramElement[] = [];
  for (const element of elements) {
    if (element.properties.x != null || element.properties.y != null || element.properties.x2 != null || element.properties.y2 != null) {
      collected.push(element);
    }
    if (element.children?.length) collected.push(...collectCoordinateElements(element.children));
  }
  return collected;
}

function resolveSourceLocation(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): { x: number; y: number; width: number; height: number } {
  return {
    x: readNumber(resolveValue(element.properties.x, values, traces), 0),
    y: readNumber(resolveValue(element.properties.y, values, traces), 0),
    width: readNumber(resolveValue(element.properties.w, values, traces), 1),
    height: readNumber(resolveValue(element.properties.h, values, traces), 1),
  };
}
