import { Expression } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { readString, resolveValue } from './common';

export type ReadabilityMode = 'auto' | 'legacy';

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
};

export const READABILITY_POLICY = DOCUMENT_READABILITY_POLICY;

export function resolveReadabilityMode(value: unknown, fallback: ReadabilityMode = 'auto'): ReadabilityMode {
  return value === 'legacy' ? 'legacy' : fallback === 'legacy' ? 'legacy' : 'auto';
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
