import { GSValue } from './values';

/**
 * Shared runtime builtins used by evaluator scopes.
 */
export function createBuiltinValues(): Record<string, GSValue> {
  return {
    ...Math,
    range: (start: number, end: number, step: number = 1): number[] => {
      const result: number[] = [];
      for (let i = start; i < end; i += step) result.push(i);
      return result;
    },
    linspace: (start: number, end: number, count: number): number[] => {
      const step = (end - start) / (count - 1);
      return Array.from({ length: count }, (_, i) => start + i * step);
    },
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    exp: Math.exp,
    log: Math.log,
    sqrt: Math.sqrt,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    pow: Math.pow,
    sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
    tanh: Math.tanh,
    len: (arr: GSValue): number => {
      if (Array.isArray(arr)) return arr.length;
      if (typeof arr === 'string') return arr.length;
      if (typeof arr === 'object' && arr !== null) return Object.keys(arr).length;
      return 0;
    },
    map: (arr: GSValue[], fn: (v: GSValue) => GSValue): GSValue[] => arr.map(fn),
    filter: (arr: GSValue[], fn: (v: GSValue) => boolean): GSValue[] => arr.filter(fn),
    zip: (...arrs: GSValue[][]): GSValue[] => {
      const len = Math.min(...arrs.map((a) => a.length));
      return Array.from({ length: len }, (_, i) => arrs.map((a) => a[i]));
    },
    true: true,
    false: false,
    null: null,
  };
}
