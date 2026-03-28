/**
 * Statement parser for package-level parser runtime.
 * Handles control flow, assignment, emit, and expression statements.
 */
import { ParserContext } from './context';

export function parseStatementNode(ctx: ParserContext): any {
  ctx.skipNewlines();
  const token = ctx.peek();

  if (token.type === 'IDENTIFIER') {
    if (ctx.peekAt(1)?.value === '=') {
      return parseAssignment(ctx);
    }
    if (token.value === 'if') {
      return parseIfStatement(ctx);
    }
    if (token.value === 'while') {
      return parseWhileStatement(ctx);
    }
    if (token.value === 'for') {
      return parseForStatement(ctx);
    }
    if (token.value === 'return') {
      return parseReturnStatement(ctx);
    }
    if (token.value === 'break') {
      ctx.advance();
      ctx.expect('NEWLINE');
      return { type: 'BreakStatement', location: ctx.loc() };
    }
    if (token.value === 'continue') {
      ctx.advance();
      ctx.expect('NEWLINE');
      return { type: 'ContinueStatement', location: ctx.loc() };
    }
    if (token.value === 'emit') {
      return parseEmitStatement(ctx);
    }
  }

  const expr = ctx.parseExpression();
  ctx.expect('NEWLINE');
  return { type: 'ExpressionStatement', expression: expr, location: ctx.loc() };
}

function parseAssignment(ctx: ParserContext) {
  const start = ctx.loc();
  const target = ctx.expect('IDENTIFIER').value;
  ctx.expect('EQUALS');
  const value = ctx.parseExpression();
  ctx.expect('NEWLINE');
  return { type: 'AssignmentStatement', target, value, location: { start, end: ctx.currentLocation() } };
}

function parseIfStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const condition = ctx.parseExpression();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  ctx.expect('INDENT');

  const thenBranch: any[] = [];
  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;
    thenBranch.push(ctx.parseStatement());
  }
  ctx.expect('DEDENT');

  const elseIfBranches: { condition: any; body: any[] }[] = [];
  let elseBranch: any[] | undefined;

  while (ctx.peek().value === 'else') {
    ctx.advance();
    if (ctx.peek().value === 'if') {
      ctx.advance();
      const elseIfCond = ctx.parseExpression();
      ctx.expect('COLON');
      ctx.expect('NEWLINE');
      ctx.expect('INDENT');
      const elseIfBody: any[] = [];
      while (!ctx.check('DEDENT') && !ctx.isEof()) {
        ctx.skipNewlines();
        if (ctx.check('DEDENT') || ctx.isEof()) break;
        elseIfBody.push(ctx.parseStatement());
      }
      ctx.expect('DEDENT');
      elseIfBranches.push({ condition: elseIfCond, body: elseIfBody });
    } else {
      ctx.expect('COLON');
      ctx.expect('NEWLINE');
      ctx.expect('INDENT');
      elseBranch = [];
      while (!ctx.check('DEDENT') && !ctx.isEof()) {
        ctx.skipNewlines();
        if (ctx.check('DEDENT') || ctx.isEof()) break;
        elseBranch.push(ctx.parseStatement());
      }
      ctx.expect('DEDENT');
      break;
    }
  }

  return { type: 'IfStatement', condition, thenBranch, elseIfBranches, elseBranch, location: { start, end: ctx.currentLocation() } };
}

function parseWhileStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const condition = ctx.parseExpression();
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

  return { type: 'WhileStatement', condition, body, location: { start, end: ctx.currentLocation() } };
}

function parseForStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const variable = ctx.expect('IDENTIFIER').value;
  ctx.expect('IN');
  const iterable = ctx.parseExpression();
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

  return { type: 'ForStatement', variable, iterable, body, location: { start, end: ctx.currentLocation() } };
}

function parseReturnStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const value = ctx.peek().type !== 'NEWLINE' ? ctx.parseExpression() : undefined;
  ctx.expect('NEWLINE');
  return { type: 'ReturnStatement', value, location: { start, end: ctx.currentLocation() } };
}

function parseEmitStatement(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');

  const fields: { name: string; value: any }[] = [];
  while (true) {
    ctx.skipNewlines();
    if (ctx.peek().type !== 'IDENTIFIER') break;
    const name = ctx.expect('IDENTIFIER').value;
    ctx.expect('EQUALS');
    const value = ctx.parseExpression();
    fields.push({ name, value });
    ctx.expect('NEWLINE');
  }

  return { type: 'EmitStatement', fields, location: { start, end: ctx.currentLocation() } };
}
