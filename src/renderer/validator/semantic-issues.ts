import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { MIN_ASSET_WIDTH, MIN_ASSET_HEIGHT } from '../diagram-semantic';
import { BoundingBox, SemanticRoleEntry, ValidationIssue, ValidationSnapshot, MIN_LAYOUT_GAP, SEMANTIC_ROLE_MIN_SIZE } from './types';
import { getBooleanProperty, getNumberProperty, getStringProperty, resolveElementBox, boxGap, unionLocation, unionOfBoxes } from './helpers';
import { calculateOverlap } from './detection';

export function detectSemanticReadabilityIssues(
  snapshot: ValidationSnapshot,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const entries = collectSemanticRoleEntries(snapshot.elements, values, traces);
  if (!entries.some((entry) => entry.role)) return [];

  const issues: ValidationIssue[] = [];
  issues.push(...detectSemanticRoleSizeIssues(entries));
  issues.push(...detectSemanticHierarchyIssues(entries));
  issues.push(...detectDensePanelIssues(snapshot.elements, values, traces));
  issues.push(...detectUndersizedAssetIssues(entries));
  issues.push(...detectDecorativeInterferenceIssues(entries, snapshot.boxes));
  issues.push(...detectConnectorLabelCrowdingIssues(entries, snapshot.boxes, snapshot.elements, values, traces));
  return issues;
}

export function collectSemanticRoleEntries(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0,
  parentId?: string,
): SemanticRoleEntry[] {
  const entries: SemanticRoleEntry[] = [];

  for (const element of elements) {
    const box = resolveElementBox(element, values, traces, offsetX, offsetY);
    const role = getStringProperty(element, values, traces, 'semantic_role', '');
    if (role) {
      entries.push({
        id: element.name,
        type: element.type,
        role,
        size: getNumberProperty(element, values, traces, 'size', 0),
        box,
        parentId,
        connectorFrom: getStringProperty(element, values, traces, 'connector_from', ''),
        connectorTo: getStringProperty(element, values, traces, 'connector_to', ''),
        unplaced: getBooleanProperty(element, values, traces, 'connector_label_unplaced', false),
      });
    }

    if ((element.type === 'panel' || element.type === 'box') && box) {
      const label = getStringProperty(element, values, traces, 'label', '');
      const labelRole = getStringProperty(element, values, traces, 'semantic_label_role', '');
      if (label && labelRole) {
        const titleSize = getNumberProperty(element, values, traces, 'title_size', getNumberProperty(element, values, traces, 'size', 16));
        const titleHeight = Math.max(titleSize * 1.3, 26);
        entries.push({
          id: `${element.name}#title`,
          type: 'text',
          role: labelRole,
          size: titleSize,
          box: {
            id: `${element.name}#title`,
            type: 'text',
            x: box.x + 14,
            y: box.y + 18,
            width: Math.max(24, box.width - 28),
            height: titleHeight,
            allowOverlap: false,
          },
          parentId: element.name,
        });
      }

      const subtitle = getStringProperty(element, values, traces, 'subtitle', '');
      const subtitleRole = getStringProperty(element, values, traces, 'semantic_subtitle_role', '');
      if (subtitle && subtitleRole) {
        const titleSize = getNumberProperty(element, values, traces, 'title_size', getNumberProperty(element, values, traces, 'size', 16));
        const subtitleSize = getNumberProperty(element, values, traces, 'subtitle_size', 14);
        const titleHeight = label ? Math.max(titleSize * 1.3, 26) + 8 : 0;
        entries.push({
          id: `${element.name}#subtitle`,
          type: 'text',
          role: subtitleRole,
          size: subtitleSize,
          box: {
            id: `${element.name}#subtitle`,
            type: 'text',
            x: box.x + 16,
            y: box.y + 20 + titleHeight,
            width: Math.max(24, box.width - 32),
            height: Math.max(subtitleSize * 1.35, 22),
            allowOverlap: false,
          },
          parentId: element.name,
        });
      }
    }

    if (element.children?.length) {
      const childOffsetX = offsetX + getNumberProperty(element, values, traces, 'x', 0);
      const childOffsetY = offsetY + getNumberProperty(element, values, traces, 'y', 0);
      entries.push(...collectSemanticRoleEntries(element.children, values, traces, childOffsetX, childOffsetY, element.name));
    }
  }

  return entries;
}

export function detectSemanticRoleSizeIssues(entries: SemanticRoleEntry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const entry of entries) {
    const minimum = SEMANTIC_ROLE_MIN_SIZE[entry.role];
    if (!minimum || entry.size + 0.1 >= minimum) continue;
    const location = entry.box
      ? { x: entry.box.x, y: entry.box.y, width: entry.box.width, height: entry.box.height }
      : { x: 0, y: 0, width: 0, height: 0 };
    issues.push({
      kind: 'undersized_text',
      element1: { id: entry.id, type: entry.type },
      element2: { id: entry.role, type: 'semantic-role' },
      overlapArea: 0,
      overlapPercentage: 0,
      severity: minimum - entry.size >= 1 ? 'error' : 'warning',
      location,
      message: `Semantic text role "${entry.role}" in "${entry.id}" is smaller than ${minimum}px`,
    });
  }
  return issues;
}

