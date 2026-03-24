export type GSValue = string | number | boolean | null | undefined | GSFunction | GSAlgorithm | Trace | any[] | Record<string, any>;

export interface GSFunction {
  type: 'function';
  name?: string;
  params: string[];
  body: any[];
  closure: Record<string, GSValue>;
}

export interface GSAlgorithm {
  type: 'algorithm';
  name: string;
  params: string[];
  body: any[];
  trace: Trace;
}

export interface Trace {
  type: 'trace';
  columns: string[];
  rows: Record<string, GSValue>[];
}

export interface RuntimeScope {
  parent?: RuntimeScope;
  values: Record<string, GSValue>;
}

export function isTruthy(value: GSValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return true;
  return false;
}

export function isEqual(a: GSValue, b: GSValue): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => isEqual((a as any)[k], (b as any)[k]));
  }
  return false;
}

export function compare(a: GSValue, b: GSValue, op: '<' | '>' | '<=' | '>='): boolean {
  const numA = typeof a === 'number' ? a : parseFloat(a as string);
  const numB = typeof b === 'number' ? b : parseFloat(b as string);

  switch (op) {
    case '<': return numA < numB;
    case '>': return numA > numB;
    case '<=': return numA <= numB;
    case '>=': return numA >= numB;
    default: return false;
  }
}
