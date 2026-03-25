import * as fs from 'fs';
import * as path from 'path';
import { DiagramDeclaration, DiagramElement } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { asStringArray, escapeXml, extractSvgDocument, fitIntoBox, readBoolean, readNumber, readString, resolveValue, round, svgDocument } from './common';
import { compileSemanticDiagram } from './diagram-semantic';
import { readLatexMode, renderDisplayFormula, renderRichTextBlock } from './latex';

interface RenderEmbed {
  (target: string): Promise<string | null>;
}

export async function renderDiagram(decl: DiagramDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string): Promise<string> {
  const width = readNumber(resolveValue(decl.properties.width, values, traces), 1280);
  const requestedHeight = readNumber(resolveValue(decl.properties.height, values, traces), 720);
  const background = readString(resolveValue(decl.properties.background, values, traces), '#f8fafc');
  const title = readString(resolveValue(decl.properties.title, values, traces), decl.name);
  const subtitle = readString(resolveValue(decl.properties.subtitle, values, traces), '');
  const compiled = await compileSemanticDiagram(decl.elements, values, traces, width, requestedHeight);
  const height = Math.max(requestedHeight, compiled.minHeight);

  let body = '';
  if (title) {
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
    });
    body += renderedTitle.svg;
  }
  if (subtitle) {
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
    });
    body += renderedSubtitle.svg;
  }
  body += await renderElements(compiled.elements, values, traces, renderEmbed, assetBaseDir, 0, 0);
  return svgDocument(width, height, body, background);
}

async function renderElements(elements: DiagramElement[], values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string, offsetX: number, offsetY: number): Promise<string> {
  const rendered = await Promise.all(elements.map((element) => renderElement(element, values, traces, renderEmbed, assetBaseDir, offsetX, offsetY)));
  return rendered.join('');
}

