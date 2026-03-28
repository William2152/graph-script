import { BoundingBox, SemanticRoleEntry, ValidationIssue } from './types';
import { calculateOverlap } from './detection';

/**
 * Detects decorative layers intersecting meaningful content.
 */
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
