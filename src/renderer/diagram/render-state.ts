import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { escapeXml, readBoolean, readNumber, readString, resolveValue, round } from '../common';
import { readLatexMode, type LatexMode } from '../latex';
import { RenderEmbed } from './render-types';

export interface DiagramRenderContext {
  values: Record<string, GSValue>;
  traces: Map<string, Trace>;
  renderEmbed: RenderEmbed;
  assetBaseDir: string;
  defaultFontFamily: string;
  offsetX: number;
  offsetY: number;
}

export interface ElementRenderState {
  element: DiagramElement;
  values: Record<string, GSValue>;
  traces: Map<string, Trace>;
  renderEmbed: RenderEmbed;
  assetBaseDir: string;
  defaultFontFamily: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  label: string;
  subtitle: string;
  color: string;
  radius: number;
  textSize: number;
  weight: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  gridRows: number;
  gridCols: number;
  shadow: boolean;
  latexMode: LatexMode;
  fontFamily: string;
  dashAttr: string;
  fillOpacityAttr: string;
  strokeOpacityAttr: string;
}

export function createDiagramRenderContext(
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  renderEmbed: RenderEmbed,
  assetBaseDir: string,
  defaultFontFamily: string,
  offsetX: number,
  offsetY: number,
): DiagramRenderContext {
  return {
    values,
    traces,
    renderEmbed,
    assetBaseDir,
    defaultFontFamily,
    offsetX,
    offsetY,
  };
}

export function createChildRenderContext(
  parent: Pick<DiagramRenderContext, 'values' | 'traces' | 'renderEmbed' | 'assetBaseDir' | 'defaultFontFamily'>,
  offsetX: number,
  offsetY: number,
  defaultFontFamily = parent.defaultFontFamily,
): DiagramRenderContext {
  return {
    values: parent.values,
    traces: parent.traces,
    renderEmbed: parent.renderEmbed,
    assetBaseDir: parent.assetBaseDir,
    defaultFontFamily,
    offsetX,
    offsetY,
  };
}

export function createElementRenderState(
  element: DiagramElement,
  ctx: DiagramRenderContext,
): ElementRenderState {
  const x = ctx.offsetX + readNumber(resolveValue(element.properties.x, ctx.values, ctx.traces), 0);
  const y = ctx.offsetY + readNumber(resolveValue(element.properties.y, ctx.values, ctx.traces), 0);
  const w = readNumber(resolveValue(element.properties.w, ctx.values, ctx.traces), 200);
  const h = readNumber(resolveValue(element.properties.h, ctx.values, ctx.traces), 120);
  const defaultStroke = ['line', 'arrow'].includes(element.type) ? '#64748b' : '#cbd5e1';
  const fill = readString(resolveValue(element.properties.fill, ctx.values, ctx.traces), '#ffffff');
  const stroke = readString(resolveValue(element.properties.stroke, ctx.values, ctx.traces), defaultStroke);
  const labelFallback = ['line', 'arrow', 'image'].includes(element.type) ? '' : element.name;
  const label = readString(resolveValue(element.properties.label, ctx.values, ctx.traces), labelFallback);
  const subtitle = readString(resolveValue(element.properties.subtitle, ctx.values, ctx.traces), '');
  const color = readString(resolveValue(element.properties.color, ctx.values, ctx.traces), '#0f172a');
  const radius = readNumber(resolveValue(element.properties.radius, ctx.values, ctx.traces), 16);
  const textSize = readNumber(resolveValue(element.properties.size, ctx.values, ctx.traces), 16);
  const weight = readString(resolveValue(element.properties.weight, ctx.values, ctx.traces), '600');
  const dash = readString(resolveValue(element.properties.dash, ctx.values, ctx.traces), '');
  const strokeWidth = readNumber(resolveValue(element.properties.strokeWidth, ctx.values, ctx.traces), ['line', 'arrow'].includes(element.type) ? 3 : 1.5);
  const fillOpacity = readNumber(resolveValue(element.properties.fillOpacity, ctx.values, ctx.traces), 1);
  const strokeOpacity = readNumber(resolveValue(element.properties.strokeOpacity, ctx.values, ctx.traces), 1);
  const gridRows = Math.max(1, readNumber(resolveValue(element.properties.rows, ctx.values, ctx.traces), 4));
  const gridCols = Math.max(1, readNumber(resolveValue(element.properties.cols, ctx.values, ctx.traces), 4));
  const shadow = readBoolean(resolveValue(element.properties.shadow, ctx.values, ctx.traces), ['panel', 'box', 'callout', 'badge'].includes(element.type));
  const latexMode = readLatexMode(resolveValue(element.properties.latex, ctx.values, ctx.traces), 'auto');
  const fontFamily = readString(resolveValue(element.properties.font_family, ctx.values, ctx.traces), ctx.defaultFontFamily);
  const dashAttr = dash ? ` stroke-dasharray="${escapeXml(dash)}"` : '';
  const fillOpacityAttr = fillOpacity < 1 ? ` fill-opacity="${round(fillOpacity, 3)}"` : '';
  const strokeOpacityAttr = strokeOpacity < 1 ? ` stroke-opacity="${round(strokeOpacity, 3)}"` : '';

  return {
    element,
    values: ctx.values,
    traces: ctx.traces,
    renderEmbed: ctx.renderEmbed,
    assetBaseDir: ctx.assetBaseDir,
    defaultFontFamily: ctx.defaultFontFamily,
    offsetX: ctx.offsetX,
    offsetY: ctx.offsetY,
    x,
    y,
    w,
    h,
    fill,
    stroke,
    label,
    subtitle,
    color,
    radius,
    textSize,
    weight,
    strokeWidth,
    fillOpacity,
    strokeOpacity,
    gridRows,
    gridCols,
    shadow,
    latexMode,
    fontFamily,
    dashAttr,
    fillOpacityAttr,
    strokeOpacityAttr,
  };
}
