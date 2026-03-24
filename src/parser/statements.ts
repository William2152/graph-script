import { Token, Statement, Expression, SourceLocation, Position, EmitStatement } from '../ast/types';
import { BLOCK_KEYWORDS } from '../tokenizer/types';
import { ExpressionParser } from './expressions';

export class StatementParser {
  private exprParser: ExpressionParser;

  constructor(
    private tokens: Token[],
    private pos: number,
    private peek: () => Token,
    private advance: () => Token,
    private check: (type: string, value?: string) => boolean,
    private skipNewlines: () => void,
    private loc: () => Position,
    private isAtEnd: () => boolean,
    private currentPos: () => number,
    private error: (msg: string) => void
  ) {
    this.exprParser = new ExpressionParser(
      tokens, pos, peek, advance, check, loc
    );
  }

  setPos(newPos: number): void {
    this.pos = newPos;
  }

  getPos(): number {
    return this.currentPos();
  }

  parseStatement(): Statement {
    const token = this.peek();
    const start = token.location.start;

    if (this.check('IDENTIFIER', 'if')) {
      return this.parseIfStatement();
    }

    if (this.check('IDENTIFIER', 'while')) {
      return this.parseWhileStatement();
    }

    if (this.check('IDENTIFIER', 'for')) {
      return this.parseForStatement();
    }

    if (this.check('IDENTIFIER', 'return')) {
      return this.parseReturnStatement();
    }

    if (this.check('IDENTIFIER', 'break')) {
      this.advance();
      return {
        type: 'BreakStatement',
        location: { start, end: this.loc() }
      } as Statement;
    }

    if (this.check('IDENTIFIER', 'continue')) {
      this.advance();
      return {
        type: 'ContinueStatement',
        location: { start, end: this.loc() }
      } as Statement;
    }

    if (this.check('IDENTIFIER', 'emit')) {
      return this.parseEmitStatement();
    }

    if (this.check('IDENTIFIER') && this.peekAt(1)?.type === 'EQUALS') {
      return this.parseAssignment();
    }

    if (this.check('IDENTIFIER')) {
      const name = this.advance().value;

      if (this.check('LPAREN')) {
        return this.parseFunctionCall(name);
      }

      return this.parseAssignmentTo(name);
    }

    const expr = this.exprParser.parseExpression();
    return {
      type: 'ExpressionStatement',
      expression: expr,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseAssignment(): Statement {
    const start = this.loc();
    const target = this.advance().value;
    this.expect('EQUALS');
    const value = this.exprParser.parseExpression();

    return {
      type: 'AssignmentStatement',
      target,
      value,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseAssignmentTo(name: string): Statement {
    const start = this.loc();
    this.expect('EQUALS');
    const value = this.exprParser.parseExpression();

    return {
      type: 'AssignmentStatement',
      target: name,
      value,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseFunctionCall(name: string): Statement {
    const start = this.loc();
    this.expect('LPAREN');
    const args: Expression[] = [];

    while (!this.check('RPAREN')) {
      if (args.length > 0) this.expect('COMMA');
      args.push(this.exprParser.parseExpression());
    }
    this.expect('RPAREN');

    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: name,
        args,
        location: { start, end: this.loc() }
      } as Expression,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseIfStatement(): Statement {
    const start = this.loc();
    this.advance();
    const condition = this.exprParser.parseExpression();
    this.expect('COLON');
    this.skipNewlines();

    const thenBranch = this.parseBlock();

    const elseIfBranches: { condition: Expression; body: Statement[] }[] = [];
    let elseBranch: Statement[] | undefined;

    while (this.check('IDENTIFIER', 'else')) {
      this.advance();

      if (this.check('IDENTIFIER', 'if')) {
        this.advance();
        const elseIfCond = this.exprParser.parseExpression();
        this.expect('COLON');
        this.skipNewlines();
        const elseIfBody = this.parseBlock();
        elseIfBranches.push({ condition: elseIfCond, body: elseIfBody });
      } else {
        this.expect('COLON');
        this.skipNewlines();
        elseBranch = this.parseBlock();
        break;
      }
    }

    return {
      type: 'IfStatement',
      condition,
      thenBranch,
      elseIfBranches,
      elseBranch,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseWhileStatement(): Statement {
    const start = this.loc();
    this.advance();
    const condition = this.exprParser.parseExpression();
    this.expect('COLON');
    this.skipNewlines();
    const body = this.parseBlock();

    return {
      type: 'WhileStatement',
      condition,
      body,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseForStatement(): Statement {
    const start = this.loc();
    this.advance();
    const variable = this.expect('IDENTIFIER').value;
    this.expect('IDENTIFIER', 'in');
    const iterable = this.exprParser.parseExpression();
    this.expect('COLON');
    this.skipNewlines();
    const body = this.parseBlock();

    return {
      type: 'ForStatement',
      variable,
      iterable,
      body,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseReturnStatement(): Statement {
    const start = this.loc();
    this.advance();
    let value: Expression | undefined;

    if (!this.check('NEWLINE') && !this.check('IDENTIFIER', 'end') && !this.isAtEnd()) {
      value = this.exprParser.parseExpression();
    }

    return {
      type: 'ReturnStatement',
      value,
      location: { start, end: this.loc() }
    } as Statement;
  }

  private parseEmitStatement(): EmitStatement {
    const start = this.loc();
    this.advance();
    this.expect('COLON');
    this.skipNewlines();

    const fields: { name: string; value: Expression }[] = [];
    const emitKeywords = new Set(['if', 'else', 'while', 'for', 'return', 'break', 'continue', 'emit', 'end']);

    while (this.check('IDENTIFIER') && !emitKeywords.has(this.peek().value)) {
      const name = this.advance().value;
      this.expect('EQUALS');
      const value = this.exprParser.parseExpression();
      fields.push({ name, value });
      this.skipNewlines();
    }

    return {
      type: 'EmitStatement',
      fields,
      location: { start, end: this.loc() }
    } as EmitStatement;
  }

  private parseBlock(): Statement[] {
    const body: Statement[] = [];
    let depth = 1;

    while (!this.isAtEnd() && depth > 0) {
      this.skipNewlines();

      if (this.check('IDENTIFIER', 'end')) {
        this.advance();
        depth--;
        break;
      }

      if (this.check('IDENTIFIER', 'else')) {
        if (this.peekAt(1)?.value !== 'if') {
          break;
        }
      }

      if (this.check('IDENTIFIER', 'if')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'while')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'for')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'emit')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'return')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'break')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER', 'continue')) {
        body.push(this.parseStatement());
        continue;
      }

      if (this.check('IDENTIFIER')) {
        const name = this.advance().value;

        if (this.check('LPAREN')) {
          body.push(this.parseFunctionCall(name));
        } else if (this.check('EQUALS')) {
          body.push(this.parseAssignmentTo(name));
        } else {
          body.push(this.exprParser.parseExpression() as any);
        }
        continue;
      }

      const expr = this.exprParser.parseExpression();
      body.push({
        type: 'ExpressionStatement',
        expression: expr,
        location: expr.location
      } as Statement);
    }

    return body;
  }

  private expect(type: string, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      this.error(`Expected ${value ? `${type} '${value}'` : type}, got ${token.type} (${token.value})`);
    }
    return this.advance();
  }

  private peekAt(offset: number): Token | undefined {
    return this.tokens[this.currentPos() + offset];
  }
}
