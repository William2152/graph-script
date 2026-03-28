import { GSValue, Trace } from '../../runtime/values';
import { ValidationIssue, ValidationSnapshot } from './types';
import { dedupeIssues } from './helpers';
import { detectSemanticReadabilityIssues } from './semantic-issues';
import {
  collectCoreValidationIssues,
  detectAwkwardSpacingIssues,
  detectGapIssues,
  detectOverflowIssues,
  detectSiblingGapIssues,
} from './issues-core';
import {
  detectConnectorCrossPanelIssues,
  detectConnectorCrowdingIssues,
} from './issues-connectors';
import { detectMathFallbackIssues } from './issues-math-fallback';

export {
  detectOverflowIssues,
  detectGapIssues,
  detectSiblingGapIssues,
  detectAwkwardSpacingIssues,
  detectConnectorCrossPanelIssues,
  detectConnectorCrowdingIssues,
  detectMathFallbackIssues,
};

/**
 * Collects all validation issues and deduplicates final output.
 * The implementation is split across focused modules in `issues-*`.
 */
export function collectValidationIssues(
  snapshot: ValidationSnapshot,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...collectCoreValidationIssues(snapshot, values, traces));
  issues.push(...detectConnectorCrossPanelIssues(snapshot.elements, snapshot.boxes, values, traces));
  issues.push(...detectConnectorCrowdingIssues(snapshot.elements, values, traces));
  issues.push(...detectMathFallbackIssues(snapshot.elements, values, traces));
  issues.push(...detectSemanticReadabilityIssues(snapshot, values, traces));
  return dedupeIssues(issues);
}
