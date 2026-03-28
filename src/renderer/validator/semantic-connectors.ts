import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { BoundingBox, SemanticRoleEntry, ValidationIssue } from './types';
import { boxGap, getNumberProperty, getStringProperty, unionLocation } from './helpers';
import { calculateOverlap } from './detection';

/**
 * Semantic connector-label crowding checks.
 */
export function detectConnectorLabelCrowdingIssues(
  entries: SemanticRoleEntry[],
  boxes: BoundingBox[],
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const labels = entries.filter((entry) => entry.role === 'connector_label' && entry.box);
  const panels = boxes.filter((box) => (box.type === 'panel' || box.type === 'box') && !box.validationIgnore);
  const segments = collectConnectorSegments(elements, values, traces);

  for (const label of labels) {
    const labelBox = label.box!;
    if (label.unplaced) {
      issues.push({
        kind: 'connector_label_crowding',
        element1: { id: label.id, type: label.type },
        element2: { id: label.connectorFrom || label.connectorTo || label.id, type: 'connector' },
        overlapArea: 0,
        overlapPercentage: 0,
        severity: 'error',
        location: { x: labelBox.x, y: labelBox.y, width: labelBox.width, height: labelBox.height },
        message: `Connector label "${label.id}" could not be placed without overlapping other content`,
      });
      continue;
    }

    for (const panel of panels) {
      const overlap = calculateOverlap(labelBox, panel);
      const gap = boxGap(labelBox, panel);
      if (overlap.area <= 0 && (gap === null || gap >= 12)) continue;
      issues.push({
        kind: 'connector_label_crowding',
        element1: { id: label.id, type: label.type },
        element2: { id: panel.id, type: panel.type },
        overlapArea: Math.round(overlap.area),
        overlapPercentage: Math.round(overlap.percentage * 10) / 10,
        severity: overlap.area > 0 ? 'error' : 'warning',
        location: unionLocation(labelBox, panel),
        message: overlap.area > 0
          ? `Connector label "${label.id}" overlaps panel "${panel.id}"`
          : `Connector label "${label.id}" is too close to panel "${panel.id}"`,
      });
    }

    for (const segment of segments) {
      const overlap = segmentHitsBox(segment, labelBox, 0);
      const crowded = overlap || segmentHitsBox(segment, labelBox, 10);
      if (!crowded) continue;

      issues.push({
        kind: 'connector_label_crowding',
        element1: { id: label.id, type: label.type },
        element2: { id: segment.id, type: 'connector-segment' },
        overlapArea: 0,
        overlapPercentage: 0,
        severity: overlap ? 'error' : 'warning',
        location: unionLocation(labelBox, connectorSegmentBox(segment)),
        message: overlap
          ? `Connector label "${label.id}" overlaps connector segment "${segment.id}"`
          : `Connector label "${label.id}" is too close to connector segment "${segment.id}"`,
      });
    }
  }

  for (let index = 0; index < labels.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < labels.length; otherIndex += 1) {
      const first = labels[index].box!;
      const second = labels[otherIndex].box!;
      const overlap = calculateOverlap(first, second);
      const gap = boxGap(first, second);
      if (overlap.area <= 0 && (gap === null || gap >= 10)) continue;
      issues.push({
        kind: 'connector_label_crowding',
        element1: { id: labels[index].id, type: labels[index].type },
        element2: { id: labels[otherIndex].id, type: labels[otherIndex].type },
        overlapArea: Math.round(overlap.area),
        overlapPercentage: Math.round(overlap.percentage * 10) / 10,
        severity: overlap.area > 0 ? 'error' : 'warning',
        location: unionLocation(first, second),
        message: overlap.area > 0
          ? `Connector labels "${labels[index].id}" and "${labels[otherIndex].id}" overlap`
          : `Connector labels "${labels[index].id}" and "${labels[otherIndex].id}" are too close`,
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
): Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];

  for (const element of elements) {
    const x = offsetX + getNumberProperty(element, values, traces, 'x', 0);
    const y = offsetY + getNumberProperty(element, values, traces, 'y', 0);
    if ((element.type === 'line' || element.type === 'arrow')
      && getStringProperty(element, values, traces, 'semantic_role', '') === 'connector_segment') {
      segments.push({
        id: getStringProperty(element, values, traces, 'connector_id', element.name),
        x1: x,
        y1: y,
        x2: offsetX + getNumberProperty(element, values, traces, 'x2', x),
        y2: offsetY + getNumberProperty(element, values, traces, 'y2', y),
      });
    }

    if (element.children?.length) {
      segments.push(...collectConnectorSegments(element.children, values, traces, x, y));
    }
  }

  return segments;
}

function segmentHitsBox(
  segment: { x1: number; y1: number; x2: number; y2: number },
  box: BoundingBox,
  padding: number,
): boolean {
  const left = box.x - padding;
  const right = box.x + box.width + padding;
  const top = box.y - padding;
  const bottom = box.y + box.height + padding;

  if (segment.y1 === segment.y2) {
    const minX = Math.min(segment.x1, segment.x2);
    const maxX = Math.max(segment.x1, segment.x2);
    return segment.y1 >= top && segment.y1 <= bottom && maxX >= left && minX <= right;
  }

  if (segment.x1 === segment.x2) {
    const minY = Math.min(segment.y1, segment.y2);
    const maxY = Math.max(segment.y1, segment.y2);
    return segment.x1 >= left && segment.x1 <= right && maxY >= top && minY <= bottom;
  }

  return false;
}

function connectorSegmentBox(segment: { id: string; x1: number; y1: number; x2: number; y2: number }): BoundingBox {
  return {
    id: segment.id,
    type: 'connector-segment',
    x: Math.min(segment.x1, segment.x2),
    y: Math.min(segment.y1, segment.y2),
    width: Math.max(1, Math.abs(segment.x2 - segment.x1)),
    height: Math.max(1, Math.abs(segment.y2 - segment.y1)),
    allowOverlap: false,
  };
}
