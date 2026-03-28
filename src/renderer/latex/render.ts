import { escapeXml, round } from '../common';
import {
  DEFAULT_FONT_FAMILY,
  FormulaMeasureResult,
  LatexMode,
  RichTextLineLayout,
  RichTextRenderOptions,
  RichTextRenderResult,
  RichToken,
} from './types';
import { hasLatexDelimiters, normalizeFormulaForLatex, normalizeRichTextForLatex, stripMathDelimiters } from './normalize';
import { EX_RATIO, measureTextWidth } from './measure';
import { renderMathFragment, renderPlacedMath } from './math-svg';

export { measureTextWidth } from './measure';

export async function measureDisplayFormula(
  value: string,
  options: {
    fontSize?: number;
  } = {},
): Promise<FormulaMeasureResult> {
  const fontSize = options.fontSize ?? 22;
  const normalizedValue = normalizeFormulaForLatex(value);
  const fragment = await renderMathFragment(normalizedValue, true, fontSize);
  return {
    width: fragment.width,
    height: fragment.height,
    ascent: fragment.ascent,
    fallback: fragment.fallback,
    normalizedValue,
  };
}

export async function renderDisplayFormula(
  value: string,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    color?: string;
    anchor?: 'start' | 'middle' | 'end';
  } = {},
): Promise<string> {
  const fontSize = options.fontSize ?? 22;
  const color = options.color ?? '#0f172a';
  const anchor = options.anchor ?? 'middle';
  const fragment = await renderMathFragment(normalizeFormulaForLatex(value), true, fontSize);
  return renderPlacedMath(fragment, x, y, anchor, color);
}

export async function measureRichTextBlock(value: string, options: RichTextRenderOptions) {
  const layout = await layoutRichText(value, options);
  return {
    width: layout.width,
    height: layout.height,
    lines: layout.lines.length,
    mathFallbackCount: layout.mathFallbackCount,
    normalizedValue: layout.normalizedValue,
  };
}

export async function renderRichTextBlock(value: string, options: RichTextRenderOptions): Promise<RichTextRenderResult> {
  const fontSize = options.fontSize ?? 16;
  const anchor = options.anchor ?? 'start';
  const color = options.color ?? '#0f172a';
  const weight = options.weight ?? '600';
  const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;
  const lineGap = options.lineGap ?? Math.max(6, Math.round(fontSize * 0.34));
  const lineHeight = fontSize + lineGap;
  const layout = await layoutRichText(value, options);

  let svg = '';
  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
    const line = layout.lines[lineIndex];
    const tokens = coalesceTextTokens(line.tokens);
    let cursorX = options.x;
    if (anchor === 'middle') cursorX -= line.width / 2;
    if (anchor === 'end') cursorX -= line.width;
    const baselineY = options.y + lineIndex * lineHeight + line.ascent;
    for (const token of tokens) {
      if (token.type === 'text') {
        if (token.value) {
          svg += `<text x="${round(cursorX)}" y="${round(baselineY)}" font-size="${round(fontSize)}" font-weight="${escapeXml(weight)}" font-family="${escapeXml(fontFamily)}" fill="${color}" xml:space="preserve">${escapeXml(token.value)}</text>`;
        }
        cursorX += measureTextWidth(token.value, fontSize, weight, fontFamily);
      } else {
        const fragment = await renderMathFragment(token.value, token.display, fontSize);
        svg += renderPlacedMath(fragment, cursorX, baselineY, 'start', color);
        cursorX += fragment.width;
      }
    }
    if (!tokens.length) {
      svg += `<text x="${round(cursorX)}" y="${round(baselineY)}" font-size="${round(fontSize)}" font-weight="${escapeXml(weight)}" font-family="${escapeXml(fontFamily)}" fill="${color}"></text>`;
    }
  }

  return {
    svg,
    width: layout.width,
    height: layout.height,
    lines: layout.lines.length,
    mathFallbackCount: layout.mathFallbackCount,
    normalizedValue: layout.normalizedValue,
  };
}

async function layoutRichText(
  value: string,
  options: RichTextRenderOptions,
): Promise<{
  lines: RichTextLineLayout[];
  width: number;
  height: number;
  mathFallbackCount: number;
  normalizedValue: string;
}> {
  const fontSize = options.fontSize ?? 16;
  const lineGap = options.lineGap ?? Math.max(6, Math.round(fontSize * 0.34));
  const lineHeight = fontSize + lineGap;
  const latexMode = options.latex ?? 'auto';
  const maxWidth = options.maxWidth > 0 ? options.maxWidth : Number.POSITIVE_INFINITY;
  const maxLines = Math.max(1, options.maxLines ?? 6);
  const normalizedValue = normalizeRichTextForLatex(value, latexMode);
  const logicalLines = normalizedValue.split(/\n/g);
  const renderedLines: RichToken[][] = [];

  for (const logicalLine of logicalLines) {
    const wrapped = await wrapTokens(
      tokenizeRichText(logicalLine, latexMode),
      maxWidth,
      fontSize,
      maxLines - renderedLines.length,
      options.weight ?? '600',
      options.fontFamily ?? DEFAULT_FONT_FAMILY,
    );
    renderedLines.push(...wrapped);
    if (renderedLines.length >= maxLines) break;
  }

  const lines: RichTextLineLayout[] = [];
  let width = 0;
  let mathFallbackCount = 0;
  for (const line of renderedLines) {
    const lineWidth = await measureLine(line, fontSize, options.weight ?? '600', options.fontFamily ?? DEFAULT_FONT_FAMILY);
    const lineHeightPx = await measureLineHeight(line, fontSize);
    const ascent = Math.max(fontSize * 0.8, await measureLineAscent(line, fontSize));
    width = Math.max(width, lineWidth);
    mathFallbackCount += await countMathFallbacks(line, fontSize);
    lines.push({ tokens: line, width: lineWidth, height: lineHeightPx, ascent });
  }

  if (!lines.length) {
    return { lines: [], width: 0, height: 0, mathFallbackCount, normalizedValue };
  }

  const last = lines[lines.length - 1];
  const height = (lines.length - 1) * lineHeight + Math.max(last.height, fontSize);
  return { lines, width, height, mathFallbackCount, normalizedValue };
}

