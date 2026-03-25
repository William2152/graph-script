import { ChartConfig, DataSeries, palette } from './types';

export function openSvg(config: ChartConfig): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">`;
  svg += `<rect width="${config.width}" height="${config.height}" fill="#ffffff"/>`;
  if (config.title) {
    svg += `<text x="${config.width / 2}" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${escapeXml(config.title)}</text>`;
  }
  return svg;
}

export function renderYGrid(chartWidth: number, chartHeight: number, minValue: number, maxValue: number): string {
  const lines = 5;
  let svg = '';
  for (let i = 0; i <= lines; i += 1) {
    const ratio = i / lines;
    const y = chartHeight - ratio * chartHeight;
    const value = minValue + ratio * (maxValue - minValue);
    svg += `<line x1="0" y1="${round(y)}" x2="${chartWidth}" y2="${round(y)}" stroke="#e2e8f0" stroke-dasharray="4 4"/>`;
    svg += `<text x="-12" y="${round(y + 4)}" text-anchor="end" font-size="11" fill="#64748b">${round(value, 2)}</text>`;
  }
  return svg;
}

export function renderNumericXAxis(chartWidth: number, chartHeight: number, minX: number, maxX: number): string {
  const ticks = 6;
  let svg = '';
  for (let i = 0; i <= ticks; i += 1) {
    const ratio = i / ticks;
    const x = ratio * chartWidth;
    const value = minX + ratio * (maxX - minX);
    svg += `<line x1="${round(x)}" y1="${chartHeight}" x2="${round(x)}" y2="${chartHeight + 6}" stroke="#475569"/>`;
    svg += `<text x="${round(x)}" y="${chartHeight + 20}" text-anchor="middle" font-size="11" fill="#64748b">${round(value, 2)}</text>`;
  }
  return svg;
}

export function renderDiscreteXAxis(chartWidth: number, chartHeight: number, minX: number, xRange: number, values: number[]): string {
  return values.map((value) => {
    const x = ((value - minX) / (xRange || 1)) * chartWidth;
    return `<line x1="${round(x)}" y1="${chartHeight}" x2="${round(x)}" y2="${chartHeight + 6}" stroke="#475569"/>`
      + `<text x="${round(x)}" y="${chartHeight + 20}" text-anchor="middle" font-size="11" fill="#64748b">${formatTick(value)}</text>`;
  }).join('');
}

export function renderAxes(chartWidth: number, chartHeight: number, xLabel?: string, yLabel?: string): string {
  let svg = `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#334155" stroke-width="1.5"/>`;
  svg += `<line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="#334155" stroke-width="1.5"/>`;
  if (xLabel) svg += `<text x="${chartWidth / 2}" y="${chartHeight + 50}" text-anchor="middle" font-size="13" fill="#0f172a">${escapeXml(xLabel)}</text>`;
  if (yLabel) svg += `<text x="${-chartHeight / 2}" y="-48" text-anchor="middle" font-size="13" fill="#0f172a" transform="rotate(-90)">${escapeXml(yLabel)}</text>`;
  return svg;
}

export function renderLegend(series: DataSeries[], x: number, y: number): string {
  if (series.length <= 1) return '';
  const longest = Math.max(...series.map((entry) => entry.name.length), 10);
  const width = Math.max(160, longest * 7 + 34);
  const height = series.length * 18 + 16;
  const left = x - width;
  const top = y - 12;
  let svg = `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="10" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1"/>`;
  series.forEach((entry, index) => {
    const color = palette[index % palette.length];
    const itemY = y + index * 18;
    svg += `<rect x="${left + 12}" y="${itemY - 8}" width="12" height="12" rx="3" fill="${color}"/>`;
    svg += `<text x="${left + 30}" y="${itemY + 2}" font-size="11" fill="#334155">${escapeXml(entry.name)}</text>`;
  });
  return svg;
}

export function resolveDiscreteXAxis(series: DataSeries[]): number[] | null {
  const candidate = series[0]?.x;
  if (!candidate?.length || candidate.length > 12) return null;
  const normalized = candidate.map((value) => round(value, 6));
  const isDiscrete = normalized.every((value) => Math.abs(value - Math.round(value)) < 1e-6);
  const shared = series.every((entry) => entry.x && entry.x.length === candidate.length && entry.x.every((value, index) => round(value, 6) === normalized[index]));
  return !isDiscrete || !shared ? null : normalized;
}

export function formatTick(value: number): string {
  return Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : String(round(value, 2));
}

export function fiveNumberSummary(values: number[]): { min: number; q1: number; median: number; q3: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sorted[base] ?? sorted[sorted.length - 1];
  const upper = sorted[base + 1] ?? lower;
  return lower + rest * (upper - lower);
}

export function scaleY(value: number, min: number, range: number, chartHeight: number): number {
  return chartHeight - ((value - min) / range) * chartHeight;
}

export function minMax(values: number[], fallbackMin: number, fallbackMax: number): { min: number; max: number } {
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: fallbackMin, max: fallbackMax };
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
