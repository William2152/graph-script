import { AstNode, Position, Program, SourceLocation, Token, TokenType } from '@graphscript/ast';
import { Tokenizer } from './tokenizer';
import { parseExpressionNode } from './parser/expressions';
import { parseStatementNode } from './parser/statements';
import { parseTopLevelDeclaration } from './parser/top-level';
import { ParserContext } from './parser/context';

/**
 * Core parser orchestrator.
 * Grammar details are delegated to `parser/*` modules to keep this class small.
 */
export class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(source: string): Program {
    const tokenizer = new Tokenizer();
    this.tokens = tokenizer.tokenize(source);
    this.pos = 0;
    return this.parseProgram();
  }

  private parseProgram(): Program {
    const body: AstNode[] = [];
    const start = this.currentLocation();

    while (!this.isEof()) {
      this.skipNewlines();
      if (this.isEof()) break;

      const stmt = this.parseTopLevel();
      if (stmt) body.push(stmt);
    }

    return {
      type: 'Program',
      body,
      location: { start, end: this.currentLocation() },
    };
  }

  private parseTopLevel(): AstNode | null {
    return parseTopLevelDeclaration(this.createContext());
  }

  private parseStatement(): any {
    return parseStatementNode(this.createContext());
  }

  private parseExpression(): any {
    return parseExpressionNode(this.createContext());
  }

  private parseBlockProperties(): Record<string, any> {
    const props: Record<string, any> = {};
    this.expect('INDENT');
    while (!this.check('DEDENT') && !this.isEof()) {
      this.skipNewlines();
      if (this.check('DEDENT') || this.isEof()) break;
      const key = this.expect('IDENTIFIER').value;
      this.expect('EQUALS');
      props[key] = this.parseExpression();
      this.expect('NEWLINE');
    }
    if (this.check('DEDENT')) this.advance();
    return props;
  }

  private parseDiagramElements(): any[] {
    const elements: any[] = [];
    this.expect('INDENT');
    while (!this.check('DEDENT') && !this.isEof()) {
      this.skipNewlines();
      if (this.check('DEDENT') || this.isEof()) break;
      const type = this.expect('IDENTIFIER').value;
      const name = this.expect('IDENTIFIER').value;
      const props: Record<string, any> = {};
      while (!this.check('NEWLINE') && !this.isEof()) {
        const key = this.peek();
        if (key.type === 'IDENTIFIER') {
          this.advance();
          if (this.check('EQUALS')) {
            this.advance();
            props[key.value] = this.parseExpression();
          } else {
            props[key.value] = true;
          }
        } else {
          break;
        }
      }
      this.expect('NEWLINE');
      elements.push({ type, name, properties: props });
    }
    if (this.check('DEDENT')) this.advance();
    return elements;
  }

  private createContext(): ParserContext {
    return {
      parseTopLevel: () => this.parseTopLevel(),
      parseStatement: () => this.parseStatement(),
      parseExpression: () => this.parseExpression(),
      parseBlockProperties: () => this.parseBlockProperties(),
      parseDiagramElements: () => this.parseDiagramElements(),
      peek: () => this.peek(),
      peekAt: (offset) => this.peekAt(offset),
      advance: () => this.advance(),
      check: (type) => this.check(type),
      expect: (type) => this.expect(type),
      isEof: () => this.isEof(),
      skipNewlines: () => this.skipNewlines(),
      loc: () => this.loc(),
      currentLocation: () => this.currentLocation(),
      error: (message) => this.error(message),
    };
  }

  private peek(): Token {
    return (
      this.tokens[this.pos] || {
        type: 'EOF',
        value: '',
        location: {
          start: { line: 0, column: 0, offset: 0 },
          end: { line: 0, column: 0, offset: 0 },
        },
      }
    );
  }

  private peekAt(offset: number): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: TokenType | string): boolean {
    return this.peek().type === type || this.peek().value === type;
  }

  private expect(type: TokenType | string): Token {
    const token = this.peek();
    if (token.type === type || token.value === type) {
      return this.advance();
    }
    this.error(`Expected ${type}, got ${token.type} (${token.value})`);
    return token;
  }

  private isEof(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === 'EOF';
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private loc(): SourceLocation {
    return this.peek().location;
  }

  private currentLocation(): Position {
    return this.peek().location.end;
  }

  private error(message: string): void {
    console.error(
      `Parse error at ${this.peek().location.start.line}:${this.peek().location.start.column}: ${message}`,
    );
  }
}
