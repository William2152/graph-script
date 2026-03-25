import { SourceLocation } from './common';
import { Expression } from './expressions';

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

export const STATEMENT_KEYWORDS = [
  'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'emit'
] as const;
