import { escapeXml, extractSvgDocument, round } from '../common';
import { renderRichTextBlock } from '../latex';
import { fitIntoBoxWithReadableScale, resolveReadabilityMode } from '../readability-policy';
import { ElementRenderState } from './render-state';
import { resolveString } from './render-utils';

export async function renderEmbedElement(state: ElementRenderState): Promise<string> {
  const target = resolveString(state, 'target', state.label);
  const embedded = await state.renderEmbed(target);
  if (embedded) {
    const doc = extractSvgDocument(embedded);
    const readabilityMode = resolveReadabilityMode(resolveString(state, 'readability_mode', 'auto'), 'auto');
    let fit = readabilityMode === 'legacy'
      ? fitIntoBoxWithReadableScale(doc.width, doc.height, state.w, state.h, { minScale: 0.1, verticalAlign: 'center' })
      : fitIntoBoxWithReadableScale(doc.width, doc.height, state.w, state.h, { verticalAlign: 'top' });
    if (readabilityMode !== 'legacy' && (fit.requiredWidth > state.w + 0.1 || fit.requiredHeight > state.h + 0.1)) {
      fit = fitIntoBoxWithReadableScale(doc.width, doc.height, state.w, state.h, { minScale: 0.1, verticalAlign: 'top' });
    }
    const dy = readabilityMode === 'legacy' ? fit.dy : 0;
    return `<g transform="translate(${round(state.x + fit.dx)}, ${round(state.y + dy)}) scale(${round(fit.scale, 4)})">${doc.svg}</g>`;
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
