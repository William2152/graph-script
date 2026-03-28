import { SourceLocation } from './common';
import { Expression, Statement } from './expressions-statements';

export type AstNode =
  | Program
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

export interface Program {
  type: 'Program';
  body: AstNode[];
  location: SourceLocation;
}

export interface UseStatement {
  type: 'UseStatement';
  module: string;
  location: SourceLocation;
}

export interface ImportStatement {
  type: 'ImportStatement';
  path: string;
  imports?: { name: string; alias?: string }[];
  from?: string;
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
  bindings: { name: string; value: Expression }[];
  location: SourceLocation;
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
  properties: Record<string, any>;
  location: SourceLocation;
}

export interface StyleDeclaration {
  type: 'StyleDeclaration';
  name: string;
  properties: Record<string, any>;
  location: SourceLocation;
}

export interface SubDeclaration {
  type: 'SubDeclaration';
  name: string;
  params: string[];
  body: AstNode[];
  exports: { name: string; value: string }[];
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
  body: AlgoStatement[];
  location: SourceLocation;
}

export interface AlgoStatement {
  type: 'AlgoStatement';
  kind: 'Assign' | 'If' | 'While' | 'For' | 'Return' | 'Emit' | 'Break' | 'Continue';
  location: SourceLocation;
  [key: string]: any;
}

export interface PseudoDeclaration {
  type: 'PseudoDeclaration';
  name: string;
  source?: string;
  lines: string[];
  location: SourceLocation;
}

export interface ChartDeclaration {
  type: 'ChartDeclaration';
  name: string;
  properties: Record<string, any>;
  location: SourceLocation;
}

export interface FlowDeclaration {
  type: 'FlowDeclaration';
  name: string;
  properties: Record<string, any>;
  nodes: FlowNode[];
  edges: FlowEdge[];
  location: SourceLocation;
}

export interface FlowNode {
  type: 'FlowNode';
  id: string;
  nodeType: string;
  label?: string;
  properties: Record<string, any>;
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
  elements: DiagramElement[];
  location: SourceLocation;
}

export interface DiagramElement {
  type: string;
  name: string;
  properties: Record<string, any>;
}

export interface TableDeclaration {
  type: 'TableDeclaration';
  name: string;
  columns?: string[];
  rows?: Expression;
  location: SourceLocation;
}

export interface Plot3dDeclaration {
  type: 'Plot3dDeclaration';
  name: string;
  properties: Record<string, any>;
  location: SourceLocation;
}

export interface Scene3dDeclaration {
  type: 'Scene3dDeclaration';
  name: string;
  elements: Scene3dElement[];
  location: SourceLocation;
}

export interface Scene3dElement {
  type: string;
  name: string;
  properties: Record<string, any>;
}

export interface ErdDeclaration {
  type: 'ErdDeclaration';
  name: string;
  tables: ErdTable[];
  relationships: ErdRelationship[];
  location: SourceLocation;
}

export interface ErdTable {
  type: 'ErdTable';
  name: string;
  fields: ErdField[];
}

export interface ErdField {
  name: string;
  type: string;
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
  elements: InfraElement[];
  location: SourceLocation;
}

export interface InfraElement {
  type: string;
  name: string;
  properties: Record<string, any>;
}

export interface PageDeclaration {
  type: 'PageDeclaration';
  name: string;
  layout?: string;
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
