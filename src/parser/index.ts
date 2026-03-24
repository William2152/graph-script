import { Token, Program, Position, SourceLocation } from '../ast/types';
import { Tokenizer } from '../tokenizer';
import { StatementParser } from './statements';
import { DeclarationParser } from './declarations';
import { Statement, TopLevelNode } from '../ast/types';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private stmtParser!: StatementParser;
  private declParser!: DeclarationParser;

  parse(source: string): Program {
    const tokenizer = new Tokenizer();
    this.tokens = tokenizer.tokenize(source);
    this.pos = 0;
    this.initParsers();
    return this.declParser.parseProgram();
  }

  private initParsers(): void {
    this.stmtParser = new StatementParser(
      this.tokens,
      this.pos,
      () => this.peek(),
      () => this.advance(),
      (type, value) => this.check(type, value),
      () => this.skipNewlines(),
      () => this.loc(),
      () => this.isAtEnd(),
      () => this.pos,
      (msg) => this.error(msg)
    );

    this.declParser = new DeclarationParser(
      this.tokens,
      () => this.peek(),
      () => this.advance(),
      (type, value) => this.check(type, value),
      () => this.skipNewlines(),
      () => this.loc(),
      () => this.isAtEnd(),
      (msg) => this.error(msg),
      () => this.stmtParser.parseStatement()
    );
  }

  private peek(): Token {
    return this.tokens[this.pos] || {
      type: 'EOF',
      value: '',
      location: { start: this.loc(), end: this.loc() }
    };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: string, value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private loc(): Position {
    return this.peek().location.start;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === 'EOF';
  }

  private error(message: string): void {
    const token = this.peek();
    console.error(`Parse error at ${token.location.start.line}:${token.location.start.column}: ${message}`);
  }
}
