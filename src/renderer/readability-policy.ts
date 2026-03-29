import { Expression } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { readBoolean, readNumber, readString, resolveValue } from './common';

export type ReadabilityMode = 'auto' | 'legacy';
export type RendererLayoutMode = 'dynamic' | 'manual';
export type RendererSizeMode = 'dynamic' | 'fixed';

export interface SpacingDefaults {
  margin: number;
  padding: number;
  gap: number;
}

export interface RendererDynamicDefaults {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  spacing: SpacingDefaults;
}

export interface ReadabilityPolicy {
  headerTitleMin: number;
  sectionTitleMin: number;
  cardTitleMin: number;
  bodyTextMin: number;
  formulaTextMin: number;
  connectorLabelMin: number;
  flowFontMin: number;
  minEmbedScale: number;
  alignmentSnapTolerance: number;
  whitespaceSlackRatio: number;
  excessiveGapMultiplier: number;
  panelPaddingMin: number;
  rendererDefaults: {
    diagram: RendererDynamicDefaults;
    page: RendererDynamicDefaults;
    flow: RendererDynamicDefaults;
    graph: RendererDynamicDefaults;
    infra: RendererDynamicDefaults;
    erd: RendererDynamicDefaults;
    table: RendererDynamicDefaults;
    chart: RendererDynamicDefaults;
    plot3d: RendererDynamicDefaults;
    scene3d: RendererDynamicDefaults;
  };
}

export interface ReadableFitOptions {
  minScale?: number;
  verticalAlign?: 'top' | 'center';
}

export interface ReadableFitResult {
  scale: number;
  dx: number;
  dy: number;
  widthScale: number;
  heightScale: number;
  requiredWidth: number;
  requiredHeight: number;
  belowMinScale: boolean;
  widthLimited: boolean;
  heightLimited: boolean;
}

export interface GraphAutoVisuals {
  radius: number;
  labelSize: number;
  padding: number;
  edgeStrokeWidth: number;
}

export const DOCUMENT_READABILITY_POLICY: ReadabilityPolicy = {
  headerTitleMin: 28,
  sectionTitleMin: 24,
  cardTitleMin: 20,
  bodyTextMin: 16,
  formulaTextMin: 22,
  connectorLabelMin: 16,
  flowFontMin: 14,
  minEmbedScale: 0.72,
  alignmentSnapTolerance: 18,
  whitespaceSlackRatio: 0.34,
  excessiveGapMultiplier: 3,
  panelPaddingMin: 20,
  rendererDefaults: {
    diagram: {
      width: 1280,
      height: 720,
      minWidth: 720,
      minHeight: 420,
      spacing: { margin: 36, padding: 24, gap: 24 },
    },
    page: {
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 640,
      spacing: { margin: 32, padding: 24, gap: 24 },
    },
    flow: {
      width: 1400,
      height: 860,
      minWidth: 900,
      minHeight: 420,
      spacing: { margin: 40, padding: 52, gap: 72 },
    },
    graph: {
      width: 320,
      height: 240,
      minWidth: 180,
      minHeight: 180,
      spacing: { margin: 0, padding: 28, gap: 28 },
    },
    infra: {
      width: 1100,
      height: 700,
      minWidth: 820,
      minHeight: 520,
      spacing: { margin: 72, padding: 24, gap: 48 },
    },
    erd: {
      width: 980,
      height: 640,
      minWidth: 860,
      minHeight: 520,
      spacing: { margin: 48, padding: 24, gap: 64 },
    },
    table: {
      width: 640,
      height: 360,
      minWidth: 420,
      minHeight: 220,
      spacing: { margin: 24, padding: 24, gap: 16 },
    },
    chart: {
      width: 900,
      height: 520,
      minWidth: 520,
      minHeight: 360,
      spacing: { margin: 28, padding: 28, gap: 18 },
    },
    plot3d: {
      width: 760,
      height: 520,
      minWidth: 520,
      minHeight: 360,
      spacing: { margin: 32, padding: 64, gap: 24 },
    },
    scene3d: {
      width: 960,
      height: 620,
      minWidth: 620,
      minHeight: 420,
      spacing: { margin: 32, padding: 60, gap: 24 },
    },
  },
};

export const READABILITY_POLICY = DOCUMENT_READABILITY_POLICY;

export function resolveReadabilityMode(value: unknown, fallback: ReadabilityMode = 'auto'): ReadabilityMode {
  return value === 'legacy' ? 'legacy' : fallback === 'legacy' ? 'legacy' : 'auto';
}

export function resolveRendererLayoutMode(
  value: unknown,
  fallback: RendererLayoutMode = 'dynamic',
): RendererLayoutMode {
  return value === 'manual' ? 'manual' : fallback === 'manual' ? 'manual' : 'dynamic';
}

