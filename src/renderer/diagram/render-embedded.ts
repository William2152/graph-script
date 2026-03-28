import { escapeXml, extractSvgDocument, fitIntoBox, round } from '../common';
import { renderRichTextBlock } from '../latex';
import { ElementRenderState } from './render-state';
import { resolveString } from './render-utils';

export async function renderEmbedElement(state: ElementRenderState): Promise<string> {
  const target = resolveString(state, 'target', state.label);
  const embedded = await state.renderEmbed(target);
  if (embedded) {
    const doc = extractSvgDocument(embedded);
    const fit = fitIntoBox(doc.width, doc.height, state.w, state.h);
    return `<g transform="translate(${round(state.x + fit.dx)}, ${round(state.y + fit.dy)}) scale(${round(fit.scale, 4)})">${doc.svg}</g>`;
  }
  return `<rect x="${round(state.x)}" y="${round(state.y)}" width="${round(state.w)}" height="${round(state.h)}" fill="#f1f5f9" stroke="#cbd5e1" rx="12"/><text x="${round(state.x + state.w / 2)}" y="${round(state.y + state.h / 2)}" text-anchor="middle" font-size="14" font-family="${escapeXml(state.fontFamily)}" fill="#475569">Missing embed: ${escapeXml(target)}</text>`;
}

export async function renderFallback(state: ElementRenderState): Promise<string> {
  const { x, y, w, h, fill, stroke, label, color, latexMode, fontFamily } = state;
  let svg = `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="12" fill="${fill}" stroke="${stroke}"/>`;
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
      fontFamily,
    });
    svg += block.svg;
  }
  return svg;
}
