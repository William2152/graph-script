import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { ValidationIssue } from './types';
import { getBooleanProperty, getNumberProperty } from './helpers';

export function detectMathFallbackIssues(
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