async function countMathFallbacks(tokens: RichToken[], fontSize: number): Promise<number> {
  let count = 0;
  for (const token of tokens) {
    if (token.type !== 'math') continue;
    const fragment = await renderMathFragment(token.value, token.display, fontSize);
    if (fragment.fallback) count += 1;
  }
  return count;
}

async function wrapTokens(
  tokens: RichToken[],
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  weight: string,
  fontFamily: string,
): Promise<RichToken[][]> {
  if (!tokens.length) return [[]];
  const lines: RichToken[][] = [];
  let current: RichToken[] = [];
  let currentWidth = 0;
  const atoms = flattenWrapTokens(tokens);

  for (const atom of atoms) {
    const token = { ...atom };
    const width = token.type === 'text'
      ? measureTextWidth(token.value, fontSize, weight, fontFamily)
      : (await renderMathFragment(token.value, token.display, fontSize)).width;
    const trimmed = token.type === 'text' && current.length === 0 ? token.value.replace(/^\s+/, '') : token.value;
    const effectiveWidth = token.type === 'text' ? measureTextWidth(trimmed, fontSize, weight, fontFamily) : width;
    if (token.type === 'text') token.value = trimmed;
    if (!token.value && token.type === 'text') continue;

    if (current.length > 0 && currentWidth + effectiveWidth > maxWidth) {
      lines.push(trimTrailingWhitespace(current));
      if (lines.length >= maxLines) return lines;
      current = [];
      currentWidth = 0;
      if (token.type === 'text') token.value = token.value.replace(/^\s+/, '');
    }

    current.push(token);
    currentWidth += token.type === 'text' ? measureTextWidth(token.value, fontSize, weight, fontFamily) : effectiveWidth;
  }

  lines.push(trimTrailingWhitespace(current));
  return lines.slice(0, maxLines);
}

function flattenWrapTokens(tokens: RichToken[]): RichToken[] {
  const atoms: RichToken[] = [];
  tokens.forEach((token) => {
    if (token.type === 'math') {
      atoms.push(token);
      return;
    }
    const chunks = token.value.match(/\S+\s*|\s+/g) ?? [''];
    chunks.forEach((chunk) => atoms.push({ type: 'text', value: chunk, display: false }));
  });
  return atoms;
}

async function measureLine(tokens: RichToken[], fontSize: number, weight = '600', fontFamily = DEFAULT_FONT_FAMILY): Promise<number> {
  let width = 0;
  for (const token of tokens) {
    if (token.type === 'text') width += measureTextWidth(token.value, fontSize, weight, fontFamily);
    else width += (await renderMathFragment(token.value, token.display, fontSize)).width;
  }
  return width;
}

async function measureLineHeight(tokens: RichToken[], fontSize: number): Promise<number> {
  let maxHeight = fontSize;
  for (const token of tokens) {
    if (token.type === 'math') {
      const fragment = await renderMathFragment(token.value, token.display, fontSize);
      maxHeight = Math.max(maxHeight, fragment.height);
    }
  }
  return maxHeight;
}

async function measureLineAscent(tokens: RichToken[], fontSize: number): Promise<number> {
  let maxAscent = fontSize * 0.8;
  for (const token of tokens) {
    if (token.type === 'math') {
      const fragment = await renderMathFragment(token.value, token.display, fontSize);
      maxAscent = Math.max(maxAscent, fragment.ascent);
    }
  }
  return maxAscent;
}

function tokenizeRichText(value: string, latexMode: LatexMode): RichToken[] {
  if (latexMode === 'off') return [{ type: 'text', value, display: false }];
  const hasDelimiters = hasLatexDelimiters(value);
  if (latexMode === 'on' && !hasDelimiters) return [{ type: 'math', value: normalizeFormulaForLatex(value), display: false }];
  if (!hasDelimiters) return [{ type: 'text', value, display: false }];

  const tokens: RichToken[] = [];
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+\$|\\\([\s\S]+?\\\))/g;
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ type: 'text', value: value.slice(lastIndex, index), display: false });
    const raw = match[0];
    tokens.push({
      type: 'math',
      value: normalizeFormulaForLatex(stripMathDelimiters(raw)),
      display: raw.startsWith('$$') || raw.startsWith('\\['),
    });
    lastIndex = index + raw.length;
  }
  if (lastIndex < value.length) tokens.push({ type: 'text', value: value.slice(lastIndex), display: false });
  return tokens;
}

function trimTrailingWhitespace(tokens: RichToken[]): RichToken[] {
  if (!tokens.length) return tokens;
  const copy = tokens.map((token) => ({ ...token }));
  const last = copy[copy.length - 1];
  if (last?.type === 'text') last.value = last.value.replace(/\s+$/g, '');
  return copy;
}

function coalesceTextTokens(tokens: RichToken[]): RichToken[] {
  const collapsed: RichToken[] = [];
  for (const token of tokens) {
    if (!collapsed.length || token.type !== 'text' || collapsed[collapsed.length - 1].type !== 'text') {
      collapsed.push({ ...token });
      continue;
    }
    collapsed[collapsed.length - 1].value += token.value;
  }
  return collapsed;
}
