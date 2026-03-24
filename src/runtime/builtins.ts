import * as path from 'path';
import { GSValue, GSFunction } from './values';

export function createBuiltins(): Record<string, GSValue> {
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
    str: (value: GSValue): string => String(value),
    clamp: (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value)),
    sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
    tanh: Math.tanh,
    len: (arr: GSValue): number => {
      if (Array.isArray(arr)) return arr.length;
      if (typeof arr === 'string') return arr.length;
      if (typeof arr === 'object' && arr !== null) return Object.keys(arr).length;
      return 0;
    },
    map: (arr: GSValue[], fn: (v: GSValue) => GSValue): GSValue[] => arr.map(v => fn(v)),
    filter: (arr: GSValue[], fn: (v: GSValue) => boolean): GSValue[] => arr.filter(v => fn(v)),
    reduce: (arr: GSValue[], fn: (acc: GSValue, v: GSValue) => GSValue, init?: GSValue): GSValue =>
      arr.reduce((acc, v) => fn(acc, v), init ?? arr[0]),
    zip: (...arrs: GSValue[][]): GSValue[][] => {
      const len = Math.min(...arrs.map(a => a.length));
      return Array.from({ length: len }, (_, i) => arrs.map(a => a[i]));
    },
    print: (...args: GSValue[]) => {
      console.log(...args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a));
      return null;
    },
    image: (assetPath: GSValue) => {
      const value = typeof assetPath === 'string' ? assetPath : String(assetPath ?? '');
      const ext = path.extname(value).toLowerCase().replace(/^\./, '');
      return {
        type: 'imageAsset',
        path: value,
        format: ext || undefined,
      };
    },
    true: true,
    false: false,
    null: null,
    PI: Math.PI,
    E: Math.E,
  };
}

export function createGSFunction(params: string[], body: any[], closure: Record<string, GSValue>): GSFunction {
  return {
    type: 'function',
    params,
    body,
    closure: { ...closure }
  };
}
