import { FlowDeclaration } from '../ast/types';
import { ReadabilityMode, RendererLayoutMode, RendererSizeMode } from './readability-policy';

export type FlowDirection = 'top_down' | 'left_right';
export type LayoutMode = 'auto' | 'single_row' | 'snake' | 'vertical';
export type FitMode = 'readable' | 'compact';

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  direction: FlowDirection;
  options: ResolvedFlowOptions;
}

export interface LayoutNode {
  id: string;
  label: string;
  nodeType?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textMode: 'plain' | 'formula';
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
}

export interface NodeBox {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textMode: 'plain' | 'formula';
  label: string;
  nodeType?: string;
}

export interface ResolvedFlowOptions {
  targetWidth: number;
  targetHeight: number;
  minFontSize: number;
  preferredFontSize: number;
  placementMode: RendererLayoutMode;
  sizeMode: RendererSizeMode;
  layoutMode: LayoutMode;
  fit: FitMode;
  direction: FlowDirection;
  readabilityMode: ReadabilityMode;
  padding: number;
  horizontalGap: number;
  verticalGap: number;
}

export interface LayoutCandidate {
  mode: Exclude<LayoutMode, 'auto'>;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  fontSize: number;
  overflowX: number;
  overflowY: number;
  score: number;
}

export type FlowNodeDecl = FlowDeclaration['nodes'][number];
export type FlowEdgeDecl = FlowDeclaration['edges'][number];

export const FLOW_PADDING = 52;
export const DEFAULT_TARGET_WIDTH = 1400;
export const DEFAULT_TARGET_HEIGHT = 860;
