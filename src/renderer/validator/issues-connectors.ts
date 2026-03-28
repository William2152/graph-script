import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { BoundingBox, ValidationIssue, CONNECTOR_TRACK_MIN_GAP } from './types';
import { getNumberProperty, getStringProperty } from './helpers';

export function detectConnectorCrossPanelIssues(
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

export function detectConnectorCrowdingIssues(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const segments = collectConnectorSegments(elements, values, traces)
    .filter((segment) => segment.role === 'connector_segment');
  const issues: ValidationIssue[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
      const first = segments[index];
      const second = segments[otherIndex];
      if (first.id === second.id) continue;

      const crowded = connectorCrowdingLocation(first, second);
      if (!crowded) continue;

      const roundedDelta = Math.round(crowded.delta * 10) / 10;
      issues.push({
        kind: 'connector_crowding',
        element1: { id: first.id, type: 'connector' },
        element2: { id: second.id, type: 'connector' },
        overlapArea: 0,
        overlapPercentage: 0,
        severity: 'error',
        location: crowded.location,
        message: crowded.delta < 1
          ? `Semantic connectors "${first.id}" and "${second.id}" share the same corridor and must be rerouted`
          : `Semantic connectors "${first.id}" and "${second.id}" run only ${roundedDelta}px apart and must be separated by at least ${CONNECTOR_TRACK_MIN_GAP}px`,
      });
    }
  }

  return issues;
}

function collectConnectorSegments(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
): Array<{ id: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string; role: string }> {
  const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string; role: string }> = [];
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
        role: getStringProperty(element, values, traces, 'semantic_role', ''),
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

function connectorCrowdingLocation(
  first: { x1: number; y1: number; x2: number; y2: number },
  second: { x1: number; y1: number; x2: number; y2: number },
): { delta: number; location: { x: number; y: number; width: number; height: number } } | null {
  if (first.x1 === first.x2 && second.x1 === second.x2) {
    const overlapStart = Math.max(Math.min(first.y1, first.y2), Math.min(second.y1, second.y2));
    const overlapEnd = Math.min(Math.max(first.y1, first.y2), Math.max(second.y1, second.y2));
    const overlapLength = overlapEnd - overlapStart;
    const delta = Math.abs(first.x1 - second.x1);
    if (overlapLength <= 0 || delta + 0.1 >= CONNECTOR_TRACK_MIN_GAP) return null;
    return {
      delta,
      location: {
        x: Math.min(first.x1, second.x1),
        y: overlapStart,
        width: Math.max(1, delta),
        height: overlapLength,
      },
    };
  }

  if (first.y1 === first.y2 && second.y1 === second.y2) {
    const overlapStart = Math.max(Math.min(first.x1, first.x2), Math.min(second.x1, second.x2));
    const overlapEnd = Math.min(Math.max(first.x1, first.x2), Math.max(second.x1, second.x2));
    const overlapLength = overlapEnd - overlapStart;
    const delta = Math.abs(first.y1 - second.y1);
    if (overlapLength <= 0 || delta + 0.1 >= CONNECTOR_TRACK_MIN_GAP) return null;
    return {
      delta,
      location: {
        x: overlapStart,
        y: Math.min(first.y1, second.y1),
        width: overlapLength,
        height: Math.max(1, delta),
      },
    };
  }

  return null;
}
