import { ChartConfig, DataSeries, palette } from './types';
import {
  escapeXml, fiveNumberSummary, minMax, openSvg, quantile, renderAxes, renderDiscreteXAxis, renderLegend,
  renderNumericXAxis, renderYGrid, resolveDiscreteXAxis, round, scaleY,
} from './shared';

export function renderChart(config: ChartConfig, series: DataSeries[]): string {
  switch (config.type) {
    case 'bar': return renderBarChart(config, series);
    case 'scatter': return renderXYChart(config, series, 'scatter');
    case 'area': return renderXYChart(config, series, 'area');
    case 'pie': return renderPieChart(config, series);
    case 'box': return renderBoxChart(config, series);
    case 'line':
    default: return renderXYChart(config, series, 'line');
  }
}

function renderXYChart(config: ChartConfig, series: DataSeries[], mode: 'line' | 'scatter' | 'area'): string {
  const padding = { top: 56, right: 28, bottom: 72, left: 72 };
  const chartWidth = config.width - padding.left - padding.right;
  const chartHeight = config.height - padding.top - padding.bottom;
  const allX = series.flatMap((s) => s.x ?? s.y.map((_, index) => index));
  const allY = series.flatMap((s) => s.y);
  const { min: minX, max: maxX } = minMax(allX, 0, Math.max(allX.length - 1, 1));
  const { min: minY, max: maxY } = minMax(allY, 0, 1);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const discreteX = resolveDiscreteXAxis(series);

  let svg = openSvg(config);
  svg += `<g transform="translate(${padding.left}, ${padding.top})">`;
  svg += renderYGrid(chartWidth, chartHeight, minY, maxY);
  svg += discreteX ? renderDiscreteXAxis(chartWidth, chartHeight, minX, xRange, discreteX) : renderNumericXAxis(chartWidth, chartHeight, minX, maxX);

  series.forEach((s, index) => {
    const color = palette[index % palette.length];
    const xs = s.x ?? s.y.map((_, pointIndex) => pointIndex);
    const points = s.y.map((value, pointIndex) => ({
      x: ((xs[pointIndex] - minX) / xRange) * chartWidth,
      y: chartHeight - ((value - minY) / yRange) * chartHeight,
      value,
      rawX: xs[pointIndex],
    }));

    if (mode === 'line' || mode === 'area') {
      const polyline = points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
      if (mode === 'area') {
        const areaPoints = [`0,${chartHeight}`, polyline, `${chartWidth},${chartHeight}`].join(' ');
        svg += `<polygon points="${areaPoints}" fill="${color}" fill-opacity="0.18" stroke="none"/>`;
      }
      svg += `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    points.forEach((point) => {
      svg += `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="4.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${escapeXml(s.name)}: (${round(point.rawX, 2)}, ${round(point.value, 2)})</title></circle>`;
    });
  });

  svg += renderAxes(chartWidth, chartHeight, config.xLabel, config.yLabel);
  svg += renderLegend(series, config.width - padding.right - 8, padding.top - 22);
  return `${svg}</g></svg>`;
}

export function renderBarChart(config: ChartConfig, series: DataSeries[]): string {
  const padding = { top: 56, right: 28, bottom: 84, left: 72 };
  const chartWidth = config.width - padding.left - padding.right;
  const chartHeight = config.height - padding.top - padding.bottom;
  const count = Math.max(...series.map((s) => s.y.length), 1);
  const groupWidth = chartWidth / count;
  const barWidth = Math.max(14, (groupWidth - 16) / Math.max(series.length, 1));
  const allValues = series.flatMap((s) => s.y);
  const { min: rawMin, max: rawMax } = minMax(allValues, 0, 1);
  const minValue = Math.min(0, rawMin);
  const maxValue = Math.max(0, rawMax);
  const yRange = maxValue - minValue || 1;
  const baselineY = chartHeight - ((0 - minValue) / yRange) * chartHeight;
  const labels = config.labels?.length ? config.labels : series[0]?.labels?.length ? series[0].labels : series[0]?.x?.map((value) => String(value));

  let svg = openSvg(config);
  svg += `<g transform="translate(${padding.left}, ${padding.top})">`;
  svg += renderYGrid(chartWidth, chartHeight, minValue, maxValue);
  series.forEach((s, sIdx) => {
    const color = palette[sIdx % palette.length];
    s.y.forEach((value, idx) => {
      const x = idx * groupWidth + 8 + sIdx * barWidth;
      const y = chartHeight - ((value - minValue) / yRange) * chartHeight;
      const rectY = Math.min(y, baselineY);
      const height = Math.abs(baselineY - y);
      svg += `<rect x="${round(x)}" y="${round(rectY)}" width="${round(barWidth - 4)}" height="${round(Math.max(height, 1))}" fill="${color}" rx="4"><title>${escapeXml(s.name)}: ${round(value, 2)}</title></rect>`;
    });
  });
  labels?.slice(0, count).forEach((label, idx) => {
    const x = idx * groupWidth + groupWidth / 2;
    svg += `<text x="${round(x)}" y="${chartHeight + 22}" text-anchor="middle" font-size="11" fill="#475569">${escapeXml(label)}</text>`;
  });
  svg += renderAxes(chartWidth, chartHeight, config.xLabel, config.yLabel);
  svg += renderLegend(series, config.width - padding.right - 8, padding.top - 22);
  return `${svg}</g></svg>`;
}

