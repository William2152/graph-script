import * as fs from 'fs';
import * as path from 'path';
import { DiagramDeclaration, DiagramElement } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { asStringArray, escapeXml, extractSvgDocument, fitIntoBox, readBoolean, readNumber, readString, renderFormulaText, resolveValue, round, svgDocument, wrapText } from './common';

interface RenderEmbed {
  (target: string): string | null;
}

export function renderDiagram(decl: DiagramDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string): string {
  const width = readNumber(resolveValue(decl.properties.width, values, traces), 1280);
  const height = readNumber(resolveValue(decl.properties.height, values, traces), 720);
  const background = readString(resolveValue(decl.properties.background, values, traces), '#f8fafc');
  const title = readString(resolveValue(decl.properties.title, values, traces), decl.name);
  const subtitle = readString(resolveValue(decl.properties.subtitle, values, traces), '');

  let body = '';
  if (title) body += `<text x="${width / 2}" y="58" text-anchor="middle" font-size="36" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>`;
  if (subtitle) body += `<text x="${width / 2}" y="92" text-anchor="middle" font-size="18" fill="#64748b">${escapeXml(subtitle)}</text>`;
  body += renderElements(decl.elements, values, traces, renderEmbed, assetBaseDir, 0, 0);
  return svgDocument(width, height, body, background);
}

function renderElements(elements: DiagramElement[], values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string, offsetX: number, offsetY: number): string {
  return elements.map((element) => renderElement(element, values, traces, renderEmbed, assetBaseDir, offsetX, offsetY)).join('');
}