export function readRendererLayoutMode(
  expr: Expression | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: RendererLayoutMode = 'dynamic',
): RendererLayoutMode {
  if (!expr) return fallback;
  return resolveRendererLayoutMode(readString(resolveValue(expr, values, traces), fallback), fallback);
}

export function resolveRendererSizeMode(
  value: unknown,
  fallback: RendererSizeMode = 'dynamic',
): RendererSizeMode {
  return value === 'fixed' ? 'fixed' : fallback === 'fixed' ? 'fixed' : 'dynamic';
}

export function readRendererSizeMode(
  expr: Expression | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: RendererSizeMode = 'dynamic',
): RendererSizeMode {
  if (!expr) return fallback;
  return resolveRendererSizeMode(readString(resolveValue(expr, values, traces), fallback), fallback);
}

export function readRendererSizeModeWithLegacyFixed(
  sizeExpr: Expression | undefined,
  legacyFixedExpr: Expression | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: RendererSizeMode = 'dynamic',
): RendererSizeMode {
  if (sizeExpr) return readRendererSizeMode(sizeExpr, values, traces, fallback);
  if (legacyFixedExpr && readBoolean(resolveValue(legacyFixedExpr, values, traces), false)) return 'fixed';
  return fallback;
}

export function hasExplicitProperty(expr: Expression | undefined): boolean {
  return expr != null;
}

export function readConstrainedNumber(
  expr: Expression | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: number,
): number {
  return expr ? readNumber(resolveValue(expr, values, traces), fallback) : fallback;
}

export function readSpacingDefaults(
  renderer: keyof ReadabilityPolicy['rendererDefaults'],
): RendererDynamicDefaults {
  return READABILITY_POLICY.rendererDefaults[renderer];
}

export function resolveRendererExtent(
  hasExplicitValue: boolean,
  explicitValue: number,
  fixedDefault: number,
  sizeMode: RendererSizeMode,
  measuredValue: number,
  minValue: number,
  strict = false,
): number {
  const safeMeasured = Number.isFinite(measuredValue) ? measuredValue : 0;
  const strictValue = hasExplicitValue ? explicitValue : fixedDefault;
  if (strict || sizeMode === 'fixed') return Math.max(minValue, strictValue);
  return Math.max(minValue, safeMeasured, hasExplicitValue ? explicitValue : 0);
}

export function readReadabilityMode(
  expr: Expression | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallback: ReadabilityMode = 'auto',
): ReadabilityMode {
  if (!expr) return fallback;
  return resolveReadabilityMode(readString(resolveValue(expr, values, traces), fallback), fallback);
}

export function fitIntoBoxWithReadableScale(
  innerWidth: number,
  innerHeight: number,
  boxWidth: number,
  boxHeight: number,
  options: ReadableFitOptions = {},
): ReadableFitResult {
  const minScale = Math.max(0.1, options.minScale ?? READABILITY_POLICY.minEmbedScale);
  const widthScale = boxWidth / Math.max(innerWidth, 1);
  const heightScale = boxHeight / Math.max(innerHeight, 1);

  let scale = Math.min(widthScale, heightScale);
  let requiredWidth = boxWidth;
  let requiredHeight = boxHeight;

  if (widthScale + 1e-6 < minScale) {
    requiredWidth = innerWidth * minScale;
  }
  if (heightScale + 1e-6 < minScale) {
    requiredHeight = innerHeight * minScale;
  }

  scale = Math.min(
    Math.max(boxWidth, requiredWidth) / Math.max(innerWidth, 1),
    Math.max(boxHeight, requiredHeight) / Math.max(innerHeight, 1),
  );

  const dx = (boxWidth - innerWidth * scale) / 2;
  const dy = options.verticalAlign === 'top' ? 0 : (boxHeight - innerHeight * scale) / 2;

  return {
    scale,
    dx,
    dy,
    widthScale,
    heightScale,
    requiredWidth,
    requiredHeight,
    belowMinScale: scale + 1e-6 < minScale,
    widthLimited: widthScale + 1e-6 < minScale,
    heightLimited: heightScale + 1e-6 < minScale,
  };
}

export function deriveGraphAutoVisuals(width: number, height: number, nodeCount: number): GraphAutoVisuals {
  const safeCount = Math.max(nodeCount, 1);
  const minDimension = Math.max(120, Math.min(width, height));
  const areaPerNode = Math.sqrt(Math.max(width * height, 1) / safeCount);
  const radius = clamp(Math.round(Math.min(minDimension * 0.14, areaPerNode * 0.23)), 18, 38);
  const labelSize = clamp(Math.round(radius * 0.92), READABILITY_POLICY.bodyTextMin, 30);
  const padding = clamp(Math.round(radius * 1.1), 24, 54);
  const edgeStrokeWidth = clamp(Number((radius * 0.11).toFixed(2)), 2.4, 5.2);
  return { radius, labelSize, padding, edgeStrokeWidth };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
