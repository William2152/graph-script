import { DiagramDeclaration } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { readBoolean, readNumber, readString, resolveValue, svgDocument } from '../common';
import { compileSemanticDiagram } from '../diagram-semantic';
import { DEFAULT_FONT_FAMILY, renderRichTextBlock } from '../latex';
import { readReadabilityMode } from '../readability-policy';
import { normalizeDiagramElementsForReadability } from './readability';
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
  const width = readNumberProperty(decl, values, traces, 'width', 1280);
  const requestedHeight = readNumberProperty(decl, values, traces, 'height', 720);
  const background = readStringProperty(decl, values, traces, 'background', '#f8fafc');
  const title = readStringProperty(decl, values, traces, 'title', decl.name);
  const subtitle = readStringProperty(decl, values, traces, 'subtitle', '');
  const fontFamily = readStringProperty(decl, values, traces, 'font_family', DEFAULT_FONT_FAMILY);
  const fixedCanvas = readBooleanProperty(decl, values, traces, 'fixed_canvas', false);
  const readabilityMode = readReadabilityMode(decl.properties.readability_mode, values, traces, 'auto');

  const compiled = await compileSemanticDiagram(decl.elements, values, traces, width, requestedHeight, {
    fontFamily,
    fontScale: renderOptions.fontScale,
    imageScale: renderOptions.imageScale,
    fillImages: renderOptions.fillImages,
    readabilityMode,
  });
  const elements = !compiled.hasSemantic
    ? normalizeDiagramElementsForReadability(compiled.elements, values, traces, { mode: readabilityMode })
    : compiled.elements;

  const finalWidth = compiled.hasSemantic && !fixedCanvas ? Math.max(640, compiled.minWidth) : width;
  const finalHeight = compiled.hasSemantic && !fixedCanvas ? Math.max(320, compiled.minHeight) : requestedHeight;

  let body = '';
  body += await renderHeaderTitle(title, finalWidth, fontFamily);
  body += await renderHeaderSubtitle(subtitle, finalWidth, fontFamily);
  body += await renderElements(
    elements,
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