async function renderElement(element: DiagramElement, values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, assetBaseDir: string, offsetX: number, offsetY: number): Promise<string> {
  const x = offsetX + readNumber(resolveValue(element.properties.x, values, traces), 0);
  const y = offsetY + readNumber(resolveValue(element.properties.y, values, traces), 0);
  const w = readNumber(resolveValue(element.properties.w, values, traces), 200);
  const h = readNumber(resolveValue(element.properties.h, values, traces), 120);
  const defaultStroke = ['line', 'arrow'].includes(element.type) ? '#64748b' : '#cbd5e1';
  const fill = readString(resolveValue(element.properties.fill, values, traces), '#ffffff');
  const stroke = readString(resolveValue(element.properties.stroke, values, traces), defaultStroke);
  const labelFallback = ['line', 'arrow', 'image'].includes(element.type) ? '' : element.name;
  const label = readString(resolveValue(element.properties.label, values, traces), labelFallback);
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
  const latexMode = readLatexMode(resolveValue(element.properties.latex, values, traces), 'auto');
  const dashAttr = dash ? ` stroke-dasharray="${escapeXml(dash)}"` : '';
  const fillOpacityAttr = fillOpacity < 1 ? ` fill-opacity="${round(fillOpacity, 3)}"` : '';
  const strokeOpacityAttr = strokeOpacity < 1 ? ` stroke-opacity="${round(strokeOpacity, 3)}"` : '';

  let svg = '';
  if (shadow) svg += `<rect x="${round(x + 6)}" y="${round(y + 8)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="#94a3b8" fill-opacity="0.12"/>`;

  switch (element.type) {
    case 'panel':
    case 'box': {
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      const titleBlock = label
        ? await renderRichTextBlock(label, {
            x: x + w / 2,
            y: y + 18,
            maxWidth: w - 28,
            fontSize: Math.max(18, textSize),
            weight: '800',
            color,
            anchor: 'middle',
            maxLines: 3,
            latex: latexMode,
          })
        : { svg: '', height: 0, lines: 0 };
      svg += titleBlock.svg;
      const subtitleBlock = subtitle
        ? await renderRichTextBlock(subtitle, {
            x: x + w / 2,
            y: y + 22 + titleBlock.height,
            maxWidth: w - 32,
            fontSize: 14,
            weight: '500',
            color: '#64748b',
            anchor: 'middle',
            maxLines: 4,
            latex: latexMode,
          })
        : { svg: '', height: 0, lines: 0 };
      svg += subtitleBlock.svg;
      if (element.children?.length) svg += await renderElements(element.children, values, traces, renderEmbed, assetBaseDir, x, y);
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
      const block = await renderRichTextBlock(value, {
        x,
        y,
        maxWidth: w,
        fontSize: textSize,
        weight,
        color,
        anchor: anchor as 'start' | 'middle' | 'end',
        maxLines: Math.max(1, Math.floor(h / Math.max(textSize + 4, 1))) || 6,
        latex: latexMode,
      });
      svg += block.svg;
      break;
    }
    case 'formula': {
      const value = readString(resolveValue(element.properties.value, values, traces), label);
      svg += await renderDisplayFormula(value, x, y, {
        fontSize: textSize || 22,
        color,
        anchor: 'middle',
      });
      break;
    }
    case 'circle': {
      const radiusPx = Math.min(w, h) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radiusPx)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth || 1.8}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      if (label) {
        const block = await renderRichTextBlock(label, {
          x: cx,
          y: cy - Math.max(textSize, 14) / 2,
          maxWidth: w - 18,
          fontSize: Math.max(14, textSize),
          weight: '700',
          color,
          anchor: 'middle',
          maxLines: 3,
          latex: latexMode,
        });
        svg += block.svg;
      }
      break;
    }
    case 'ellipse': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(w / 2)}" ry="${round(h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth || 1.8}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      if (label) {
        const block = await renderRichTextBlock(label, {
          x: cx,
          y: cy - Math.max(textSize, 14) / 2,
          maxWidth: w - 18,
          fontSize: Math.max(14, textSize),
          weight: '700',
          color,
          anchor: 'middle',
          maxLines: 3,
          latex: latexMode,
        });
        svg += block.svg;
      }
      break;
    }
    case 'badge':
    case 'callout': {
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${fillOpacityAttr}${strokeOpacityAttr}/>`;
      const labelBlock = label
        ? await renderRichTextBlock(label, {
            x: x + w / 2,
            y: y + 14,
            maxWidth: w - 20,
            fontSize: Math.max(14, textSize),
            weight: '800',
            color,
            anchor: 'middle',
            maxLines: 5,
            latex: latexMode,
          })
        : { svg: '', height: 0, lines: 0 };
      svg += labelBlock.svg;
      if (subtitle) {
        const subtitleBlock = await renderRichTextBlock(subtitle, {
          x: x + w / 2,
          y: Math.max(y + h - 30, y + 18 + labelBlock.height),
          maxWidth: w - 20,
          fontSize: 12,
          weight: '500',
          color: '#64748b',
          anchor: 'middle',
          maxLines: 2,
          latex: latexMode,
        });
        svg += subtitleBlock.svg;
      }
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
        svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${radius}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}${strokeOpacityAttr}/>`;
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
      if (label) {
        const labelBlock = await renderRichTextBlock(label, {
          x: (x + x2) / 2,
          y: (y + y2) / 2 - 24,
          maxWidth: Math.max(120, Math.abs(x2 - x) - 16),
          fontSize: 12,
          weight: '500',
          color,
          anchor: 'middle',
          maxLines: 2,
          latex: latexMode,
        });
        svg += labelBlock.svg;
      }
      break;
    }
    case 'embed': {
      const target = readString(resolveValue(element.properties.target, values, traces), label);
      const embedded = await renderEmbed(target);
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
      if (label) {
        const block = await renderRichTextBlock(label, {
          x: x + w / 2,
          y: y + h / 2 - 10,
          maxWidth: w - 20,
          fontSize: 14,
          weight: '600',
          color,
          anchor: 'middle',
          maxLines: 3,
          latex: latexMode,
        });
        svg += block.svg;
      }
      if (element.children?.length) svg += await renderElements(element.children, values, traces, renderEmbed, assetBaseDir, x, y);
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
