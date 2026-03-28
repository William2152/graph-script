import { MIN_ASSET_HEIGHT, MIN_ASSET_WIDTH } from '../diagram-semantic';
import { SemanticRoleEntry, ValidationIssue } from './types';

/**
 * Semantic asset sizing checks.
 */
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
