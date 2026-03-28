import {
  ChartDeclaration,
  DiagramDeclaration,
  FlowDeclaration,
  PageDeclaration,
  Plot3dDeclaration,
  TableDeclaration,
} from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { buildChartSeries, extractChartConfig } from './chart';
import { readBoolean, readNumber, readString, resolveValue } from './common';
import { compileSemanticDiagram } from './diagram-semantic';
import { layoutFlow } from './flow';
import { DEFAULT_FONT_FAMILY } from './latex';
import {
  fitIntoBoxWithReadableScale,
  ReadabilityMode,
  readReadabilityMode,
  READABILITY_POLICY,
} from './readability-policy';
import { buildTableData } from './table';

export interface PageTargetDocument {
  target: string;
  width: number;
  height: number;
  svg?: string | null;
}

export interface PagePlacementLayout {
  target: string;
  row: number;
  col: number;
  x: number;
  y: number;
  cellWidth: number;
  cellHeight: number;
  innerWidth: number;
  innerHeight: number;
  scale: number;
  dx: number;
  dy: number;
  renderedWidth: number;
  renderedHeight: number;
  belowMinScale: boolean;
}

export interface PageLayoutPlan {
  width: number;
  height: number;
  columns: number;
  rows: number;
  gap: number;
  margin: number;
  topOffset: number;
  colWidths: number[];
  rowHeights: number[];
  placements: PagePlacementLayout[];
}

export interface PageLayoutOptions {
  readabilityMode?: ReadabilityMode;
  minEmbedScale?: number;
}

export function findRenderableTargetDeclaration(
  target: string,
  values: Record<string, GSValue>,
): any | null {
  const direct = values[target];
  if (direct && typeof direct === 'object') return direct;

  for (const value of Object.values(values)) {
    if (value && typeof value === 'object' && (value as { name?: string }).name === target) {
      return value;
    }
  }
  return null;
}

export async function estimateDeclarationCanvasSize(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  seen = new Set<any>(),
): Promise<{ width: number; height: number }> {
  if (!decl || typeof decl !== 'object') return { width: 800, height: 600 };
  if (seen.has(decl)) {
    return {
      width: readNumber(resolveValue(decl.properties?.width, values, traces), 900),
      height: readNumber(resolveValue(decl.properties?.height, values, traces), 600),
    };
  }
  seen.add(decl);

  switch (decl.type) {
    case 'DiagramDeclaration': {
      const diagram = decl as DiagramDeclaration;
      const width = readNumber(resolveValue(diagram.properties.width, values, traces), 1280);
      const requestedHeight = readNumber(resolveValue(diagram.properties.height, values, traces), 720);
      const fontFamily = readString(resolveValue(diagram.properties.font_family, values, traces), DEFAULT_FONT_FAMILY);
      const fixedCanvas = readBoolean(resolveValue(diagram.properties.fixed_canvas, values, traces), false);
      const compiled = await compileSemanticDiagram(diagram.elements, values, traces, width, requestedHeight, {
        fontFamily,
        readabilityMode: readReadabilityMode(diagram.properties.readability_mode, values, traces, 'auto'),
      });
      return {
        width: compiled.hasSemantic && !fixedCanvas ? Math.max(640, compiled.minWidth) : width,
        height: compiled.hasSemantic && !fixedCanvas ? Math.max(320, compiled.minHeight) : requestedHeight,
      };
    }
    case 'FlowDeclaration': {
      const flow = layoutFlow(decl as FlowDeclaration);
      return { width: flow.width, height: flow.height };
    }
    case 'ChartDeclaration': {
      const config = extractChartConfig(decl as ChartDeclaration, values, traces);
      const series = buildChartSeries(decl as ChartDeclaration, values, traces);
      return {
        width: config.width,
        height: series.length ? config.height : Math.max(320, config.height),
      };
    }
    case 'TableDeclaration': {
      const table = buildTableData(decl as TableDeclaration, values, traces);
      const approxColumnWidths = table.columns.map((column) => Math.max(96, column.length * 8 + 24));
      const width = Math.max(420, approxColumnWidths.reduce((sum, value) => sum + value, 0) + 48);
      const height = 48 + 36 + Math.max(table.rows.length, 1) * 32 + 48;
      return { width, height };
    }
    case 'Plot3dDeclaration': {
      const plot = decl as Plot3dDeclaration;
      return {
        width: readNumber(resolveValue(plot.properties.width, values, traces), 760),
        height: readNumber(resolveValue(plot.properties.height, values, traces), 520),
      };
    }
    case 'PageDeclaration': {
      const page = decl as PageDeclaration;
      const docs: PageTargetDocument[] = [];
      for (const placement of page.placements) {
        const targetDecl = findRenderableTargetDeclaration(placement.target, values);
        const size = await estimateDeclarationCanvasSize(targetDecl, values, traces, seen);
        docs.push({ target: placement.target, width: size.width, height: size.height });
      }
      const plan = planPageLayout(page, docs, values, traces, {
        readabilityMode: readReadabilityMode(page.properties.readability_mode, values, traces, 'auto'),
        minEmbedScale: readNumber(resolveValue(page.properties.min_embed_scale, values, traces), READABILITY_POLICY.minEmbedScale),
      });
      return { width: plan.width, height: plan.height };
    }
    default:
      return {
        width: readNumber(resolveValue(decl.properties?.width, values, traces), 900),
        height: readNumber(resolveValue(decl.properties?.height, values, traces), 600),
      };
  }
}

