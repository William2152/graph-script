import { ParserContext } from './context';

interface HeaderOptions {
  consumeIndent?: boolean;
}

export interface NamedDeclarationHeader {
  start: any;
  name: string;
}

/**
 * Parses `<keyword> <name>:` header used by many top-level declarations.
 */
export function advanceNamedDeclarationHeader(
  ctx: ParserContext,
  options: HeaderOptions = {},
): NamedDeclarationHeader {
  ctx.advance();
  const start = ctx.loc();
  const nameToken = ctx.peek();
  const name = nameToken.type === 'STRING' ? nameToken.value : ctx.expect('IDENTIFIER').value;
  if (nameToken.type === 'STRING') ctx.advance();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  if (options.consumeIndent) {
    ctx.expect('INDENT');
  }
  return { start, name };
}
