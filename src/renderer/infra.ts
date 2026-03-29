import { InfraDeclaration, InfraElement } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { escapeXml, readNumber, readString, resolveValue, round, svgDocument } from './common';
import {
  hasExplicitProperty,
  readRendererLayoutMode,
  readRendererSizeMode,
  resolveRendererExtent,
  readSpacingDefaults,
} from './readability-policy';

interface InfraNodeLayout {
  name: string;
  type: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InfraLayoutPlan {
  width: number;
  height: number;
  titleY: number;
  subtitleY: number;
  nodes: InfraNodeLayout[];
}

export function planInfraLayout(
  decl: InfraDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): InfraLayoutPlan {
  const defaults = readSpacingDefaults('infra');
  const explicitWidth = hasExplicitProperty(decl.properties.width);
  const explicitHeight = hasExplicitProperty(decl.properties.height);
  const requestedWidth = readNumber(resolveValue(decl.properties.width, values, traces), defaults.width);
  const requestedHeight = readNumber(resolveValue(decl.properties.height, values, traces), defaults.height);
  const layoutMode = readRendererLayoutMode(decl.properties.layout_mode, values, traces, 'dynamic');
  const sizeMode = readRendererSizeMode(decl.properties.size_mode, values, traces, 'dynamic');
  const margin = Math.max(32, readNumber(resolveValue(decl.properties.margin, values, traces), defaults.spacing.margin));
  const gap = Math.max(20, readNumber(resolveValue(decl.properties.gap, values, traces), defaults.spacing.gap));
  const topOffset = 112;
  const columns = Math.max(1, Math.round(readNumber(resolveValue(decl.properties.columns, values, traces), Math.ceil(Math.sqrt(Math.max(decl.elements.length, 1))))));

  const nodeSpecs = decl.elements.map((element) => {
    const label = readString(resolveValue(element.properties.label, values, traces), element.name);
    const estimated = estimateInfraElementSize(element.type, label);
    return {
      element,
      type: element.type,
      label,
      w: readNumber(resolveValue(element.properties.w, values, traces), estimated.w),
      h: readNumber(resolveValue(element.properties.h, values, traces), estimated.h),
    };
  });

  const positions = layoutMode === 'manual'
    ? nodeSpecs.map((entry, index) => ({
        name: entry.element.name,
        type: entry.type,
        label: entry.label,
        w: entry.w,
        h: entry.h,
        x: readNumber(resolveValue(entry.element.properties.x, values, traces), margin + (index % columns) * (entry.w + gap)),
        y: readNumber(resolveValue(entry.element.properties.y, values, traces), topOffset + Math.floor(index / columns) * (entry.h + gap)),
      }))
    : autoLayoutInfraNodes(nodeSpecs, margin, topOffset, gap, columns);

  const maxRight = Math.max(...positions.map((position) => position.x + position.w), margin + defaults.minWidth - margin);
  const maxBottom = Math.max(...positions.map((position) => position.y + position.h), topOffset + defaults.minHeight - margin);

  return {
    width: resolveRendererExtent(
      explicitWidth,
      requestedWidth,
      defaults.width,
      sizeMode,
      Math.ceil(maxRight + margin),
      defaults.minWidth,
      layoutMode === 'manual',
    ),
    height: resolveRendererExtent(
      explicitHeight,
      requestedHeight,
      defaults.height,
      sizeMode,
      Math.ceil(maxBottom + margin),
      defaults.minHeight,
      layoutMode === 'manual',
    ),
    titleY: 42,
    subtitleY: 68,
    nodes: positions,
  };
}

export function renderInfra(decl: InfraDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>): string {
  const plan = planInfraLayout(decl, values, traces);
  const positions = new Map(plan.nodes.map((node) => [node.name, node]));

  let body = '';
  body += `<text x="${plan.width / 2}" y="${plan.titleY}" text-anchor="middle" font-size="30" font-weight="800" fill="#0f172a">${escapeXml(decl.name)}</text>`;
  body += `<text x="${plan.width / 2}" y="${plan.subtitleY}" text-anchor="middle" font-size="14" fill="#64748b">Provider: ${escapeXml(decl.provider)}</text>`;

  decl.connections.forEach((connection, index) => {
    const a = positions.get(connection.from);
    const b = positions.get(connection.to);
    if (!a || !b) return;
    const startX = a.x + a.w / 2;
    const startY = a.y + a.h;
    const endX = b.x + b.w / 2;
    const endY = b.y;
    const midY = (startY + endY) / 2;
    body += `<defs><marker id="infra-arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>`;
    body += `<path d="M ${round(startX)} ${round(startY)} L ${round(startX)} ${round(midY)} L ${round(endX)} ${round(midY)} L ${round(endX)} ${round(endY)}" fill="none" stroke="#475569" stroke-width="2.2" marker-end="url(#infra-arrow-${index})"/>`;
    if (connection.label) {
      body += `<text x="${round((startX + endX) / 2)}" y="${round(midY - 8)}" text-anchor="middle" font-size="11" fill="#475569">${escapeXml(connection.label)}</text>`;
    }
  });

  plan.nodes.forEach((node) => {
    body += renderInfraElement(node.x, node.y, node.w, node.h, node.type, node.label);
  });

  return svgDocument(plan.width, plan.height, body, '#f8fafc');
}

function autoLayoutInfraNodes(
  specs: Array<{ element: InfraElement; type: string; label: string; w: number; h: number }>,
  margin: number,
  topOffset: number,
  gap: number,
  columns: number,
): InfraNodeLayout[] {
  const rows = Math.max(1, Math.ceil(specs.length / Math.max(columns, 1)));
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(...specs.filter((_, index) => index % columns === column).map((entry) => entry.w), 180));
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(...specs.filter((_, index) => Math.floor(index / columns) === row).map((entry) => entry.h), 84));

  return specs.map((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + columnWidths.slice(0, col).reduce((sum, value) => sum + value, 0) + gap * col;
    const y = topOffset + rowHeights.slice(0, row).reduce((sum, value) => sum + value, 0) + gap * row;
    return {
      name: entry.element.name,
      type: entry.type,
      label: entry.label,
      w: entry.w,
      h: entry.h,
      x,
      y,
    };
  });
}

