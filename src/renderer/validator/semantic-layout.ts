import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { BoundingBox, ValidationIssue } from './types';
import { getBooleanProperty, getNumberProperty, getStringProperty, resolveElementBox, unionOfBoxes } from './helpers';

/**
 * Semantic layout checks for dense cards and panel packing.
 */
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
