import { DiagramDeclaration, DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { readNumber, readString, resolveValue } from '../common';
import { layoutContainerChildren } from '../diagram-semantic/layout-container';
import { measureSemanticBounds, offsetChildren, readContainerOptions } from '../diagram-semantic/helpers';
import { compileSemanticDiagram } from '../diagram-semantic/layout';
import { DEFAULT_FONT_FAMILY } from '../latex';
import {
  RendererLayoutMode,
  RendererSizeMode,
  hasExplicitProperty,
  readReadabilityMode,
  readRendererLayoutMode,
  readRendererSizeModeWithLegacyFixed,
  resolveRendererExtent,
  readSpacingDefaults,
} from '../readability-policy';
import { normalizeDiagramElementsForReadability } from './readability';

const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

export interface PreparedDiagramLayout {
  elements: DiagramElement[];
  width: number;
  height: number;
  layoutMode: RendererLayoutMode;
  sizeMode: RendererSizeMode;
  hasSemantic: boolean;
}

export async function prepareDiagramLayout(
  decl: DiagramDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  renderOptions: { fontScale?: number; imageScale?: number; fillImages?: boolean } = {},
): Promise<PreparedDiagramLayout> {
  const defaults = readSpacingDefaults('diagram');
  const widthExpr = decl.properties.width;
  const heightExpr = decl.properties.height;
  const requestedWidth = readNumber(resolveValue(widthExpr, values, traces), defaults.width);
  const requestedHeight = readNumber(resolveValue(heightExpr, values, traces), defaults.height);
  const hasExplicitWidth = hasExplicitProperty(widthExpr);
  const hasExplicitHeight = hasExplicitProperty(heightExpr);
  const fontFamily = readString(resolveValue(decl.properties.font_family, values, traces), DEFAULT_FONT_FAMILY);
  const readabilityMode = readReadabilityMode(decl.properties.readability_mode, values, traces, 'auto');
  const layoutMode = readRendererLayoutMode(decl.properties.layout_mode, values, traces, 'dynamic');
  const sizeMode = readRendererSizeModeWithLegacyFixed(
    decl.properties.size_mode,
    decl.properties.fixed_canvas,
    values,
    traces,
    'dynamic',
  );

  const semantic = await compileSemanticDiagram(
    decl.elements,
    values,
    traces,
    hasExplicitWidth ? requestedWidth : defaults.width,
    hasExplicitHeight ? requestedHeight : defaults.height,
    {
      fontFamily,
      fontScale: renderOptions.fontScale,
      imageScale: renderOptions.imageScale,
      fillImages: renderOptions.fillImages,
      readabilityMode,
    },
  );

  if (semantic.hasSemantic) {
    return {
      elements: semantic.elements,
      width: resolveRendererExtent(hasExplicitWidth, requestedWidth, defaults.width, sizeMode, semantic.minWidth, defaults.minWidth),
      height: resolveRendererExtent(hasExplicitHeight, requestedHeight, defaults.height, sizeMode, semantic.minHeight, defaults.minHeight),
      layoutMode: 'dynamic',
      sizeMode,
      hasSemantic: true,
    };
  }

  if (layoutMode === 'manual') {
    const elements = await normalizeDiagramElementsForReadability(semantic.elements, values, traces, { mode: readabilityMode, fontFamily });
    const bounds = measureSemanticBounds(elements, values, traces);
    return {
      elements,
      width: resolveRendererExtent(
        hasExplicitWidth,
        requestedWidth,
        defaults.width,
        sizeMode,
        Math.ceil(bounds.maxX + defaults.spacing.margin),
        defaults.minWidth,
        true,
      ),
      height: resolveRendererExtent(
        hasExplicitHeight,
        requestedHeight,
        defaults.height,
        sizeMode,
        Math.ceil(bounds.maxY + defaults.spacing.margin),
        defaults.minHeight,
        true,
      ),
      layoutMode,
      sizeMode,
      hasSemantic: false,
    };
  }

  const margin = readNumber(resolveValue(decl.properties.margin, values, traces), defaults.spacing.margin);
  const gap = readNumber(resolveValue(decl.properties.gap, values, traces), defaults.spacing.gap);
  const contentTop = readString(resolveValue(decl.properties.subtitle, values, traces), '') ? 108 : 84;
  const root = makeRootContainer(decl, gap);
  const rootOptions = readContainerOptions(root, values, traces, 'stack', gap);
  const preparedChildren = decl.elements.map((element) => stripManualCoordinatesForDynamic(element, values, traces));
  const naturalInnerWidth = estimateNaturalContainerWidth(preparedChildren, values, traces, rootOptions);
  const widthBudget = Math.max(
    240,
    (hasExplicitWidth ? requestedWidth : Math.max(defaults.width, naturalInnerWidth + margin * 2)) - margin * 2,
  );
  const content = await layoutContainerChildren(
    preparedChildren,
    widthBudget,
    rootOptions,
    values,
    traces,
    fontFamily,
    renderOptions.imageScale,
    renderOptions.fillImages,
    renderOptions.fontScale,
  );
  const shifted = offsetChildren(content.elements, margin, contentTop);
  const bounds = measureSemanticBounds(shifted, values, traces);

  return {
    elements: shifted,
    width: resolveRendererExtent(
      hasExplicitWidth,
      requestedWidth,
      defaults.width,
      sizeMode,
      Math.ceil(bounds.maxX + margin),
      defaults.minWidth,
    ),
    height: resolveRendererExtent(
      hasExplicitHeight,
      requestedHeight,
      defaults.height,
      sizeMode,
      Math.ceil(bounds.maxY + margin),
      defaults.minHeight,
    ),
    layoutMode,
    sizeMode,
    hasSemantic: false,
  };
}

function makeRootContainer(decl: DiagramDeclaration, gap: number): DiagramElement {
  return {
    type: 'group',
    name: '__diagram_root__',
    properties: {
      ...decl.properties,
      layout: decl.properties.layout ?? literal('stack'),
      align: decl.properties.align ?? literal('stretch'),
      gap: decl.properties.gap ?? literal(gap),
      padding: decl.properties.padding ?? literal(0),
      columns: decl.properties.columns ?? literal(2),
    },
  };
}

function stripManualCoordinatesForDynamic(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement {
  const manualGraph = element.type === 'graph' && readRendererLayoutMode(element.properties.layout_mode, values, traces, 'dynamic') === 'manual';
  if (manualGraph) return element;

  const hadCoordinates = element.properties.x != null || element.properties.y != null || element.properties.x2 != null || element.properties.y2 != null;
  const {
    x: _x,
    y: _y,
    x2: _x2,
    y2: _y2,
    ...rest
  } = element.properties;
  const nextProperties = {
    ...rest,
    ...(hadCoordinates ? { manual_coordinates_ignored: literal(true) } : {}),
    ...(element.properties.w != null || element.properties.h != null || element.properties.padding != null || element.properties.gap != null
      ? { hard_constraint: literal(true) }
      : {}),
  };

  return {
    ...element,
    properties: nextProperties,
    ...(element.children?.length
      ? { children: element.children.map((child) => stripManualCoordinatesForDynamic(child, values, traces)) }
      : {}),
  };
}

function literal(value: string | number | boolean) {
  return { type: 'Literal' as const, value, location: ZERO_LOC };
}

function estimateNaturalContainerWidth(
  children: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  options: { layout: 'stack' | 'row' | 'columns'; gap: number; padding: number; columns: number },
): number {
  const childWidths = children.map((child) => estimateNaturalElementWidth(child, values, traces));
  if (!childWidths.length) return 0;
  const padding = Math.max(0, options.padding);
  if (options.layout === 'row') {
    return childWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, childWidths.length - 1) * options.gap + padding * 2;
  }
  if (options.layout === 'columns') {
    const columns = Math.max(1, options.columns);
    const columnWidths = Array.from({ length: columns }, (_, column) =>
      Math.max(...childWidths.filter((_value, index) => index % columns === column), 0));
    return columnWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, columns - 1) * options.gap + padding * 2;
  }
  return Math.max(...childWidths) + padding * 2;
}

function estimateNaturalElementWidth(
  element: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): number {
  const explicitWidth = readNumber(resolveValue(element.properties.w, values, traces), 0);
  if (explicitWidth > 0) return explicitWidth;
  if (element.children?.length) {
    const options = readContainerOptions(element, values, traces, 'stack', readNumber(resolveValue(element.properties.gap, values, traces), 24));
    const childWidth = estimateNaturalContainerWidth(element.children, values, traces, options);
    const padding = readNumber(resolveValue(element.properties.padding, values, traces), 0);
    return Math.max(childWidth + padding * 2, 160);
  }
  if (element.type === 'graph') return readSpacingDefaults('graph').width;
  if (element.type === 'formula') return 320;
  const text = readString(resolveValue(element.properties.value ?? element.properties.label, values, traces), element.name);
  const size = readNumber(resolveValue(element.properties.size, values, traces), 18);
  return Math.max(140, Math.ceil(text.length * size * 0.62 + 48));
}
