import { DEFAULT_FONT_FAMILY } from './types';

export const EX_RATIO = 0.431;

export function measureTextWidth(value: string, fontSize: number, weight = '600', fontFamily = DEFAULT_FONT_FAMILY): number {
  const normalized = value.replace(/\t/g, '    ');
  if (!normalized) return 0;
  if (isMonospace(fontFamily)) return normalized.length * fontSize * 0.62;

  let width = 0;
  for (const char of normalized) {
    width += classifyGlyphWidth(char);
  }

  const numericWeight = Number.parseInt(weight, 10);
  const weightFactor = Number.isFinite(numericWeight)
    ? 1 + Math.max(0, numericWeight - 400) / 2000
    : weight === 'bold'
      ? 1.08
      : 1;
  return width * fontSize * weightFactor;
}

export function classifyGlyphWidth(char: string): number {
  if (char === ' ') return 0.34;
  if (/[\t]/.test(char)) return 1.36;
  if (/[.,;:'`!|]/.test(char)) return 0.24;
  if (/[()\[\]{}]/.test(char)) return 0.34;
  if (/[0-9]/.test(char)) return 0.56;
  if (/[iljfrt]/.test(char)) return 0.32;
  if (/[mw]/.test(char)) return 0.84;
  if (/[A-Z]/.test(char)) {
    if (/[MWQ@]/.test(char)) return 0.9;
    if (/[IJ]/.test(char)) return 0.38;
    return 0.68;
  }
  if (/[a-z]/.test(char)) return 0.54;
  if (/[+\-=/<>]/.test(char)) return 0.58;
  return 0.6;
}

function isMonospace(fontFamily: string): boolean {
  return /mono|courier|consolas/i.test(fontFamily);
}
