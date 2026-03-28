import { DiagramElement, Expression } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { readNumber, readString, resolveValue } from './common';
import { ZERO_LOC } from './graph-types';

export function makeElement(
  type: string,
  name: string,
  props: Record<string, string | number | boolean>,
  children?: DiagramElement[],
): DiagramElement {
  return {
    type,
    name,
    properties: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, literal(value)])),
    ...(children?.length ? { children } : {}),
  };
}

function literal(value: string | number | boolean): Expression {
  return { type: 'Literal', value, location: ZERO_LOC };
}

export function getString(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback = '',
): string {
  return readString(resolveValue(element.properties[key], values, traces), fallback);
}

export function getNumber(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback = 0,
): number {
  return readNumber(resolveValue(element.properties[key], values, traces), fallback);
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(max)) return Math.max(min, value);
  return Math.max(min, Math.min(max, value));
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