function renderElement(element: DiagramElement, values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string, offsetX: number, offsetY: number): string {
  const x = offsetX + readNumber(resolveValue(element.properties.x, values, traces), 0);
  const y = offsetY + readNumber(resolveValue(element.properties.y, values, traces), 0);
  const w = readNumber(resolveValue(element.properties.w, values, traces), 200);
  const h = readNumber(resolveValue(element.properties.h, values, traces), 120);
  const defaultStroke = ['line', 'arrow'].includes(element.type) ? '#64748b' : '#cbd5e1';
  const fill = readString(resolveValue(element.properties.fill, values, traces), '#ffffff');
  const stroke = readString(resolveValue(element.properties.stroke, values, traces), defaultStroke);
  const label = readString(resolveValue(element.properties.label, values, traces), element.name);
  const subtitle = readString(resolveValue(element.properties.subtitle, values, traces), '');
  const color = readString(resolveValue(element.properties.color, values, traces), '#0f172a');
  const radius = readNumber(resolveValue(element.properties.radius, values, traces), 16);
  const textSize = readNumber(resolveValue(element.properties.size, values, traces), 16);
  const weight = readString(resolveValue(element.properties.weight, values, traces), '600');
  const dash = readString(resolveValue(element.properties.dash, values, traces), '');
  const strokeWidth = readNumber(resolveValue(element.properties.strokeWidth, values, traces), ['line', 'arrow'].includes(element.type) ? 3 : 1.5);
  const fillOpacity = readNumber(resolveValue(element.properties.fillOpacity, values, traces), 1);
  const strokeOpacity = readNumber(resolveValue(element.properties.strokeOpacity, values, traces), 1);
  const gridRows = Math.max(1, readNumber(resolveValue(element.properties.rows, values, traces), 4));
  const gridCols = Math.max(1, readNumber(resolveValue(element.properties.cols, values, traces), 4));
  const shadow = readBoolean(resolveValue(element.properties.shadow, values, traces), ['panel', 'box', 'callout', 'badge'].includes(element.type));
  const dashAttr = dash ? ` stroke-dasharray="${escapeXml(dash)}"` : '';
  const fillOpacityAttr = fillOpacity < 1 ? ` fill-opacity="${round(fillOpacity, 3)}"` : '';
  const strokeOpacityAttr = strokeOpacity < 1 ? ` stroke-opacity="${round(strokeOpacity, 3)}"` : '';

  let svg = '';
  if (shadow) svg += `<rect x="${round(x + 6)}" y="${round(y + 8)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="#94a3b8" fill-opacity="0.12"/>`;

  switch (element.type) {
    case 'panel':
    case 'box': {
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      const titleLines = wrapText(label, Math.max(10, Math.floor(w / 11)), 3);
      titleLines.forEach((line, index) => {
        svg += `<text x="${round(x + w / 2)}" y="${round(y + 34 + index * 20)}" text-anchor="middle" font-size="${Math.max(18, textSize)}" font-weight="800" fill="${color}">${escapeXml(line)}</text>`;
      });
      const subtitleLines = wrapText(subtitle, Math.max(12, Math.floor(w / 12)), 4);
      subtitleLines.forEach((line, index) => {
        svg += `<text x="${round(x + w / 2)}" y="${round(y + 34 + titleLines.length * 20 + 10 + index * 16)}" text-anchor="middle" font-size="14" fill="#64748b">${escapeXml(line)}</text>`;
      });
      if (element.children?.length) svg += renderElements(element.children, values, traces, renderEmbed, assetBaseDir, x, y);
      break;
    }
    case 'grid': {
      const cellW = w / gridCols;
      const cellH = h / gridRows;
      for (let row = 0; row < gridRows; row += 1) {
        for (let col = 0; col < gridCols; col += 1) {
          svg += `<rect x="${round(x + col * cellW)}" y="${round(y + row * cellH)}" width="${round(cellW - 2)}" height="${round(cellH - 2)}" rx="6" fill="${fill}" stroke="#ffffff" stroke-width="2"/>`;
        }
      }
      break;
    }
    case 'checker': {
      const colors = asStringArray(resolveValue(element.properties.colors, values, traces));
      const a = colors[0] ?? '#2563eb';
      const b = colors[1] ?? '#f97316';
      const cellW = w / gridCols;
      const cellH = h / gridRows;
      for (let row = 0; row < gridRows; row += 1) {
        for (let col = 0; col < gridCols; col += 1) {
          const colorFill = (row + col) % 2 === 0 ? a : b;
          svg += `<rect x="${round(x + col * cellW)}" y="${round(y + row * cellH)}" width="${round(cellW - 2)}" height="${round(cellH - 2)}" rx="6" fill="${colorFill}" stroke="#ffffff" stroke-width="2"/>`;
        }
      }
      break;
    }
    case 'text': {
      const value = readString(resolveValue(element.properties.value, values, traces), label);
      const anchor = readString(resolveValue(element.properties.anchor, values, traces), 'start');
      const lines = value.split(/\n/g);
      lines.forEach((line, index) => {
        svg += `<text x="${round(x)}" y="${round(y + index * (textSize + 4))}" text-anchor="${anchor}" font-size="${textSize}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`;
      });
      break;
    }
    case 'formula': {
      const value = readString(resolveValue(element.properties.value, values, traces), label);
      svg += renderFormulaText(value, x, y, {
        fontSize: textSize || 22,
        color,
        anchor: 'middle',
        weight: '500',
      });
      break;
    }
    case 'circle': {
      const radiusPx = Math.min(w, h) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radiusPx)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth || 1.8}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      if (label) svg += `<text x="${round(cx)}" y="${round(cy + textSize / 3)}" text-anchor="middle" font-size="${Math.max(14, textSize)}" font-weight="700" fill="${color}">${escapeXml(label)}</text>`;
      break;
    }
    case 'ellipse': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(w / 2)}" ry="${round(h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth || 1.8}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      if (label) svg += `<text x="${round(cx)}" y="${round(cy + textSize / 3)}" text-anchor="middle" font-size="${Math.max(14, textSize)}" font-weight="700" fill="${color}">${escapeXml(label)}</text>`;
      break;
    }
    case 'badge':
    case 'callout': {
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      const lines = wrapText(label, Math.max(10, Math.floor(w / 11)), 5);
      lines.forEach((line, index) => {
        svg += `<text x="${round(x + w / 2)}" y="${round(y + 28 + index * 18)}" text-anchor="middle" font-size="${index === 0 ? Math.max(14, textSize) : 13}" font-weight="${index === 0 ? '800' : '500'}" fill="${color}">${escapeXml(line)}</text>`;
      });
      if (subtitle) svg += `<text x="${round(x + w / 2)}" y="${round(y + h - 14)}" text-anchor="middle" font-size="12" fill="#64748b">${escapeXml(subtitle)}</text>`;
      break;
    }
    case 'image': {
      const srcValue = resolveValue(element.properties.src, values, traces);
      const href = loadImageHref(srcValue, assetBaseDir);
      const fit = readString(resolveValue(element.properties.fit, values, traces), 'contain');
      const imageOpacity = readNumber(resolveValue(element.properties.opacity, values, traces), 1);
      const preserveAspectRatio = fit === 'stretch'
        ? 'none'
        : fit === 'cover'
          ? 'xMidYMid slice'
          : 'xMidYMid meet';
      const clipId = `clip-${sanitizeId(element.name)}-${Math.abs(Math.round(x))}-${Math.abs(Math.round(y))}`;
      const clipAttr = radius > 0 ? ` clip-path="url(#${clipId})"` : '';

      if (fill && fill !== 'none') {
        svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="${fill}"${fillOpacityAttr}/>`;
      }
      if (radius > 0) {
        svg += `<defs><clipPath id="${clipId}"><rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}"/></clipPath></defs>`;
      }
      svg += `<image href="${escapeXml(href)}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" preserveAspectRatio="${preserveAspectRatio}" opacity="${round(imageOpacity, 3)}"${clipAttr}/>`;
      if (stroke && stroke !== 'none' && strokeWidth > 0) {
        svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${strokeOpacityAttr}/>`;
      }
      break;
    }
    case 'arrow':
    case 'line': {
      const x2 = offsetX + readNumber(resolveValue(element.properties.x2, values, traces), x + w);
      const y2 = offsetY + readNumber(resolveValue(element.properties.y2, values, traces), y + h);
      const arrow = element.type === 'arrow';
      if (arrow) svg += `<defs><marker id="arrow-${escapeXml(element.name)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}"/></marker></defs>`;
      svg += `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${strokeOpacityAttr} ${arrow ? `marker-end="url(#arrow-${escapeXml(element.name)})"` : ''}/>`;
      if (label) svg += `<text x="${round((x + x2) / 2)}" y="${round((y + y2) / 2 - 8)}" text-anchor="middle" font-size="12" fill="${color}">${escapeXml(label)}</text>`;
      break;
    }
    case 'embed': {
      const target = readString(resolveValue(element.properties.target, values, traces), label);
      const embedded = renderEmbed(target);
      if (embedded) {
        const doc = extractSvgDocument(embedded);
        const fit = fitIntoBox(doc.width, doc.height, w, h);
        svg += `<g transform="translate(${round(x + fit.dx)}, ${round(y + fit.dy)}) scale(${round(fit.scale, 4)})">${doc.svg}</g>`;
      } else {
        svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="#f1f5f9" stroke="#cbd5e1" rx="12"/>`;
        svg += `<text x="${round(x + w / 2)}" y="${round(y + h / 2)}" text-anchor="middle" font-size="14" fill="#475569">Missing embed: ${escapeXml(target)}</text>`;
      }
      break;
    }
    default:
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="12" fill="${fill}" stroke="${stroke}"/>`;
      svg += `<text x="${round(x + w / 2)}" y="${round(y + h / 2)}" text-anchor="middle" font-size="14" fill="${color}">${escapeXml(label)}</text>`;
      if (element.children?.length) svg += renderElements(element.children, values, traces, renderEmbed, assetBaseDir, x, y);
      break;
  }
  return svg;
}

function loadImageHref(srcValue: unknown, assetBaseDir: string): string {
  const source = resolveImageSource(srcValue);
  if (!source) throw new Error('Image element requires a valid src');
  const absolutePath = path.isAbsolute(source.path) ? source.path : path.resolve(assetBaseDir, source.path);
  if (!fs.existsSync(absolutePath)) throw new Error(`Image asset not found: ${absolutePath}`);

  const ext = (source.format || path.extname(absolutePath).slice(1)).toLowerCase();
  const mime = ext === 'png'
    ? 'image/png'
    : ext === 'svg'
      ? 'image/svg+xml'
      : null;
  if (!mime) throw new Error(`Unsupported image asset format: ${absolutePath}`);

  const encoded = fs.readFileSync(absolutePath).toString('base64');
  return `data:${mime};base64,${encoded}`;
}

function resolveImageSource(srcValue: unknown): { path: string; format: string } | null {
  if (typeof srcValue === 'string' && srcValue.trim()) {
    return { path: srcValue, format: path.extname(srcValue).slice(1).toLowerCase() };
  }
  if (srcValue && typeof srcValue === 'object') {
    const candidate = srcValue as Record<string, unknown>;
    if (candidate.type === 'imageAsset' && typeof candidate.path === 'string') {
      const format = typeof candidate.format === 'string' && candidate.format
        ? candidate.format.toLowerCase()
        : path.extname(candidate.path).slice(1).toLowerCase();
      return { path: candidate.path, format };
    }
  }
  return null;
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}
