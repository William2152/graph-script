import { ParserContext } from './context';

interface FlowBody {
  nodes: any[];
  edges: any[];
}

/**
 * Parses the indented body of a `flow` declaration.
 */
export function parseFlowDeclarationBody(ctx: ParserContext): FlowBody {
  const nodes: any[] = [];
  const edges: any[] = [];

  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;

    const token = ctx.peek();
    if (token.value === 'node') {
      parseFlowNode(ctx, nodes);
      continue;
    }

    if (token.value === 'embed') {
      parseFlowEmbed(ctx);
      continue;
    }

    if (token.type === 'IDENTIFIER') {
      parseFlowEdgeOrAssignment(ctx, edges);
      continue;
    }

    ctx.advance();
    ctx.expect('NEWLINE');
  }

  if (ctx.check('DEDENT')) ctx.advance();
  return { nodes, edges };
}

function parseFlowNode(ctx: ParserContext, nodes: any[]): void {
  ctx.advance();
  const id = ctx.expect('IDENTIFIER').value;
  if (ctx.check('TYPE')) {
    ctx.advance();
    const nodeType = ctx.expect('IDENTIFIER').value;
    let label = '';
    if (ctx.check('LABEL')) {
      ctx.advance();
      label = ctx.peek().type === 'STRING' ? ctx.peek().value : ctx.expect('IDENTIFIER').value;
      if (ctx.peek().type === 'STRING') ctx.advance();
    }
    nodes.push({ type: 'FlowNode', id, nodeType, label });
  }
  ctx.expect('NEWLINE');
}

function parseFlowEmbed(ctx: ParserContext): void {
  ctx.advance();
  ctx.expect('IDENTIFIER');
  ctx.expect('EQUALS');
  ctx.parseExpression();
  ctx.expect('NEWLINE');
}

function parseFlowEdgeOrAssignment(ctx: ParserContext, edges: any[]): void {
  const from = ctx.expect('IDENTIFIER').value;
  if (ctx.check('ARROW')) {
    ctx.expect('ARROW');
    const to = ctx.expect('IDENTIFIER').value;
    let label = '';
    if (ctx.check('IDENTIFIER')) {
      label = ctx.expect('IDENTIFIER').value;
    }
    edges.push({ type: 'FlowEdge', from, to, label });
  } else {
    ctx.expect('EQUALS');
    ctx.parseExpression();
  }
  ctx.expect('NEWLINE');
}
