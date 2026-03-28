import { AstNode } from '@graphscript/ast';
import { ParserContext } from './context';
import { parseFlowDeclarationBody } from './top-level-flow';
import { advanceNamedDeclarationHeader } from './top-level-header';
import { parseCoreTopLevelDeclaration } from './top-level-core';

type TopLevelParser = (ctx: ParserContext) => AstNode | null;

const VISUAL_TOP_LEVEL_PARSERS: Record<string, TopLevelParser> = {
  chart: parseChartDeclaration,
  flow: parseFlowDeclaration,
  diagram: parseDiagramDeclaration,
  table: parseTableDeclaration,
  plot3d: parsePlot3dDeclaration,
  scene3d: parseScene3dDeclaration,
  erd: parseErdDeclaration,
  infra: parseInfraDeclaration,
  page: parsePageDeclaration,
  render: parseRenderDeclaration,
};

/**
 * Top-level declaration parsing module.
 * Keeps parser.ts focused on token stream orchestration.
 */
export function parseTopLevelDeclaration(ctx: ParserContext): AstNode | null {
  const token = ctx.peek();
  if (token.type !== 'IDENTIFIER') {
    ctx.error(`Expected identifier, got ${token.type}`);
    return null;
  }

  const coreNode = parseCoreTopLevelDeclaration(ctx, token.value);
  if (coreNode) {
    return coreNode;
  }

  const visualParser = VISUAL_TOP_LEVEL_PARSERS[token.value];
  if (!visualParser) {
    ctx.error(`Unknown top-level declaration: ${token.value}`);
    return null;
  }

  return visualParser(ctx);
}

function parseChartDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const nameToken = ctx.peek();
  const name = nameToken.type === 'STRING' ? nameToken.value : ctx.expect('IDENTIFIER').value;
  if (nameToken.type === 'STRING') ctx.advance();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  const properties = ctx.parseBlockProperties();
  return { type: 'ChartDeclaration', name, properties, location: { start, end: ctx.currentLocation() } };
}

function parseFlowDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx, { consumeIndent: true });
  const { nodes, edges } = parseFlowDeclarationBody(ctx);
  return { type: 'FlowDeclaration', name, properties: {}, nodes, edges, location: { start, end: ctx.currentLocation() } };
}

function parseDiagramDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  const elements = ctx.parseDiagramElements();
  return { type: 'DiagramDeclaration', name, elements, location: { start, end: ctx.currentLocation() } };
}

function parseTableDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  const properties = ctx.parseBlockProperties();
  return { type: 'TableDeclaration', name, ...properties, location: { start, end: ctx.currentLocation() } };
}

function parsePlot3dDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  const properties = ctx.parseBlockProperties();
  return { type: 'Plot3dDeclaration', name, properties, location: { start, end: ctx.currentLocation() } };
}

function parseScene3dDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  ctx.expect('INDENT');
  const elements: any[] = [];
  while (!ctx.check('DEDENT') && !ctx.isEof()) {
    ctx.skipNewlines();
    if (ctx.check('DEDENT') || ctx.isEof()) break;
    const type = ctx.expect('IDENTIFIER').value;
    const elementName = ctx.expect('IDENTIFIER').value;
    ctx.expect('NEWLINE');
    elements.push({ type, name: elementName, properties: {} });
  }
  if (ctx.check('DEDENT')) ctx.advance();
  return { type: 'Scene3dDeclaration', name, elements, location: { start, end: ctx.currentLocation() } };
}

function parseErdDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  return { type: 'ErdDeclaration', name, tables: [], relationships: [], location: { start, end: ctx.currentLocation() } };
}

function parseInfraDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  const provider = ctx.expect('IDENTIFIER').value;
  const { name } = parseOptionalStringName(ctx);
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  return { type: 'InfraDeclaration', provider, name, elements: [], location: { start, end: ctx.currentLocation() } };
}

function parsePageDeclaration(ctx: ParserContext) {
  const { start, name } = advanceNamedDeclarationHeader(ctx);
  ctx.parseBlockProperties();
  return { type: 'PageDeclaration', name, placements: [], location: { start, end: ctx.currentLocation() } };
}

function parseRenderDeclaration(ctx: ParserContext) {
  ctx.advance();
  const start = ctx.loc();
  ctx.expect('COLON');
  ctx.expect('NEWLINE');
  return { type: 'RenderDeclaration', targets: [], location: { start, end: ctx.currentLocation() } };
}

function parseOptionalStringName(ctx: ParserContext): { name: string } {
  const nameToken = ctx.peek();
  const name = nameToken.type === 'STRING' ? nameToken.value : ctx.expect('IDENTIFIER').value;
  if (nameToken.type === 'STRING') {
    ctx.advance();
  }
  return { name };
}
