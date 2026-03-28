import * as fs from 'fs';
import * as path from 'path';
import { MIN_ASSET_WIDTH, MIN_ASSET_HEIGHT } from '../diagram-semantic';
import { ValidationIssue, ValidationReport, ReadabilityMetrics, MIN_FONT_SIZE, MIN_ELEMENT_SIZE } from './types';
import { calculateReadabilityScore } from './readability';

export function generateReport(
  attempts: number,
  issues: ValidationIssue[],
  metrics: ReadabilityMetrics,
  success: boolean,
  declName: string,
  declType: string
): ValidationReport {
  const suggestions: string[] = [];

  if (!success) {
    suggestions.push('Consider increasing canvas dimensions');
    suggestions.push('Reduce the number of elements or simplify the layout');
    suggestions.push('Use allow_overlap: true only for intentional overlaps');
  }

  if (metrics.minFontSize < MIN_FONT_SIZE) {
    suggestions.push(`Increase minimum font size to at least ${MIN_FONT_SIZE}px`);
  }

  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    suggestions.push(`Increase minimum element size to at least ${MIN_ELEMENT_SIZE}px`);
  }

  if (!success && metrics.elementCount > 80) {
    suggestions.push('Consider splitting into multiple diagrams for better readability');
  }

  if (issues.some((issue) => issue.kind === 'math_fallback')) {
    suggestions.push('Use explicit TeX or supported shorthand for formulas that fell back to plain text');
  }

  if (issues.some((issue) => issue.kind === 'tight_gap' || issue.kind === 'awkward_spacing')) {
    suggestions.push('Increase card, lane, or child gap settings to improve readability');
  }
  if (issues.some((issue) => issue.kind === 'undersized_text')) {
    suggestions.push('Raise semantic text roles to their minimum sizes so titles, body text, and formulas stay readable');
  }
  if (issues.some((issue) => issue.kind === 'undersized_asset')) {
    suggestions.push(`Increase semantic image blocks to at least ${MIN_ASSET_WIDTH}x${MIN_ASSET_HEIGHT}`);
  }
  if (issues.some((issue) => issue.kind === 'weak_hierarchy')) {
    suggestions.push('Strengthen typography hierarchy so section titles, card titles, and body text do not collapse into the same visual weight');
  }
  if (issues.some((issue) => issue.kind === 'dense_panel')) {
    suggestions.push('Reduce panel density by increasing panel size or simplifying stacked content');
  }
  if (issues.some((issue) => issue.kind === 'decorative_interference')) {
    suggestions.push('Remove or relocate decorative labels that compete with active content');
  }
  if (issues.some((issue) => issue.kind === 'connector_label_crowding')) {
    suggestions.push('Reserve clearer space for connector labels away from panels and neighboring labels');
  }
  if (issues.some((issue) => issue.kind === 'connector_crowding')) {
    suggestions.push('Reroute semantic connectors so parallel segments do not share the same corridor or run too close together');
  }
  if (issues.some((issue) => issue.kind === 'embed_too_small')) {
    suggestions.push('Increase page cell size or allow the page to grow so embedded figures stay above the minimum readable scale');
  }
  if (issues.some((issue) => issue.kind === 'excessive_empty_space')) {
    suggestions.push('Compact oversized containers or reduce empty page/panel slack so content occupies the available space more effectively');
  }
  if (issues.some((issue) => issue.kind === 'misaligned_siblings')) {
    suggestions.push('Snap related sibling panels onto the same row/column tracks so repeated structures align cleanly');
  }

  return {
    timestamp: new Date().toISOString(),
    file: '',
    declaration: declName,
    declarationType: declType,
    attempts,
    success,
    readabilityScore: calculateReadabilityScore(metrics, issues),
    issues: issues.map((i) => ({
      kind: i.kind,
      severity: i.severity,
      element1: i.element1.id,
      element2: i.element2.id,
      overlapArea: i.overlapArea,
      overlapPercentage: i.overlapPercentage,
      location: i.location,
      message: i.message,
    })),
    metrics: {
      minFontSize: Math.round(metrics.minFontSize * 10) / 10,
      avgFontSize: Math.round(metrics.avgFontSize * 10) / 10,
      minElementSize: Math.round(metrics.minElementSize * 10) / 10,
      density: Math.round(metrics.density),
      elementCount: metrics.elementCount,
    },
    suggestions,
  };
}

export function writeValidationReport(
  report: ValidationReport,
  filePath: string,
  declarationName: string
): void {
  const finalReport = {
    ...report,
    declaration: declarationName,
  };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(finalReport, null, 2), 'utf-8');
}