function renderPieChart(config: ChartConfig, series: DataSeries[]): string {
  const values = series.flatMap((s) => s.y);
  const labels = series.flatMap((s) => s.labels ?? []).length
    ? series.flatMap((s) => s.labels ?? [])
    : config.labels?.length
      ? config.labels
      : series.flatMap((s) => s.y.map((_, index) => s.name === 'series' ? `Slice ${index + 1}` : `${s.name} ${index + 1}`));
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const radius = Math.min(config.width, config.height) * 0.28;
  const cx = config.width * 0.36;
  const cy = config.height * 0.55;

  let svg = openSvg(config);
  let startAngle = -Math.PI / 2;
  values.forEach((value, index) => {
    const fraction = Math.max(value, 0) / total;
    const endAngle = startAngle + fraction * Math.PI * 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(startAngle) * radius;
    const y1 = cy + Math.sin(startAngle) * radius;
    const x2 = cx + Math.cos(endAngle) * radius;
    const y2 = cy + Math.sin(endAngle) * radius;
    const color = palette[index % palette.length];
    svg += `<path d="M ${round(cx)} ${round(cy)} L ${round(x1)} ${round(y1)} A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(x2)} ${round(y2)} Z" fill="${color}" stroke="#ffffff" stroke-width="2"><title>${escapeXml(labels[index] ?? `Slice ${index + 1}`)}: ${round(value, 2)}</title></path>`;
    const mid = startAngle + (endAngle - startAngle) / 2;
    const labelX = cx + Math.cos(mid) * radius * 0.62;
    const labelY = cy + Math.sin(mid) * radius * 0.62;
    svg += `<text x="${round(labelX)}" y="${round(labelY)}" text-anchor="middle" font-size="11" fill="#0f172a">${Math.round(fraction * 100)}%</text>`;
    startAngle = endAngle;
  });

  labels.forEach((label, index) => {
    const y = 92 + index * 18;
    const color = palette[index % palette.length];
    svg += `<rect x="${config.width - 220}" y="${y - 10}" width="12" height="12" rx="3" fill="${color}"/>`;
    svg += `<text x="${config.width - 200}" y="${y}" font-size="11" fill="#334155">${escapeXml(label)}</text>`;
  });
  return `${svg}</svg>`;
}

function renderBoxChart(config: ChartConfig, series: DataSeries[]): string {
  const padding = { top: 56, right: 28, bottom: 72, left: 72 };
  const chartWidth = config.width - padding.left - padding.right;
  const chartHeight = config.height - padding.top - padding.bottom;
  const summaries = series.map((s) => fiveNumberSummary(s.y));
  const allValues = summaries.flatMap((summary) => [summary.min, summary.q1, summary.median, summary.q3, summary.max]);
  const { min: minValue, max: maxValue } = minMax(allValues, 0, 1);
  const yRange = maxValue - minValue || 1;
  const step = chartWidth / Math.max(series.length, 1);

  let svg = openSvg(config);
  svg += `<g transform="translate(${padding.left}, ${padding.top})">`;
  svg += renderYGrid(chartWidth, chartHeight, minValue, maxValue);
  series.forEach((s, index) => {
    const color = palette[index % palette.length];
    const summary = summaries[index];
    const centerX = step * index + step / 2;
    const boxWidth = Math.min(72, step * 0.45);
    const yMin = scaleY(summary.min, minValue, yRange, chartHeight);
    const yQ1 = scaleY(summary.q1, minValue, yRange, chartHeight);
    const yMedian = scaleY(summary.median, minValue, yRange, chartHeight);
    const yQ3 = scaleY(summary.q3, minValue, yRange, chartHeight);
    const yMax = scaleY(summary.max, minValue, yRange, chartHeight);

    svg += `<line x1="${round(centerX)}" y1="${round(yMin)}" x2="${round(centerX)}" y2="${round(yMax)}" stroke="#475569" stroke-width="2"/>`;
    svg += `<line x1="${round(centerX - boxWidth / 3)}" y1="${round(yMax)}" x2="${round(centerX + boxWidth / 3)}" y2="${round(yMax)}" stroke="#475569" stroke-width="2"/>`;
    svg += `<line x1="${round(centerX - boxWidth / 3)}" y1="${round(yMin)}" x2="${round(centerX + boxWidth / 3)}" y2="${round(yMin)}" stroke="#475569" stroke-width="2"/>`;
    svg += `<rect x="${round(centerX - boxWidth / 2)}" y="${round(yQ3)}" width="${round(boxWidth)}" height="${round(Math.max(yQ1 - yQ3, 1))}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="2" rx="6"/>`;
    svg += `<line x1="${round(centerX - boxWidth / 2)}" y1="${round(yMedian)}" x2="${round(centerX + boxWidth / 2)}" y2="${round(yMedian)}" stroke="${color}" stroke-width="3"/>`;
    svg += `<text x="${round(centerX)}" y="${chartHeight + 22}" text-anchor="middle" font-size="11" fill="#475569">${escapeXml(s.name)}</text>`;
  });
  return `${svg}${renderAxes(chartWidth, chartHeight, config.xLabel, config.yLabel)}</g></svg>`;
}
