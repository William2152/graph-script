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
import {
  detectEmbedScaleIssues,
  detectExcessiveEmptySpaceIssues,
  detectMisalignedSiblingIssues,
} from './issues-readability';
import { detectMathFallbackIssues } from './issues-math-fallback';
import { detectPlainMathTextIssues } from './issues-plain-math';
import {
  detectCanvasOverflowClippingIssues,
  detectHardConstraintOverflowIssues,
  detectManualCoordinateModeIssues,
} from './issues-mode';

export {
  detectOverflowIssues,
  detectGapIssues,
  detectSiblingGapIssues,
  detectAwkwardSpacingIssues,
  detectConnectorCrossPanelIssues,
  detectConnectorCrowdingIssues,
  detectEmbedScaleIssues,
  detectExcessiveEmptySpaceIssues,
  detectMisalignedSiblingIssues,
  detectMathFallbackIssues,
  detectPlainMathTextIssues,
  detectCanvasOverflowClippingIssues,
  detectManualCoordinateModeIssues,
  detectHardConstraintOverflowIssues,
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
  const coreIssues = collectCoreValidationIssues(snapshot, values, traces);
  issues.push(...coreIssues);
  issues.push(...detectConnectorCrossPanelIssues(snapshot.elements, snapshot.boxes, values, traces));
  issues.push(...detectConnectorCrowdingIssues(snapshot.elements, values, traces));
  issues.push(...detectEmbedScaleIssues(snapshot.elements, values, traces));
  issues.push(...detectExcessiveEmptySpaceIssues(snapshot.elements, values, traces));
  issues.push(...detectMisalignedSiblingIssues(snapshot.elements, values, traces));
  issues.push(...detectMathFallbackIssues(snapshot.elements, values, traces));
  issues.push(...detectPlainMathTextIssues(snapshot.elements, values, traces));
  issues.push(...detectSemanticReadabilityIssues(snapshot, values, traces));
  issues.push(...detectCanvasOverflowClippingIssues(snapshot));
  issues.push(...detectManualCoordinateModeIssues(snapshot, values, traces));
  issues.push(...detectHardConstraintOverflowIssues(snapshot, issues, values, traces));
  return dedupeIssues(issues);
}
