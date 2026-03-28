import {
  EmitStatement,
  Expression,
  IfStatement,
  SourceLocation,
  Statement,
} from '../ast/types';
import { LineInfo } from './line-types';
import { LineParserUtils } from './line-utils';

type IndexRef = { value: number };

/**
 * Parses statement suites used by `func` and `algo` declarations.
 */
export class StatementBlockParser {
  constructor(
    private lines: LineInfo[],
    private indexRef: IndexRef,
  ) {}

  parseStatementSuite(parentIndent: number): Statement[] {
    const childIndent = LineParserUtils.nextChildIndent(this.lines, this.indexRef.value, parentIndent);
    if (childIndent === null) return [];
    return this.parseStatements(childIndent);
  }

  private parseStatements(indent: number): Statement[] {
    const statements: Statement[] = [];

    while (!this.eof()) {
      const line = this.peekMeaningful();
      if (!line) break;
      if (line.indent < indent) break;
      if (line.indent > indent) {
        this.indexRef.value += 1;
        continue;
      }
      if (line.text.startsWith('else')) break;
      statements.push(this.parseStatement(line, indent));
    }

    return statements;
  }

  private parseStatement(line: LineInfo, indent: number): Statement {
    const text = line.text;

    if (text.startsWith('if ') && text.endsWith(':')) return this.parseIfStatement(line, indent);
    if (text.startsWith('while ') && text.endsWith(':')) return this.parseWhileStatement(line);
    if (text.startsWith('for ') && text.endsWith(':')) return this.parseForStatement(line);
    if (text === 'emit:') return this.parseEmitStatement(line);
    if (text === 'break') {
      this.indexRef.value += 1;
      return { type: 'BreakStatement', location: this.lineLoc(line) };
    }
    if (text === 'continue') {
      this.indexRef.value += 1;
      return { type: 'ContinueStatement', location: this.lineLoc(line) };
    }
    if (text.startsWith('return')) {
      this.indexRef.value += 1;
      const rest = text.slice('return'.length).trim();
      return {
        type: 'ReturnStatement',
        value: rest ? this.parseExpressionText(rest, line.line) : undefined,
        location: this.lineLoc(line),
      };
    }

    const assign = text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
    if (assign) {
      this.indexRef.value += 1;
      return {
        type: 'AssignmentStatement',
        target: assign[1],
        value: this.parseExpressionText(assign[2], line.line),
        location: this.lineLoc(line),
      };
    }

    this.indexRef.value += 1;
    const expression = this.parseExpressionText(text, line.line);
    return { type: 'ExpressionStatement', expression, location: this.lineLoc(line) };
  }

  private parseIfStatement(line: LineInfo, indent: number): IfStatement {
    const conditionText = line.text.slice(2, -1).trim();
    this.indexRef.value += 1;
    const thenBranch = this.parseStatementSuite(indent);
    const elseIfBranches: { condition: Expression; body: Statement[] }[] = [];
    let elseBranch: Statement[] | undefined;

    while (!this.eof()) {
      const current = this.peekMeaningful();
      if (!current || current.indent !== indent) break;
      if (current.text.startsWith('else if ') && current.text.endsWith(':')) {
        const condText = current.text.slice('else if'.length, -1).trim();
        this.indexRef.value += 1;
        elseIfBranches.push({
          condition: this.parseExpressionText(condText, current.line),
          body: this.parseStatementSuite(indent),
        });
        continue;
      }
      if (current.text === 'else:') {
        this.indexRef.value += 1;
        elseBranch = this.parseStatementSuite(indent);
      }
      break;
    }

    return {
      type: 'IfStatement',
      condition: this.parseExpressionText(conditionText, line.line),
      thenBranch,
      elseIfBranches,
      elseBranch,
      location: this.lineLoc(line),
    };
  }

  private parseWhileStatement(line: LineInfo): Statement {
    const conditionText = line.text.slice('while'.length, -1).trim();
    this.indexRef.value += 1;
    return {
      type: 'WhileStatement',
      condition: this.parseExpressionText(conditionText, line.line),
      body: this.parseStatementSuite(line.indent),
      location: this.lineLoc(line),
    };
  }

  private parseForStatement(line: LineInfo): Statement {
    const match = line.text.match(/^for\s+([A-Za-z_][\w]*)\s+in\s+(.+):$/);
    if (!match) throw new Error(`Invalid for statement at line ${line.line}`);
    this.indexRef.value += 1;
    return {
      type: 'ForStatement',
      variable: match[1],
      iterable: this.parseExpressionText(match[2], line.line),
      body: this.parseStatementSuite(line.indent),
      location: this.lineLoc(line),
    };
  }

  private parseEmitStatement(line: LineInfo): EmitStatement {
    this.indexRef.value += 1;
    const childIndent = LineParserUtils.nextChildIndent(this.lines, this.indexRef.value, line.indent);
    const fields: { name: string; value: Expression }[] = [];
    if (childIndent !== null) {
      while (!this.eof()) {
        const current = this.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        const match = current.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
        if (!match) throw new Error(`Invalid emit field at line ${current.line}`);
        fields.push({ name: match[1], value: this.parseExpressionText(match[2], current.line) });
        this.indexRef.value += 1;
      }
    }
    return { type: 'EmitStatement', fields, location: this.lineLoc(line) };
  }

  private parseExpressionText(text: string, lineNumber: number): Expression {
    return LineParserUtils.parseExpressionText(text, lineNumber);
  }

  private lineLoc(line: LineInfo): SourceLocation {
    return LineParserUtils.lineLoc(line);
  }

  private peekMeaningful(): LineInfo | null {
    while (this.indexRef.value < this.lines.length) {
      const line = this.lines[this.indexRef.value];
      if (!line.text || line.text.startsWith('#')) {
        this.indexRef.value += 1;
        continue;
      }
      return line;
    }
    return null;
  }

  private eof(): boolean {
    return this.indexRef.value >= this.lines.length;
  }
}
