import { Expression, FlowDeclaration } from '../ast/types';
import {
  DEFAULT_TARGET_HEIGHT,
  DEFAULT_TARGET_WIDTH,
  FlowDirection,
  LayoutMode,
  ResolvedFlowOptions,
} from './flow-types';
import {
  hasExplicitProperty,
  readSpacingDefaults,
  resolveReadabilityMode,
  resolveRendererLayoutMode,
  resolveRendererSizeMode,
  READABILITY_POLICY,
} from './readability-policy';

/**
 * Reads and normalizes flow layout options from declaration properties.
 */
export function resolveFlowOptions(flow: FlowDeclaration): ResolvedFlowOptions {
  const defaults = readSpacingDefaults('flow');
  const direction = resolveDirection(flow);
  const preferredFontSize = Math.max(16, readFlowNumber(flow.properties.preferred_font_size, 17));
  const readabilityMode = resolveReadabilityMode(readFlowString(flow.properties.readability_mode, 'auto'), 'auto');
  const minFontSize = Math.min(
    preferredFontSize,
    Math.max(READABILITY_POLICY.flowFontMin, readFlowNumber(flow.properties.min_font_size, READABILITY_POLICY.flowFontMin)),
  );
  const rawLayoutMode = readFlowString(flow.properties.layout_mode, 'auto');
  const placementMode = rawLayoutMode === 'manual' || rawLayoutMode === 'dynamic'
    ? resolveRendererLayoutMode(rawLayoutMode, 'dynamic')
    : resolveRendererLayoutMode(readFlowString(flow.properties.placement_mode, 'dynamic'), 'dynamic');
  const layoutMode = rawLayoutMode === 'manual' || rawLayoutMode === 'dynamic'
    ? readFlowString(flow.properties.flow_layout, 'auto')
    : rawLayoutMode;
  const sizeMode = resolveRendererSizeMode(readFlowString(flow.properties.size_mode, 'dynamic'), 'dynamic');
  const fit = readFlowString(flow.properties.fit, 'readable') === 'compact' ? 'compact' : 'readable';
  const explicitTargetWidth = hasExplicitProperty(flow.properties.target_width);
  const explicitTargetHeight = hasExplicitProperty(flow.properties.target_height);
  const padding = Math.max(24, readFlowNumber(flow.properties.padding, defaults.spacing.padding));
  const horizontalGap = Math.max(36, readFlowNumber(flow.properties.gap_x, readFlowNumber(flow.properties.gap, defaults.spacing.gap)));
  const verticalGap = Math.max(44, readFlowNumber(flow.properties.gap_y, readFlowNumber(flow.properties.gap, defaults.spacing.gap + 12)));

  return {
    targetWidth: Math.max(900, readFlowNumber(flow.properties.target_width, explicitTargetWidth ? DEFAULT_TARGET_WIDTH : defaults.width)),
    targetHeight: Math.max(420, readFlowNumber(flow.properties.target_height, explicitTargetHeight ? DEFAULT_TARGET_HEIGHT : defaults.height)),
    minFontSize,
    preferredFontSize,
    placementMode,
    sizeMode,
    layoutMode: normalizeLayoutMode(layoutMode),
    fit,
    direction,
    readabilityMode,
    padding,
    horizontalGap,
    verticalGap,
  };
}

export function candidateModes(options: ResolvedFlowOptions, nodeCount: number): Exclude<LayoutMode, 'auto'>[] {
  if (options.layoutMode !== 'auto') return [options.layoutMode];
  if (options.direction === 'top_down') return ['vertical', 'snake', 'single_row'];
  if (nodeCount >= 5 && nodeCount <= 8) return ['snake', 'single_row', 'vertical'];
  if (nodeCount <= 4) return ['single_row', 'snake', 'vertical'];
  return ['snake', 'vertical', 'single_row'];
}

function resolveDirection(flow: FlowDeclaration): FlowDirection {
  const directionExpr = flow.properties.direction;
  if (directionExpr?.type === 'Identifier' && directionExpr.name === 'left_right') return 'left_right';
  if (directionExpr?.type === 'Literal' && directionExpr.value === 'left_right') return 'left_right';
  return 'top_down';
}

function normalizeLayoutMode(value: string): LayoutMode {
  if (value === 'single_row' || value === 'snake' || value === 'vertical') return value;
  return 'auto';
}

function readFlowString(expr: Expression | undefined, fallback: string): string {
  if (!expr) return fallback;
  if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value;
  if (expr.type === 'Identifier') return expr.name;
  return fallback;
}

function readFlowNumber(expr: Expression | undefined, fallback: number): number {
  if (!expr) return fallback;
  if (expr.type === 'Literal' && typeof expr.value === 'number') return expr.value;
  return fallback;
}
