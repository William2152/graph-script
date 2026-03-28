import { AstNode } from '@graphscript/ast';
import { ParserContext } from './context';

type TopLevelParser = (ctx: ParserContext) => AstNode | null;

const TOP_LEVEL_PARSERS: Record<string, TopLevelParser> = {
  use: parseUseStatement,
  import: parseImportStatement,
  const: parseConstDeclaration,
  data: parseDataDeclaration,
  func: parseFuncDeclaration,
  theme: parseThemeDeclaration,
  style: parseStyleDeclaration,
  sub: parseSubDeclaration,
  component: parseComponentDeclaration,
  algo: parseAlgoDeclaration,
  pseudo: parsePseudoDeclaration,
};

/**
 * Handles core declarations unrelated to specific rendering domains.
 */
export function parseCoreTopLevelDeclaration(ctx: ParserContext, keyword: string): AstNode | null {
  const parser = TOP_LEVEL_PARSERS[keyword];
  return parser ? parser(ctx) : null;
}

function parseUseStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const module = ctx.expect('IDENTIFIER').value;
  ctx.expect('NEWLINE');
  return { type: 'UseStatement', module, location: { start, end: ctx.currentLocation() } };
}

function parseImportStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const path = ctx.expect('STRING').value;
  ctx.expect('NEWLINE');
  return { type: 'ImportStatement', path, location: { start, end: ctx.currentLocation() } };
}

function parseConstDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('EQUALS');
  const value = ctx.parseExpression();
  ctx.expect('NEWLINE');
  return { type: 'ConstDeclaration', name, value, location: { start, end: ctx.currentLocation() } };
}

function parseDataDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');

  const bindings: { name: string; value: any }[] = [];
  while (true) {
    ctx.skipNewlines();
    if (ctx.peek().type !== 'IDENTIFIER') break;
    const name = ctx.expect('IDENTIFIER').value;
    ctx.expect('EQUALS');
    const value = ctx.parseExpression();
    bindings.push({ name, value });
    ctx.expect('NEWLINE');
  }

  return { type: 'DataDeclaration', bindings, location: { start, end: ctx.currentLocation() } };
}

function parseFuncDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('LPAREN');
  const params: string[] = [];
  while (!ctx.check('RPAREN')) {
    if (params.length > 0) ctx.expect('COMMA');
    params.push(ctx.expect('IDENTIFIER').value);
  }
  ctx.expect('RPAREN');
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  ctx.expect('INDENT');

  const body: any[] = [];
  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;
    body.push(ctx.parseStatement());
  }
  ctx.expect('DEDENT');

  return { type: 'FuncDeclaration', name, params, body, location: { start, end: ctx.currentLocation() } };
}

function parseThemeDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  const properties = ctx.parseBlockProperties();
  return { type: 'ThemeDeclaration', name, properties, location: { start, end: ctx.currentLocation() } };
}

function parseStyleDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  const properties = ctx.parseBlockProperties();
  return { type: 'StyleDeclaration', name, properties, location: { start, end: ctx.currentLocation() } };
}

function parseSubDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('LPAREN');
  const params: string[] = [];
  while (!ctx.check('RPAREN')) {
    if (params.length > 0) ctx.expect('COMMA');
    params.push(ctx.expect('IDENTIFIER').value);
  }
  ctx.expect('RPAREN');
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  ctx.expect('INDENT');

  const body: AstNode[] = [];
  const exports: { name: string; value: string }[] = [];
  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;
    const stmt = ctx.parseTopLevel();
    if (!stmt) continue;
    body.push(stmt);
    if ((stmt as any).type === 'ExportStatement') {
      exports.push({ name: (stmt as any).name, value: (stmt as any).value });
    }
  }
  ctx.expect('DEDENT');

  return { type: 'SubDeclaration', name, params, body, exports, location: { start, end: ctx.currentLocation() } };
}

function parseComponentDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('EQUALS');
  const module = ctx.expect('IDENTIFIER').value;
  ctx.expect('LPAREN');
  const args: Record<string, any> = {};
  while (!ctx.check('RPAREN')) {
    if (Object.keys(args).length > 0) ctx.expect('COMMA');
    const key = ctx.expect('IDENTIFIER').value;
    ctx.expect('EQUALS');
    args[key] = ctx.parseExpression();
  }
  ctx.expect('RPAREN');
  ctx.expect('NEWLINE');
  return { type: 'ComponentDeclaration', name, module, args, location: { start, end: ctx.currentLocation() } };
}

function parseAlgoDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const name = ctx.expect('IDENTIFIER').value;
  ctx.expect('LPAREN');
  const params: string[] = [];
  while (!ctx.check('RPAREN')) {
    if (params.length > 0) ctx.expect('COMMA');
    params.push(ctx.expect('IDENTIFIER').value);
  }
  ctx.expect('RPAREN');
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  ctx.expect('INDENT');

  const body: any[] = [];
  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;
    body.push(ctx.parseStatement());
  }
  ctx.expect('DEDENT');

  return { type: 'AlgoDeclaration', name, params, body, location: { start, end: ctx.currentLocation() } };
}

function parsePseudoDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const nameToken = ctx.peek();
  const name = nameToken.type === 'STRING' ? nameToken.value : ctx.expect('IDENTIFIER').value;
  if (nameToken.type === 'STRING') ctx.advance();

  const lines: string[] = [];
  if (ctx.check('FROM')) {
    ctx.advance();
    lines.push(ctx.expect('IDENTIFIER').value);
  } else if (ctx.check('COLON')) {
    ctx.advance();
    ctx.expect('NEWLINE');
    ctx.expect('INDENT');
    while (!ctx.check('DEDENT') && !ctx.isEof()) {
      ctx.skipNewlines();
      if (ctx.check('DEDENT') || ctx.isEof()) break;
      const lineToken = ctx.peek();
      if (lineToken.type === 'STRING') {
        lines.push(lineToken.value);
        ctx.advance();
      } else {
        lines.push(ctx.expect('IDENTIFIER').value);
      }
      ctx.expect('NEWLINE');
    }
    if (ctx.check('DEDENT')) ctx.advance();
  } else {
    ctx.expect('NEWLINE');
  }

  return {
    type: 'PseudoDeclaration',
    name,
    source: lines[0],
    lines: lines.slice(1),
    location: { start, end: ctx.currentLocation() },
  };
}
