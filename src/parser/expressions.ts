import { Token, Expression, SourceLocation, Position } from '../ast/types';
import { KEYWORDS, BLOCK_KEYWORDS } from '../tokenizer/types';

export class ExpressionParser {
  constructor(
    private tokens: Token[],
    private pos: number,
    private peek: () => Token,
    private advance: () => Token,
    private check: (type: string, value?: string) => boolean,
    private loc: () => Position
  ) {}

  parseExpression(): Expression {
    return this.parseConditional();
  }

  private parseConditional(): Expression {
    const start = this.loc();
    const test = this.parseOr();

    if (this.check('OPERATOR', '?')) {
      this.advance();
      const consequent = this.parseExpression();
      this.expect('OPERATOR', ':');
      const alternate = this.parseExpression();
      return {
        type: 'ConditionalExpression',
        test,
        consequent,
        alternate,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return test;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();

    while (this.check('OPERATOR', '||') || this.check('IDENTIFIER', 'or')) {
      const op = this.advance().value;
      const right = this.parseAnd();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator: op === 'or' ? '||' : op,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();

    while (this.check('OPERATOR', '&&') || this.check('IDENTIFIER', 'and')) {
      const op = this.advance().value;
      const right = this.parseEquality();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator: op === 'and' ? '&&' : op,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (this.check('OPERATOR', '==') || this.check('OPERATOR', '!=')) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseTerm();

    while (
      this.check('OPERATOR', '<') ||
      this.check('OPERATOR', '>') ||
      this.check('OPERATOR', '<=') ||
      this.check('OPERATOR', '>=')
    ) {
      const operator = this.advance().value;
      const right = this.parseTerm();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseTerm(): Expression {
    let left = this.parseFactor();

    while (this.check('OPERATOR', '+') || this.check('OPERATOR', '-')) {
      const operator = this.advance().value;
      const right = this.parseFactor();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseFactor(): Expression {
    let left = this.parseUnary();

    while (this.check('OPERATOR', '*') || this.check('OPERATOR', '/') || this.check('OPERATOR', '%')) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parseUnary(): Expression {
    if (this.check('OPERATOR', '-') || this.check('OPERATOR', 'not') || this.check('IDENTIFIER', 'not')) {
      const operator = this.advance().value;
      const operand = this.parseUnary();
      const start = this.loc();
      return {
        type: 'UnaryExpression',
        operator,
        operand,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return this.parsePower();
  }

  private parsePower(): Expression {
    let left = this.parsePostfix();

    if (this.check('OPERATOR', '^')) {
      this.advance();
      const right = this.parseUnary();
      const start = left.location.start;
      left = {
        type: 'BinaryExpression',
        operator: '^',
        left,
        right,
        location: { start, end: this.loc() }
      } as Expression;
    }

    return left;
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check('LPAREN')) {
        const start = expr.location.start;
        this.advance();
        const args: Expression[] = [];

        while (!this.check('RPAREN')) {
          if (args.length > 0) this.expect('COMMA');
          args.push(this.parseExpression());
        }
        this.expect('RPAREN');

        expr = {
          type: 'CallExpression',
          callee: expr,
          args,
          location: { start, end: this.loc() }
        } as Expression;
      } else if (this.check('LBRACKET')) {
        const start = expr.location.start;
        this.advance();
        const index = this.parseExpression();
        this.expect('RBRACKET');

        expr = {
          type: 'IndexExpression',
          object: expr,
          index,
          location: { start, end: this.loc() }
        } as Expression;
      } else if (this.check('PERIOD')) {
        const start = expr.location.start;
        this.advance();
        const property = this.expect('IDENTIFIER').value;

        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          location: { start, end: this.loc() }
        } as Expression;
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.peek();
    const start = token.location.start;

    if (this.check('NUMBER')) {
      this.advance();
      return {
        type: 'Literal',
        value: parseFloat(token.value),
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('STRING')) {
      this.advance();
      return {
        type: 'Literal',
        value: token.value,
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('TRUE') || this.check('FALSE')) {
      this.advance();
      return {
        type: 'Literal',
        value: token.value === 'true',
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('NULL')) {
      this.advance();
      return {
        type: 'Literal',
        value: null,
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    if (this.check('LBRACKET')) {
      this.advance();
      const elements: Expression[] = [];

      while (!this.check('RBRACKET')) {
        if (elements.length > 0) this.expect('COMMA');
        if (this.check('RBRACKET')) break;
        elements.push(this.parseExpression());
      }
      this.expect('RBRACKET');

      return {
        type: 'ArrayExpression',
        elements,
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('LBRACE')) {
      this.advance();
      const properties: { key: string; value: Expression }[] = [];

      while (!this.check('RBRACE')) {
        if (properties.length > 0) this.expect('COMMA');
        const keyToken = this.expect('IDENTIFIER');
        this.expect('COLON');
        const value = this.parseExpression();
        properties.push({ key: keyToken.value, value });
      }
      this.expect('RBRACE');

      return {
        type: 'ObjectExpression',
        properties,
        location: { start, end: this.loc() }
      } as Expression;
    }

    if (this.check('IDENTIFIER')) {
      this.advance();
      return {
        type: 'Identifier',
        name: token.value,
        location: { start, end: this.loc() }
      } as Expression;
    }

    this.error(`Unexpected token: ${token.type}`);
    return {
      type: 'Literal',
      value: null,
      location: { start, end: this.loc() }
    } as Expression;
  }

  private expect(type: string, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      this.error(`Expected ${value ? `${type} '${value}'` : type}, got ${token.type} (${token.value})`);
    }
    return this.advance();
  }

  private error(message: string): void {
    console.error(`Parse error: ${message}`);
  }
}
