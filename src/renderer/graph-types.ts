import { DiagramElement } from '../ast/types';

export interface CompiledGraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  color: string;
  size: number;
}

export interface CompiledGraphResult {
  width: number;
  height: number;
  elements: DiagramElement[];
  nodes: CompiledGraphNode[];
}

export interface GraphCompileOptions {
  includeOwnPosition?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface GraphNodeSpec {
  name: string;
  label: string;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  color: string;
  size: number;
  x?: number;
  y?: number;
}

export interface GraphEdgeSpec {
  name: string;
  from: string;
  to: string;
  stroke: string;
  strokeWidth: number;
  dash: string;
}

export const GRAPH_LAYOUTS = new Set(['manual', 'circle', 'force']);

export const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};
