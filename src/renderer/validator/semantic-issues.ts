import { GSValue, Trace } from '../../runtime/values';
import { ValidationIssue, ValidationSnapshot } from './types';
import { collectSemanticRoleEntries } from './semantic-entries';
import { detectSemanticRoleSizeIssues, detectSemanticHierarchyIssues } from './semantic-text';
import { detectDensePanelIssues } from './semantic-layout';
import { detectUndersizedAssetIssues } from './semantic-assets';
import { detectDecorativeInterferenceIssues } from './semantic-decorative';
import { detectConnectorLabelCrowdingIssues } from './semantic-connectors';

export {
  collectSemanticRoleEntries,
  detectSemanticRoleSizeIssues,
  detectSemanticHierarchyIssues,
  detectDensePanelIssues,
  detectUndersizedAssetIssues,
  detectDecorativeInterferenceIssues,
  detectConnectorLabelCrowdingIssues,
};

/**
 * Aggregates semantic readability issues from focused semantic validators.
 */
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
