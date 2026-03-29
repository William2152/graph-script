import { DiagramDeclaration } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { readBoolean, readNumber, readString, resolveValue, svgDocument } from '../common';
import { DEFAULT_FONT_FAMILY, renderRichTextBlock } from '../latex';
import { prepareDiagramLayout } from './layout';
import { createDiagramRenderContext } from './render-state';
import { renderElements } from './render-tree';
import { RenderEmbed } from './render-types';

export type { RenderEmbed } from './render-types';

export async function renderDiagram(
  decl: DiagramDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  renderEmbed: RenderEmbed,
  assetBaseDir: string,
  renderOptions: { fontScale?: number; imageScale?: number; fillImages?: boolean } = {},
): Promise<string> {
  const background = readStringProperty(decl, values, traces, 'background', '#f8fafc');
  const title = readStringProperty(decl, values, traces, 'title', decl.name);
  const subtitle = readStringProperty(decl, values, traces, 'subtitle', '');
  const fontFamily = readStringProperty(decl, values, traces, 'font_family', DEFAULT_FONT_FAMILY);
  const prepared = await prepareDiagramLayout(decl, values, traces, renderOptions);
  const finalWidth = prepared.width;
  const finalHeight = prepared.height;

  let body = '';
  body += await renderHeaderTitle(title, finalWidth, fontFamily);
  body += await renderHeaderSubtitle(subtitle, finalWidth, fontFamily);
  body += await renderElements(
    prepared.elements,
    createDiagramRenderContext(values, traces, renderEmbed, assetBaseDir, fontFamily, 0, 0),
  );

  return svgDocument(finalWidth, finalHeight, body, background);
}

async function renderHeaderTitle(title: string, width: number, fontFamily: string): Promise<string> {
  if (!title) return '';
  const renderedTitle = await renderRichTextBlock(title, {
    x: width / 2,
    y: 26,
    maxWidth: width - 120,
    fontSize: 36,
    weight: '800',
    color: '#0f172a',
    anchor: 'middle',
    maxLines: 2,
    latex: 'auto',
    fontFamily,
  });
  return renderedTitle.svg;
}

async function renderHeaderSubtitle(subtitle: string, width: number, fontFamily: string): Promise<string> {
  if (!subtitle) return '';
  const renderedSubtitle = await renderRichTextBlock(subtitle, {
    x: width / 2,
    y: 72,
    maxWidth: width - 160,
    fontSize: 18,
    weight: '500',
    color: '#64748b',
    anchor: 'middle',
    maxLines: 3,
    latex: 'auto',
    fontFamily,
  });
  return renderedSubtitle.svg;
}

function readNumberProperty(
  decl: DiagramDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: number,
): number {
  const expr = decl.properties[key];
  if (!expr) return fallback;
  return readNumber(resolveValue(expr, values, traces), fallback);
}

function readStringProperty(
  decl: DiagramDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: string,
): string {
  const expr = decl.properties[key];
  if (!expr) return fallback;
  return readString(resolveValue(expr, values, traces), fallback);
}

function readBooleanProperty(
  decl: DiagramDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  key: string,
  fallback: boolean,
): boolean {
  const expr = decl.properties[key];
  if (!expr) return fallback;
  return readBoolean(resolveValue(expr, values, traces), fallback);
}

export { prepareDiagramLayout } from './layout';
