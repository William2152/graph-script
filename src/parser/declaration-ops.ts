import { Expression, SourceLocation, Statement, TopLevelNode } from '../ast/types';
import { LineInfo } from './line-types';

/**
 * Shared parser operation contracts used by declaration modules.
 * This keeps declaration parsing decoupled from concrete parser state storage.
 */
export interface DeclarationParserOps {
  parseTopLevelBlock(indent: number): TopLevelNode[];
  parseStatementSuite(parentIndent: number): Statement[];

  peekMeaningful(): LineInfo | null;
  advanceLine(): void;
  eof(): boolean;
  nextChildIndent(parentIndent: number): number | null;

  parseExpressionText(text: string, lineNumber: number): Expression;
  parseInlineString(text: string): string;
  splitCommaArgs(raw: string): string[];
  lineLoc(line: LineInfo): SourceLocation;

  parsePropertyBlock(parentIndent: number): Record<string, Expression>;
  isPropertyLine(text: string): boolean;
  splitHeaderAndChildren(text: string): { header: string; hasChildren: boolean };
  parseAttributeExpressions(raw: string, lineNumber: number): Record<string, Expression>;
  parseTitledBlockName(rest: string, lineNumber: number): string;
  parseSimpleAttributes(raw: string): Record<string, string>;
}
