/**
 * Expression parser for package-level parser runtime.
 * Produces AST nodes for unary/binary/call/member/index expression forms.
 */
import { ParserContext } from './context';

const BINARY_OPERATORS = ['+', '-', '*', '/', '%', '^', '==', '!=', '<', '>', '<=', '>=', 'and', 'or'];

export function parseExpressionNode(ctx: ParserContext): any {
  return parseBinary(ctx);
}

function parseBinary(ctx: ParserContext): any {
  let left = parseUnary(ctx);

  while (ctx.peek().type === 'OPERATOR' || ctx.peek().type === 'IDENTIFIER') {
    const operator = ctx.peek().value;
    if (!BINARY_OPERATORS.includes(operator)) {
      break;
    }
    ctx.advance();
    const right = parseUnary(ctx);
    left = { type: 'BinaryExpression', operator, left, right, location: ctx.loc() };
  }

  return left;
}

function parseUnary(ctx: ParserContext): any {
  if (ctx.peek().type === 'OPERATOR' && ['-', 'not'].includes(ctx.peek().value)) {
    const operator = ctx.peek().value;
    ctx.advance();
    const operand = parseUnary(ctx);
    return { type: 'UnaryExpression', operator, operand, location: ctx.loc() };
  }
  return parsePostfix(ctx);
}

function parsePostfix(ctx: ParserContext): any {
  let expr = parsePrimary(ctx);

  while (true) {
    if (ctx.check('LPAREN')) {
      ctx.advance();
      const args: any[] = [];
      while (!ctx.check('RPAREN')) {
        if (args.length > 0) ctx.expect('COMMA');
        args.push(parseExpressionNode(ctx));
      }
      ctx.expect('RPAREN');
      expr = { type: 'CallExpression', callee: expr, args, location: ctx.loc() };
    } else if (ctx.check('LBRACKET')) {
      ctx.advance();
      const index = parseExpressionNode(ctx);
      ctx.expect('RBRACKET');
      expr = { type: 'MemberExpression', object: expr, property: index, location: ctx.loc() };
    } else if (ctx.check('PERIOD')) {
      ctx.advance();
      const property = ctx.expect('IDENTIFIER').value;
      expr = { type: 'MemberExpression', object: expr, property, location: ctx.loc() };
    } else {
      break;
    }
  }

  return expr;
}

function parsePrimary(ctx: ParserContext): any {
  const token = ctx.peek();

  if (token.type === 'NUMBER') {
    ctx.advance();
    return { type: 'Literal', value: parseFloat(token.value), location: token.location };
  }

  if (token.type === 'STRING') {
    ctx.advance();
    return { type: 'Literal', value: token.value, location: token.location };
  }

  if (token.type === 'BOOLEAN') {
    ctx.advance();
    return { type: 'Literal', value: token.value === 'true', location: token.location };
  }

  if (token.type === 'NULL') {
    ctx.advance();
    return { type: 'Literal', value: null, location: token.location };
  }

  if (token.type === 'IDENTIFIER') {
    ctx.advance();
    return { type: 'Identifier', name: token.value, location: token.location };
  }

  if (token.type === 'LPAREN') {
    ctx.advance();
    const expr = parseExpressionNode(ctx);
    ctx.expect('RPAREN');
    return expr;
  }

  if (token.type === 'LBRACKET') {
    ctx.advance();
    const elements: any[] = [];
    while (!ctx.check('RBRACKET')) {
      if (elements.length > 0) ctx.expect('COMMA');
      elements.push(parseExpressionNode(ctx));
    }
    ctx.expect('RBRACKET');
    return { type: 'ArrayExpression', elements, location: ctx.loc() };
  }

  if (token.type === 'LBRACE') {
    ctx.advance();
    const properties: { key: string; value: any }[] = [];
    while (!ctx.check('RBRACE')) {
      if (properties.length > 0) ctx.expect('COMMA');
      const key = ctx.expect('IDENTIFIER').value;
      ctx.expect('COLON');
      const value = parseExpressionNode(ctx);
      properties.push({ key, value });
    }
    ctx.expect('RBRACE');
    return { type: 'ObjectExpression', properties, location: ctx.loc() };
  }

  ctx.error(`Unexpected token: ${token.type}`);
  return { type: 'Literal', value: null, location: ctx.loc() };
}