export function planPageLayout(
  decl: PageDeclaration,
  docs: PageTargetDocument[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  options: PageLayoutOptions = {},
): PageLayoutPlan {
  const requestedWidth = readNumber(resolveValue(decl.properties.width, values, traces), 1440);
  const requestedHeight = readNumber(resolveValue(decl.properties.height, values, traces), 900);
  const columns = Math.max(1, readNumber(resolveValue(decl.properties.columns, values, traces), 2));
  const rows = Math.max(1, readNumber(resolveValue(
    decl.properties.rows,
    values,
    traces,
  ), Math.max(1, Math.ceil(decl.placements.length / Math.max(columns, 1)))));
  const gap = Math.max(0, readNumber(resolveValue(decl.properties.gap, values, traces), 24));
  const margin = Math.max(24, readNumber(resolveValue(decl.properties.margin, values, traces), 32));
  const subtitle = readString(resolveValue(decl.properties.subtitle, values, traces), '');
  const topOffset = subtitle ? 108 : 84;
  const readabilityMode = options.readabilityMode ?? readReadabilityMode(decl.properties.readability_mode, values, traces, 'auto');
  const minEmbedScale = Math.max(0.1, options.minEmbedScale ?? readNumber(
    resolveValue(decl.properties.min_embed_scale, values, traces),
    READABILITY_POLICY.minEmbedScale,
  ));

  const defaultCellWidth = Math.max(180, (requestedWidth - margin * 2 - gap * (columns - 1)) / columns);
  const defaultCellHeight = Math.max(180, (requestedHeight - topOffset - margin - gap * (rows - 1)) / rows);
  const colWidths = Array.from({ length: columns }, () => defaultCellWidth);

  const resolvedPlacements = decl.placements.map((placement, index) => {
    const match = placement.position.match(/cell\((\d+)\s*,\s*(\d+)\)/);
    const row = match ? Math.max(0, Number(match[1]) - 1) : Math.floor(index / columns);
    const col = match ? Math.max(0, Number(match[2]) - 1) : index % columns;
    const doc = docs.find((entry) => entry.target === placement.target) ?? {
      target: placement.target,
      width: defaultCellWidth - 24,
      height: defaultCellHeight - 24,
      svg: null,
    };
    return { target: placement.target, row, col, doc };
  });

  if (readabilityMode === 'auto') {
    for (const placement of resolvedPlacements) {
      const neededCellWidth = placement.doc.width * minEmbedScale + 24;
      colWidths[placement.col] = Math.max(colWidths[placement.col] ?? defaultCellWidth, neededCellWidth);
    }
  }

  const width = Math.max(
    requestedWidth,
    margin * 2 + colWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, columns - 1),
  );
  const rowHeights = Array.from({ length: rows }, () => defaultCellHeight);

  if (readabilityMode === 'auto') {
    for (const placement of resolvedPlacements) {
      const innerWidth = Math.max(120, (colWidths[placement.col] ?? defaultCellWidth) - 24);
      const fit = fitIntoBoxWithReadableScale(
        placement.doc.width,
        placement.doc.height,
        innerWidth,
        Math.max(120, rowHeights[placement.row] - 24),
        { minScale: minEmbedScale, verticalAlign: 'top' },
      );
      rowHeights[placement.row] = Math.max(
        rowHeights[placement.row],
        Math.max(defaultCellHeight, fit.requiredHeight + 24),
      );
    }
  }

  const height = Math.max(
    requestedHeight,
    topOffset + rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rows - 1) + margin,
  );

  const colX: number[] = [];
  let cursorX = margin;
  for (let col = 0; col < columns; col += 1) {
    colX[col] = cursorX;
    cursorX += (colWidths[col] ?? defaultCellWidth) + gap;
  }
  const rowY: number[] = [];
  let cursorY = topOffset;
  for (let row = 0; row < rows; row += 1) {
    rowY[row] = cursorY;
    cursorY += (rowHeights[row] ?? defaultCellHeight) + gap;
  }

  const placements: PagePlacementLayout[] = resolvedPlacements.map((placement) => {
    const cellWidth = colWidths[placement.col] ?? defaultCellWidth;
    const cellHeight = rowHeights[placement.row] ?? defaultCellHeight;
    const innerWidth = Math.max(120, cellWidth - 24);
    const innerHeight = Math.max(120, cellHeight - 24);
    const fit = readabilityMode === 'legacy'
      ? fitIntoBoxWithReadableScale(placement.doc.width, placement.doc.height, innerWidth, innerHeight, {
          minScale: 0.1,
          verticalAlign: 'center',
        })
      : fitIntoBoxWithReadableScale(placement.doc.width, placement.doc.height, innerWidth, innerHeight, {
          minScale: minEmbedScale,
          verticalAlign: 'top',
        });

    return {
      target: placement.target,
      row: placement.row,
      col: placement.col,
      x: colX[placement.col],
      y: rowY[placement.row],
      cellWidth,
      cellHeight,
      innerWidth,
      innerHeight,
      scale: fit.scale,
      dx: fit.dx,
      dy: fit.dy,
      renderedWidth: placement.doc.width * fit.scale,
      renderedHeight: placement.doc.height * fit.scale,
      belowMinScale: fit.belowMinScale,
    };
  });

  return {
    width,
    height,
    columns,
    rows,
    gap,
    margin,
    topOffset,
    colWidths,
    rowHeights,
    placements,
  };
}
