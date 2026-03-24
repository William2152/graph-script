import { Token, Position, SourceLocation } from '../ast/types';

export const KEYWORDS = new Set([
  'true', 'false', 'null'
]);

export const BLOCK_KEYWORDS = new Set([
  'if', 'else', 'while', 'for', 'return', 'emit', 'end'
]);

export const DECLARATION_KEYWORDS = new Set([
  'use', 'import', 'const', 'data', 'func', 'theme', 'style', 'sub',
  'component', 'algo', 'chart', 'flow', 'diagram', 'table', 'plot3d',
  'scene3d', 'erd', 'infra', 'page', 'render'
]);

export function createLocation(start: Position, end: Position): SourceLocation {
  return { start, end };
}