function estimateInfraElementSize(type: string, label: string): { w: number; h: number } {
  const kind = type.toLowerCase();
  const labelWidth = Math.max(120, label.length * 8 + 52);
  switch (kind) {
    case 'db':
    case 'database':
    case 'storage':
    case 'bucket':
      return { w: Math.max(170, labelWidth), h: 88 };
    case 'user':
    case 'internet':
      return { w: Math.max(144, labelWidth * 0.92), h: 80 };
    case 'queue':
    case 'topic':
      return { w: Math.max(168, labelWidth), h: 78 };
    default:
      return { w: Math.max(168, labelWidth), h: 76 };
  }
}

function renderInfraElement(x: number, y: number, w: number, h: number, type: string, label: string): string {
  const kind = type.toLowerCase();
  const theme = infraTheme(kind);
  let svg = '';
  switch (kind) {
    case 'user':
    case 'internet':
      svg += `<ellipse cx="${round(x + w / 2)}" cy="${round(y + h / 2)}" rx="${round(w / 2)}" ry="${round(h / 2)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      break;
    case 'db':
    case 'database':
      svg += `<ellipse cx="${round(x + w / 2)}" cy="${round(y + 12)}" rx="${round(w / 2)}" ry="12" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      svg += `<rect x="${round(x)}" y="${round(y + 12)}" width="${round(w)}" height="${round(h - 24)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      svg += `<ellipse cx="${round(x + w / 2)}" cy="${round(y + h - 12)}" rx="${round(w / 2)}" ry="12" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      break;
    case 'queue':
    case 'topic':
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="16" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      svg += `<path d="M ${round(x + 22)} ${round(y + h / 2)} h ${round(w - 44)}" stroke="${theme.stroke}" stroke-width="3" stroke-dasharray="10 6"/>`;
      break;
    default:
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="16" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2"/>`;
      break;
  }
  svg += `<text x="${round(x + w / 2)}" y="${round(y + h / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="700" fill="${theme.text}">${escapeXml(label)}</text>`;
  return svg;
}

function infraTheme(kind: string): { fill: string; stroke: string; text: string } {
  switch (kind) {
    case 'user':
    case 'internet':
      return { fill: '#e0f2fe', stroke: '#0284c7', text: '#075985' };
    case 'gateway':
    case 'api':
      return { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' };
    case 'lambda':
    case 'compute':
    case 'service':
      return { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' };
    case 'db':
    case 'database':
    case 'storage':
    case 'bucket':
      return { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' };
    case 'queue':
    case 'topic':
      return { fill: '#fff7ed', stroke: '#ea580c', text: '#9a3412' };
    default:
      return { fill: '#f8fafc', stroke: '#475569', text: '#0f172a' };
  }
}
