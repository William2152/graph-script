import { escapeXml, readNumber, readString, resolveValue } from '../common';
import { ElementRenderState } from './render-state';

export function resolveNumber(
  state: ElementRenderState,
  key: string,
  fallback: number,
): number {
  const expr = state.element.properties[key];
  if (!expr) return fallback;
  const value = resolveValue(expr, state.values, state.traces);
  return readNumber(value, fallback);
}

export function resolveString(
  state: ElementRenderState,
  key: string,
  fallback: string,
): string {
  const expr = state.element.properties[key];
  if (!expr) return fallback;
  const value = resolveValue(expr, state.values, state.traces);
  return readString(value, fallback);
}

export function escapeMarkerId(name: string): string {
  return escapeXml(name);
}

export function childOffsets(state: ElementRenderState): { x: number; y: number } {
  return { x: state.x, y: state.y };
}

export function resolveLineEndpoints(state: ElementRenderState): { x2: number; y2: number } {
  return {
    x2: state.offsetX + resolveNumber(state, 'x2', state.x + state.w),
    y2: state.offsetY + resolveNumber(state, 'y2', state.y + state.h),
  };
}

export function buildTextLineCap(
  width: number,
  defaultCap: number,
): number {
  return Math.max(defaultCap, width);
}
