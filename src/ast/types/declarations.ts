import { SourceLocation } from './common';
import { Expression } from './expressions';
import { Statement } from './statements';

export interface Program {
  type: 'Program';
  body: TopLevelNode[];
  location: SourceLocation;
}

export type TopLevelNode =
  | UseStatement
  | ImportStatement
  | ConstDeclaration
  | DataDeclaration
  | FuncDeclaration
  | ThemeDeclaration
  | StyleDeclaration
  | SubDeclaration
  | ComponentDeclaration
  | AlgoDeclaration
  | PseudoDeclaration
  | ChartDeclaration
  | FlowDeclaration
  | DiagramDeclaration
  | TableDeclaration
  | Plot3dDeclaration
  | Scene3dDeclaration
  | ErdDeclaration
  | InfraDeclaration
  | PageDeclaration
  | RenderDeclaration;

export interface UseStatement {
  type: 'UseStatement';
  module: string;
  location: SourceLocation;
}

export interface ImportStatement {
  type: 'ImportStatement';
  path: string;
  location: SourceLocation;
}

export interface ConstDeclaration {
  type: 'ConstDeclaration';
  name: string;
  value: Expression;
  location: SourceLocation;
}

export interface DataDeclaration {
  type: 'DataDeclaration';
  bindings: Binding[];
  location: SourceLocation;
}

export interface Binding {
  name: string;
  value: Expression;
}

export interface FuncDeclaration {
  type: 'FuncDeclaration';
  name: string;
  params: string[];
  body: Statement[];
  location: SourceLocation;
}

export interface ThemeDeclaration {
  type: 'ThemeDeclaration';
  name: string;
  properties: Record<string, Expression>;
  location: SourceLocation;
}

export interface StyleDeclaration {
  type: 'StyleDeclaration';
  name: string;
  properties: Record<string, Expression>;
  location: SourceLocation;
}

export interface SubDeclaration {
  type: 'SubDeclaration';
  name: string;
  params: string[];
  body: TopLevelNode[];
  location: SourceLocation;
}

export interface ComponentDeclaration {
  type: 'ComponentDeclaration';
  name: string;
  module: string;
  args: Record<string, Expression>;
  location: SourceLocation;
}

export interface AlgoDeclaration {
  type: 'AlgoDeclaration';
  name: string;
  params: string[];
  body: Statement[];
  location: SourceLocation;
}

export interface PseudoDeclaration {
  type: 'PseudoDeclaration';
  name: string;
  lines: string[];
  location: SourceLocation;
}

export interface ChartDeclaration {
  type: 'ChartDeclaration';
  name: string;
  properties: Record<string, Expression>;
  location: SourceLocation;
}

export interface FlowDeclaration {
  type: 'FlowDeclaration';
  name: string;
  properties: Record<string, Expression>;
  nodes: FlowNode[];
  edges: FlowEdge[];
  location: SourceLocation;
}

export interface FlowNode {
  type: 'FlowNode';
  id: string;
  nodeType?: string;
  label?: string;
}

export interface FlowEdge {
  type: 'FlowEdge';
  from: string;
  to: string;
  label?: string;
}

export interface DiagramDeclaration {
  type: 'DiagramDeclaration';
  name: string;
  properties: Record<string, Expression>;
  elements: DiagramElement[];
  location: SourceLocation;
}

export interface DiagramElement {
  type: string;
  name: string;
  properties: Record<string, Expression>;
  children?: DiagramElement[];
}

export interface TableDeclaration {
  type: 'TableDeclaration';
  name: string;
  columns?: string[];
  rows?: Expression;
  properties: Record<string, Expression>;
  location: SourceLocation;
}

export interface Plot3dDeclaration {
  type: 'Plot3dDeclaration';
  name: string;
  properties: Record<string, Expression>;
  location: SourceLocation;
}

export interface Scene3dDeclaration {
  type: 'Scene3dDeclaration';
  name: string;
  properties: Record<string, Expression>;
  elements: Scene3dElement[];
  location: SourceLocation;
}

export interface Scene3dElement {
  type: string;
  name: string;
  properties: Record<string, Expression>;
}

export interface ErdDeclaration {
  type: 'ErdDeclaration';
  name: string;
  tables: ErdTable[];
  relationships: ErdRelationship[];
  location: SourceLocation;
}

export interface ErdTable {
  name: string;
  fields: ErdField[];
}

export interface ErdField {
  name: string;
  fieldType: string;
  constraints: string[];
}

export interface ErdRelationship {
  from: string;
  to: string;
  cardinality: string;
}

export interface InfraDeclaration {
  type: 'InfraDeclaration';
  provider: string;
  name: string;
  properties: Record<string, Expression>;
  elements: InfraElement[];
  connections: InfraConnection[];
  location: SourceLocation;
}

export interface InfraElement {
  type: string;
  name: string;
  properties: Record<string, Expression>;
}

export interface InfraConnection {
  from: string;
  to: string;
  label?: string;
}

export interface PageDeclaration {
  type: 'PageDeclaration';
  name: string;
  properties: Record<string, Expression>;
  placements: PagePlacement[];
  location: SourceLocation;
}

export interface PagePlacement {
  target: string;
  position: string;
}

export interface RenderDeclaration {
  type: 'RenderDeclaration';
  targets: RenderTarget[];
  location: SourceLocation;
}

export interface RenderTarget {
  kind: string;
  name: string;
  output: string;
}

export const TOP_LEVEL_KEYWORDS = [
  'use', 'import', 'const', 'data', 'func', 'theme', 'style', 'sub',
  'component', 'algo', 'pseudo', 'chart', 'flow', 'diagram', 'table', 'plot3d',
  'scene3d', 'erd', 'infra', 'page', 'render'
] as const;
