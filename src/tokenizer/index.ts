import { Token, Position, SourceLocation, TokenType } from '../ast/types';
import { KEYWORDS, BLOCK_KEYWORDS } from './types';

export class Tokenizer {
  private source: string = '';
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  tokenize(source: string): Token[] {
    this.source = source;
    this.reset();
    this.scanAll();
    return this.tokens;
  }

  private reset(): void {
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  private scanAll(): void {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const start = this.currentPos();

      if (this.match('#')) {
        this.scanComment();
        continue;
      }

      if (this.match('\n') || this.match('\r')) {
        this.addToken('NEWLINE', '\n', start);
        this.advance();
        if (this.match('\n')) this.advance();
        continue;
      }

      if (this.match('"') || this.match("'")) {
        this.scanString(start);
        continue;
      }

      if (this.isDigit(this.peek())) {
        this.scanNumber(start);
        continue;
      }

      if (this.isAlpha(this.peek()) || this.peek() === '_') {
        this.scanIdentifier(start);
        continue;
      }

      if (this.scanOperator(start)) continue;

      if (this.scanBracket(start)) continue;

      this.error(`Unexpected character: ${this.peek()}`);
      this.advance();
    }

    this.addToken('EOF', '', this.currentPos());
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && ' \t\r'.includes(this.peek())) {
      this.advance();
    }
  }

  private scanComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private scanString(start: Position): void {
    const quote = this.peek();
    this.advance();
    let value = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\' && !this.isAtEnd()) {
        this.advance();
        const ch = this.peek();
        if (ch === 'n') value += '\n';
        else if (ch === 't') value += '\t';
        else if (ch === 'r') value += '\r';
        else value += ch;
      } else {
        value += this.peek();
      }
      this.advance();
    }

    if (!this.isAtEnd()) this.advance();
    this.addToken('STRING', value, start);
  }

  private scanNumber(start: Position): void {
    let value = '';

    while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === '.')) {
      if (this.peek() === '.' && !this.isDigit(this.source[this.pos + 1])) break;
      value += this.peek();
      this.advance();
    }

    this.addToken('NUMBER', value, start);
  }

  private scanIdentifier(start: Position): void {
    let value = '';

    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      value += this.peek();
      this.advance();
    }

    if (KEYWORDS.has(value)) {
      this.addToken(value.toUpperCase() as TokenType, value, start);
    } else if (BLOCK_KEYWORDS.has(value)) {
      this.addToken(value.toUpperCase() as TokenType, value, start);
    } else {
      this.addToken('IDENTIFIER', value, start);
    }
  }

  private scanOperator(start: Position): boolean {
    const ch = this.peek();

    if ('+-*/%^<>!&|'.includes(ch)) {
      let value = ch;

      if (ch === '-' && this.peekNext() === '>') {
        this.advance();
        value = '->';
        this.addToken('ARROW', value, start);
        return true;
      }

      if (ch === '=' && this.peekNext() === '=') {
        this.advance();
        value = '==';
      } else if (ch === '!' && this.peekNext() === '=') {
        this.advance();
        value = '!=';
      } else if (ch === '<' && this.peekNext() === '=') {
        this.advance();
        value = '<=';
      } else if (ch === '>' && this.peekNext() === '=') {
        this.advance();
        value = '>=';
      } else if (ch === '&' && this.peekNext() === '&') {
        this.advance();
        value = '&&';
      } else if (ch === '|' && this.peekNext() === '|') {
        this.advance();
        value = '||';
      } else {
        this.advance();
      }

      this.addToken('OPERATOR', value, start);
      return true;
    }

    return false;
  }

  private scanBracket(start: Position): boolean {
    const ch = this.peek();

    switch (ch) {
      case '[': this.advance(); this.addToken('LBRACKET', '[', start); return true;
      case ']': this.advance(); this.addToken('RBRACKET', ']', start); return true;
      case '(': this.advance(); this.addToken('LPAREN', '(', start); return true;
      case ')': this.advance(); this.addToken('RPAREN', ')', start); return true;
      case '{': this.advance(); this.addToken('LBRACE', '{', start); return true;
      case '}': this.advance(); this.addToken('RBRACE', '}', start); return true;
      case ':': this.advance(); this.addToken('COLON', ':', start); return true;
      case ',': this.advance(); this.addToken('COMMA', ',', start); return true;
      case '|': this.advance(); this.addToken('PIPE', '|', start); return true;
      case '.': this.advance(); this.addToken('PERIOD', '.', start); return true;
      case '=':
        this.advance();
        this.addToken('EQUALS', '=', start);
        return true;
    }

    return false;
  }

  private peek(): string {
    return this.source[this.pos];
  }

  private peekNext(): string {
    return this.source[this.pos + 1] || '';
  }

  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private match(expected: string): boolean {
    return this.peek() === expected;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
  }

  private isAlpha(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isAlphaNumeric(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }

  private currentPos(): Position {
    return {
      line: this.line,
      column: this.column,
      offset: this.pos
    };
  }

  private addToken(type: TokenType, value: string, start: Position): void {
    this.tokens.push({
      type,
      value,
      location: {
        start,
        end: this.currentPos()
      }
    });
  }

  private error(message: string): void {
    console.error(`Tokenizer error at ${this.line}:${this.column}: ${message}`);
  }
}
