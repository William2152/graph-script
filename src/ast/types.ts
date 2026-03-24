export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export type TokenType =
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'NULL'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'COLON'
  | 'COMMA'
  | 'PIPE'
  | 'ARROW'
  | 'EQUALS'
  | 'OPERATOR'
  | 'COMMENT'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'PERIOD'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

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
  elements: DiagramElement[];
  location: SourceLocation;
}

export interface DiagramElement {
  type: string;
  name: string;
  properties: Record<string, Expression>;
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
  elements: Scene3dElement[];
  location: SourceLocation;
}

export interface Scene3dElement {
  type: string;
  name: string;
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
  elements: InfraElement[];
  location: SourceLocation;
}

export interface InfraElement {
  type: string;
  name: string;
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

export type Expression =
  | Identifier
  | Literal
  | ArrayExpression
  | ObjectExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ConditionalExpression;

export interface Identifier {
  type: 'Identifier';
  name: string;
  location: SourceLocation;
}

export interface Literal {
  type: 'Literal';
  value: string | number | boolean | null;
  location: SourceLocation;
}

export interface ArrayExpression {
  type: 'ArrayExpression';
  elements: Expression[];
  location: SourceLocation;
}

export interface ObjectExpression {
  type: 'ObjectExpression';
  properties: { key: string; value: Expression }[];
  location: SourceLocation;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
  location: SourceLocation;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: Expression | string;
  args: Expression[];
  location: SourceLocation;
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: string;
  location: SourceLocation;
}

export interface IndexExpression {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
  location: SourceLocation;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
  location: SourceLocation;
}

export type Statement =
  | ExpressionStatement
  | AssignmentStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | EmitStatement;

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
  location: SourceLocation;
}

export interface AssignmentStatement {
  type: 'AssignmentStatement';
  target: string;
  value: Expression;
  location: SourceLocation;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  thenBranch: Statement[];
  elseIfBranches?: { condition: Expression; body: Statement[] }[];
  elseBranch?: Statement[];
  location: SourceLocation;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  value?: Expression;
  location: SourceLocation;
}

export interface BreakStatement {
  type: 'BreakStatement';
  location: SourceLocation;
}

export interface ContinueStatement {
  type: 'ContinueStatement';
  location: SourceLocation;
}

export interface EmitStatement {
  type: 'EmitStatement';
  fields: { name: string; value: Expression }[];
  location: SourceLocation;
}

export const TOP_LEVEL_KEYWORDS = [
  'use', 'import', 'const', 'data', 'func', 'theme', 'style', 'sub',
  'component', 'algo', 'chart', 'flow', 'diagram', 'table', 'plot3d',
  'scene3d', 'erd', 'infra', 'page', 'render'
] as const;

export const STATEMENT_KEYWORDS = [
  'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'emit', 'end'
] as const;
