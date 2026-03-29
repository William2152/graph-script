import { GSValue, Trace } from '../runtime/values';
import { readNumber, resolveValue, svgDocument, escapeXml, round } from './common';
import { ErdDeclaration } from '../ast/types';
import {
  hasExplicitProperty,
  readRendererSizeMode,
  readSpacingDefaults,
  resolveRendererExtent,
} from './readability-policy';

interface ErdTableLayout {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ErdLayoutPlan {
  width: number;
  height: number;
  tables: ErdTableLayout[];
}

export function planErdLayout(
  decl: ErdDeclaration,
  values: Record<string, GSValue> = {},
  traces: Map<string, Trace> = new Map(),
): ErdLayoutPlan {
  const defaults = readSpacingDefaults('erd');
  const explicitWidth = hasExplicitProperty((decl as any).properties?.width);
  const explicitHeight = hasExplicitProperty((decl as any).properties?.height);
  const requestedWidth = readNumber(resolveValue((decl as any).properties?.width, values, traces), defaults.width);
  const requestedHeight = readNumber(resolveValue((decl as any).properties?.height, values, traces), defaults.height);
  const sizeMode = readRendererSizeMode((decl as any).properties?.size_mode, values, traces, 'dynamic');
  const margin = defaults.spacing.margin;
  const gap = defaults.spacing.gap;
  const titleOffset = 78;
  const tableLayouts = decl.tables.map((table) => {
    const fieldWidth = Math.max(
      ...table.fields.map((field) =>
        Math.max(field.name.length * 8 + 36, (field.fieldType + (field.constraints.length ? ` [${field.constraints.join(', ')}]` : '')).length * 7 + 36)),
      220,
    );
    return {
      name: table.name,
      w: Math.max(240, table.name.length * 9 + fieldWidth),
      h: 58 + table.fields.length * 28,
    };
  });

  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(tableLayouts.length, 1))));
  const rows = Math.max(1, Math.ceil(tableLayouts.length / columns));
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(...tableLayouts.filter((_, index) => index % columns === column).map((table) => table.w), 240));
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(...tableLayouts.filter((_, index) => Math.floor(index / columns) === row).map((table) => table.h), 120));

  const tables = tableLayouts.map((table, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + columnWidths.slice(0, col).reduce((sum, value) => sum + value, 0) + gap * col;
    const y = titleOffset + rowHeights.slice(0, row).reduce((sum, value) => sum + value, 0) + gap * row;
    return { name: table.name, x, y, w: table.w, h: table.h };
  });

  const maxRight = Math.max(...tables.map((table) => table.x + table.w), margin + defaults.minWidth - margin);
  const maxBottom = Math.max(...tables.map((table) => table.y + table.h), titleOffset + defaults.minHeight - margin);

  return {
    width: resolveRendererExtent(
      explicitWidth,
      requestedWidth,
      defaults.width,
      sizeMode,
      Math.ceil(maxRight + margin),
      defaults.minWidth,
    ),
    height: resolveRendererExtent(
      explicitHeight,
      requestedHeight,
      defaults.height,
      sizeMode,
      Math.ceil(maxBottom + margin),
      defaults.minHeight,
    ),
    tables,
  };
}

export function renderErd(
  decl: ErdDeclaration,
  values: Record<string, GSValue> = {},
  traces: Map<string, Trace> = new Map(),
): string {
  const plan = planErdLayout(decl, values, traces);
  const positions = new Map(plan.tables.map((table) => [table.name, table]));

  let body = '';
  body += `<text x="${plan.width / 2}" y="42" text-anchor="middle" font-size="28" font-weight="800" fill="#0f172a">${escapeXml(decl.name)}</text>`;

  decl.relationships.forEach((relationship, index) => {
    const fromTable = relationship.from.split('.')[0];
    const toTable = relationship.to.split('.')[0];
    const a = positions.get(fromTable);
    const b = positions.get(toTable);
    if (!a || !b) return;
    const startX = a.x + a.w;
    const startY = a.y + a.h / 2 + index * 2;
    const endX = b.x;
    const endY = b.y + b.h / 2 - index * 2;
    const midX = (startX + endX) / 2;
    body += `<defs><marker id="erd-arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>`;
    body += `<path d="M ${round(startX)} ${round(startY)} C ${round(midX)} ${round(startY)}, ${round(midX)} ${round(endY)}, ${round(endX)} ${round(endY)}" fill="none" stroke="#64748b" stroke-width="2" marker-end="url(#erd-arrow-${index})"/>`;
    body += `<text x="${round(midX)}" y="${round((startY + endY) / 2 - 8)}" text-anchor="middle" font-size="11" fill="#475569">${escapeXml(relationship.cardinality)}</text>`;
  });

  decl.tables.forEach((table) => {
    const pos = positions.get(table.name);
    if (!pos) return;
    body += `<rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="16" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>`;
    body += `<rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="40" rx="16" fill="#1d4ed8"/>`;
    body += `<rect x="${pos.x}" y="${pos.y + 22}" width="${pos.w}" height="18" fill="#1d4ed8"/>`;
    body += `<text x="${pos.x + pos.w / 2}" y="${pos.y + 26}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">${escapeXml(table.name)}</text>`;
    table.fields.forEach((field, index) => {
      const y = pos.y + 58 + index * 28;
      if (index % 2 === 0) body += `<rect x="${pos.x + 1}" y="${y - 16}" width="${pos.w - 2}" height="28" fill="#f8fafc"/>`;
      const constraintText = field.constraints.length ? ` [${field.constraints.join(', ')}]` : '';
      body += `<text x="${pos.x + 14}" y="${y}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(field.name)}</text>`;
      body += `<text x="${pos.x + pos.w - 14}" y="${y}" text-anchor="end" font-size="12" fill="#475569">${escapeXml(field.fieldType + constraintText)}</text>`;
    });
  });

  return svgDocument(plan.width, plan.height, body, '#f8fafc');
}
