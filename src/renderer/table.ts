import { Expression, TableDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import {
  hasExplicitProperty,
  readRendererSizeMode,
  readSpacingDefaults,
  resolveRendererExtent,
} from './readability-policy';

interface TableData {
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface TableLayoutPlan {
  table: TableData;
  width: number;
  height: number;
  padding: number;
  rowHeight: number;
  headerHeight: number;
  fontSize: number;
  widths: number[];
}

export function buildTableData(decl: TableDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>): TableData {
  const columnsValue = resolveValue(decl.properties.columns ?? decl.columns, values, traces);
  const rowsValue = resolveValue(decl.properties.rows ?? decl.rows, values, traces);
  const sourceValue = resolveValue(decl.properties.source, values, traces);
  const trace = sourceValue && typeof sourceValue === 'object' && (sourceValue as Trace).type === 'trace'
    ? sourceValue as Trace
    : undefined;

  if (trace) {
    return {
      title: decl.name,
      columns: trace.columns,
      rows: trace.rows.map((row) => trace.columns.map((column) => formatCell(row[column]))),
    };
  }

  const columns = Array.isArray(columnsValue) ? columnsValue.map((item) => String(item)) : [];

  if (Array.isArray(rowsValue)) {
    if (rowsValue.every((row) => Array.isArray(row))) {
      return {
        title: decl.name,
        columns,
        rows: (rowsValue as any[]).map((row) => (row as any[]).map((cell) => formatCell(cell))),
      };
    }

    if (rowsValue.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))) {
      const recordRows = rowsValue as Record<string, GSValue>[];
      const inferredColumns = columns.length ? columns : Array.from(new Set(recordRows.flatMap((row) => Object.keys(row))));
      return {
        title: decl.name,
        columns: inferredColumns,
        rows: recordRows.map((row) => inferredColumns.map((column) => formatCell(row[column]))),
      };
    }
  }

  return { title: decl.name, columns, rows: [] };
}

export function planTableLayout(
  decl: TableDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): TableLayoutPlan {
  const defaults = readSpacingDefaults('table');
  const table = buildTableData(decl, values, traces);
  const explicitWidth = hasExplicitProperty(decl.properties.width);
  const explicitHeight = hasExplicitProperty(decl.properties.height);
  const paddingValue = resolveValue(decl.properties.padding, values, traces);
  const rowHeightValue = resolveValue(decl.properties.row_height, values, traces);
  const fontSizeValue = resolveValue(decl.properties.font_size, values, traces);
  const headerHeightValue = resolveValue(decl.properties.header_height, values, traces);
  const padding = Math.max(16, typeof paddingValue === 'number' ? paddingValue : defaults.spacing.padding);
  const rowHeight = Math.max(28, typeof rowHeightValue === 'number' ? rowHeightValue : 32);
  const fontSize = Math.max(12, typeof fontSizeValue === 'number' ? fontSizeValue : 12);
  const headerHeight = Math.max(36, typeof headerHeightValue === 'number' ? headerHeightValue : 36);
  const sizeMode = readRendererSizeMode(decl.properties.size_mode, values, traces, 'dynamic');
  const widths = table.columns.map((column, index) => {
    const contentWidths = table.rows.map((row) => estimateWidth(row[index] ?? '', fontSize));
    return Math.max(estimateWidth(column, fontSize, true), ...contentWidths, 96);
  });
  const tableWidth = widths.reduce((sum, value) => sum + value, 0);
  const computedWidth = Math.max(defaults.minWidth, tableWidth + padding * 2);
  const computedHeight = padding * 2 + headerHeight + table.rows.length * rowHeight + 24;
  const requestedWidth = Number(resolveValue(decl.properties.width, values, traces) ?? defaults.width);
  const requestedHeight = Number(resolveValue(decl.properties.height, values, traces) ?? defaults.height);
  const width = resolveRendererExtent(
    explicitWidth,
    requestedWidth,
    defaults.width,
    sizeMode,
    computedWidth,
    defaults.minWidth,
  );
  const height = resolveRendererExtent(
    explicitHeight,
    requestedHeight,
    defaults.height,
    sizeMode,
    computedHeight,
    defaults.minHeight,
  );

  return { table, width, height, padding, rowHeight, headerHeight, fontSize, widths };
}

export function renderTable(plan: TableLayoutPlan): string {
  const { table, width, height, padding, rowHeight, headerHeight, widths } = plan;
  const tableWidth = widths.reduce((sum, value) => sum + value, 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  if (table.title) {
    svg += `<text x="${width / 2}" y="24" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">${escapeXml(table.title)}</text>`;
  }

  const top = padding + 18;
  let currentX = padding;

  svg += `<rect x="${padding}" y="${top}" width="${tableWidth}" height="${headerHeight}" fill="#e2e8f0" rx="8"/>`;
  table.columns.forEach((column, index) => {
    const cellWidth = widths[index];
    svg += `<text x="${currentX + 12}" y="${top + 22}" font-size="12" font-weight="700" fill="#0f172a">${escapeXml(column)}</text>`;
    if (index > 0) {
      svg += `<line x1="${currentX}" y1="${top}" x2="${currentX}" y2="${top + headerHeight + table.rows.length * rowHeight}" stroke="#cbd5e1"/>`;
    }
    currentX += cellWidth;
  });

  table.rows.forEach((row, rowIndex) => {
    const y = top + headerHeight + rowIndex * rowHeight;
    const fill = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
    svg += `<rect x="${padding}" y="${y}" width="${tableWidth}" height="${rowHeight}" fill="${fill}"/>`;
    let cellX = padding;
    row.forEach((cell, cellIndex) => {
      svg += `<text x="${cellX + 12}" y="${y + 21}" font-size="12" fill="#334155">${escapeXml(cell)}</text>`;
      cellX += widths[cellIndex] ?? 96;
    });
    svg += `<line x1="${padding}" y1="${y + rowHeight}" x2="${padding + tableWidth}" y2="${y + rowHeight}" stroke="#e2e8f0"/>`;
  });

  svg += `<rect x="${padding}" y="${top}" width="${tableWidth}" height="${headerHeight + table.rows.length * rowHeight}" fill="none" stroke="#94a3b8" rx="8"/>`;
  svg += `</svg>`;
  return svg;
}

function resolveValue(expr: Expression | undefined, values: Record<string, GSValue>, traces: Map<string, Trace>): any {
  if (!expr) return undefined;
  switch (expr.type) {
    case 'Literal':
      return expr.value;
    case 'Identifier':
      return values[expr.name];
    case 'ArrayExpression':
      return expr.elements.map((element) => resolveValue(element, values, traces));
    case 'ObjectExpression':
      return Object.fromEntries(expr.properties.map((prop) => [prop.key, resolveValue(prop.value, values, traces)]));
    case 'MemberExpression': {
      if (expr.property === 'trace' && expr.object.type === 'Identifier') return traces.get(expr.object.name);
      const object = resolveValue(expr.object, values, traces);
      return object?.[expr.property];
    }
    case 'IndexExpression': {
      const object = resolveValue(expr.object, values, traces);
      const index = resolveValue(expr.index, values, traces);
      return Array.isArray(object) ? object[index] : object?.[index];
    }
    default:
      return undefined;
  }
}

function formatCell(value: GSValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function estimateWidth(text: string, fontSize: number, bold = false): number {
  return text.length * (bold ? fontSize * 0.68 : fontSize * 0.62) + 24;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