export function detectSemanticHierarchyIssues(entries: SemanticRoleEntry[]): ValidationIssue[] {
  const hierarchyPairs: Array<[string, string, number]> = [
    ['header_title', 'section_heading', 2],
    ['section_heading', 'card_title', 2],
    ['card_title', 'body_text', 2],
  ];
  const issues: ValidationIssue[] = [];

  for (const [parentRole, childRole, minGap] of hierarchyPairs) {
    const parentEntries = entries.filter((entry) => entry.role === parentRole);
    const childEntries = entries.filter((entry) => entry.role === childRole);
    if (!parentEntries.length || !childEntries.length) continue;

    const smallestParent = parentEntries.reduce((min, entry) => (entry.size < min.size ? entry : min), parentEntries[0]);
    const largestChild = childEntries.reduce((max, entry) => (entry.size > max.size ? entry : max), childEntries[0]);
    if (smallestParent.size + 0.1 >= largestChild.size + minGap) continue;

    const location = unionLocation(smallestParent.box, largestChild.box);
    issues.push({
      kind: 'weak_hierarchy',
      element1: { id: smallestParent.id, type: smallestParent.type },
      element2: { id: largestChild.id, type: largestChild.type },
      overlapArea: 0,
      overlapPercentage: 0,
      severity: 'warning',
      location,
      message: `Semantic hierarchy is weak: role "${parentRole}" should be at least ${minGap}px larger than "${childRole}"`,
    });
  }

  return issues;
}

export function detectDensePanelIssues(
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
    const role = getStringProperty(element, values, traces, 'semantic_role', '');
    const box = resolveElementBox(element, values, traces, offsetX, offsetY);

    if ((element.type === 'panel' || element.type === 'box') && role === 'card' && box && element.children?.length) {
      const childBoxes = element.children
        .map((child) => resolveElementBox(child, values, traces, x, y))
        .filter((childBox, index): childBox is BoundingBox => childBox !== null && !getBooleanProperty(element.children![index], values, traces, 'validation_ignore', false));

      if (childBoxes.length >= 5) {
        const used = unionOfBoxes(childBoxes);
        const usedWidthRatio = used.width / Math.max(box.width, 1);
        const usedHeightRatio = used.height / Math.max(box.height, 1);
        if (usedWidthRatio > 0.9 && usedHeightRatio > 0.82) {
          issues.push({
            kind: 'dense_panel',
            element1: { id: element.name, type: element.type },
            element2: { id: element.name, type: element.type },
            overlapArea: Math.round(used.width * used.height),
            overlapPercentage: Math.round((used.width * used.height / Math.max(box.width * box.height, 1)) * 1000) / 10,
            severity: 'warning',
            location: { x: used.x, y: used.y, width: used.width, height: used.height },
            message: `Panel "${element.name}" is visually too dense for its available space`,
          });
        }
      }
    }

    if (element.children?.length) {
      issues.push(...detectDensePanelIssues(element.children, values, traces, x, y));
    }
  }

  return issues;
}

export function detectUndersizedAssetIssues(entries: SemanticRoleEntry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const entry of entries) {
    if (entry.role !== 'asset' || !entry.box) continue;
    if (entry.box.width + 0.1 >= MIN_ASSET_WIDTH && entry.box.height + 0.1 >= MIN_ASSET_HEIGHT) continue;
    issues.push({
      kind: 'undersized_asset',
      element1: { id: entry.id, type: entry.type },
      element2: { id: 'asset', type: 'semantic-role' },
      overlapArea: 0,
      overlapPercentage: 0,
      severity: 'error',
      location: { x: entry.box.x, y: entry.box.y, width: entry.box.width, height: entry.box.height },
      message: `Semantic asset "${entry.id}" is smaller than the readable minimum ${MIN_ASSET_WIDTH}x${MIN_ASSET_HEIGHT}`,
    });
  }
  return issues;
}

export function detectDecorativeInterferenceIssues(entries: SemanticRoleEntry[], boxes: BoundingBox[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const decorative = entries.filter((entry) => entry.role === 'decorative' && entry.box);
  const content = boxes.filter((box) => !box.validationIgnore);

  for (const item of decorative) {
    const decorativeBox = item.box!;
    for (const box of content) {
      const overlap = calculateOverlap(decorativeBox, box);
      if (overlap.area <= 120) continue;
      issues.push({
        kind: 'decorative_interference',
        element1: { id: item.id, type: item.type },
        element2: { id: box.id, type: box.type },
        overlapArea: Math.round(overlap.area),
        overlapPercentage: Math.round(overlap.percentage * 10) / 10,
        severity: 'warning',
        location: {
          x: Math.round(overlap.bounds.x),
          y: Math.round(overlap.bounds.y),
          width: Math.round(overlap.bounds.width),
          height: Math.round(overlap.bounds.height),
        },
        message: `Decorative element "${item.id}" interferes with active content "${box.id}"`,
      });
    }
  }

  return issues;
}

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
