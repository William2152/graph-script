import { ChartDeclaration, Expression } from '../ast/types';
import { GSValue } from '../runtime/values';

export interface ChartConfig {
  title?: string;
  type?: 'bar' | 'line' | 'scatter' | 'pie';
  width: number;
  height: number;
  xLabel?: string;
  yLabel?: string;
}

export interface DataSeries {
  name: string;
  values: number[];
  color?: string;
}

export function extractChartConfig(decl: ChartDeclaration, values: Record<string, GSValue>): ChartConfig {
  const config: ChartConfig = {
    width: 800,
    height: 400
  };

  if (decl.name) config.title = decl.name;

  const typeVal = decl.properties['type'];
  if (typeVal && typeVal.type === 'Identifier') {
    config.type = (typeVal as any).name as ChartConfig['type'];
  }

  const widthVal = decl.properties['width'];
  if (widthVal && widthVal.type === 'Literal' && typeof widthVal.value === 'number') {
    config.width = widthVal.value;
  }

  const heightVal = decl.properties['height'];
  if (heightVal && heightVal.type === 'Literal' && typeof heightVal.value === 'number') {
    config.height = heightVal.value;
  }

  return config;
}

export function extractDataSeries(name: string, value: GSValue): DataSeries | null {
  if (Array.isArray(value)) {
    return {
      name,
      values: value.filter(v => typeof v === 'number') as number[]
    };
  }
  return null;
}

export function renderBarChart(config: ChartConfig, series: DataSeries[]): string {
  const { width, height, title, xLabel, yLabel } = config;
  const padding = { top: 40, right: 20, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = series.flatMap(s => s.values);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;

  const barWidth = chartWidth / (series.length * (series[0]?.values.length || 1)) - 4;
  const groupWidth = chartWidth / series.length;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  if (title) {
    svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="18" font-weight="bold">${escapeXml(title)}</text>`;
  }

  svg += `<g transform="translate(${padding.left}, ${padding.top})">`;

  for (let i = 0; i <= 4; i++) {
    const y = chartHeight - (i / 4) * chartHeight;
    const val = minValue + (i / 4) * range;
    svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#e0e0e0" stroke-dasharray="2"/>`;
    svg += `<text x="-10" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${val.toFixed(1)}</text>`;
  }

  series.forEach((s, sIdx) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
    const color = s.color || colors[sIdx % colors.length];

    s.values.forEach((val, vIdx) => {
      const barHeight = ((val - minValue) / range) * chartHeight;
      const x = sIdx * groupWidth + vIdx * (barWidth + 4);
      const y = chartHeight - barHeight;

      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2">`;
      svg += `<title>${s.name}: ${val}</title>`;
      svg += `</rect>`;

      svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="#333">${val.toFixed(1)}</text>`;
    });
  });

  if (xLabel) {
    svg += `<text x="${chartWidth / 2}" y="${chartHeight + 35}" text-anchor="middle" font-size="12" fill="#333">${escapeXml(xLabel)}</text>`;
  }

  if (yLabel) {
    svg += `<text x="${-chartHeight / 2}" y="-40" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90)">${escapeXml(yLabel)}</text>`;
  }

  svg += `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#333"/>`;
  svg += `<line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="#333"/>`;
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}

export function renderLineChart(config: ChartConfig, series: DataSeries[]): string {
  const { width, height, title, xLabel, yLabel } = config;
  const padding = { top: 40, right: 20, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = series.flatMap(s => s.values);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  if (title) {
    svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="18" font-weight="bold">${escapeXml(title)}</text>`;
  }

  svg += `<g transform="translate(${padding.left}, ${padding.top})">`;

  for (let i = 0; i <= 4; i++) {
    const y = chartHeight - (i / 4) * chartHeight;
    const val = minValue + (i / 4) * range;
    svg += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#e0e0e0" stroke-dasharray="2"/>`;
    svg += `<text x="-10" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${val.toFixed(1)}</text>`;
  }

  series.forEach((s, sIdx) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
    const color = s.color || colors[sIdx % colors.length];

    const points = s.values.map((val, idx) => {
      const x = (idx / (s.values.length - 1 || 1)) * chartWidth;
      const y = chartHeight - ((val - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;

    s.values.forEach((val, idx) => {
      const x = (idx / (s.values.length - 1 || 1)) * chartWidth;
      const y = chartHeight - ((val - minValue) / range) * chartHeight;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}">`;
      svg += `<title>${s.name}: ${val}</title>`;
      svg += `</circle>`;
    });
  });

  if (xLabel) {
    svg += `<text x="${chartWidth / 2}" y="${chartHeight + 35}" text-anchor="middle" font-size="12" fill="#333">${escapeXml(xLabel)}</text>`;
  }

  if (yLabel) {
    svg += `<text x="${-chartHeight / 2}" y="-40" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90)">${escapeXml(yLabel)}</text>`;
  }

  svg += `<line x1="0" y1="${chartHeight}" x2="${chartWidth}" y2="${chartHeight}" stroke="#333"/>`;
  svg += `<line x1="0" y1="0" x2="0" y2="${chartHeight}" stroke="#333"/>`;
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
