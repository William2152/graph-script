import { AstNode, Position, SourceLocation, Token, TokenType } from '@graphscript/ast';

/**
 * Narrow parser context passed to modular parser helpers.
 * This keeps helper modules independent from the concrete Parser class.
 */
export interface ParserContext {
  parseTopLevel(): AstNode | null;
  parseStatement(): any;
  parseExpression(): any;
  parseBlockProperties(): Record<string, any>;
  parseDiagramElements(): any[];

  peek(): Token;
  peekAt(offset: number): Token | undefined;
  advance(): Token;
  check(type: TokenType | string): boolean;
  expect(type: TokenType | string): Token;
  isEof(): boolean;
  skipNewlines(): void;
  loc(): SourceLocation;
  currentLocation(): Position;
  error(message: string): void;
}
