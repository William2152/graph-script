import { SemanticRoleEntry, ValidationIssue, SEMANTIC_ROLE_MIN_SIZE } from './types';
import { unionLocation } from './helpers';

/**
 * Semantic text quality checks: absolute role sizes and hierarchy readability.
 */
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
