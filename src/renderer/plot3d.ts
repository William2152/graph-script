import { Expression, Plot3dDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import {
  hasExplicitProperty,
  readRendererSizeMode,
  readSpacingDefaults,
  resolveRendererExtent,
} from './readability-policy';

interface Plot3dSeries {
  x: number[];
  y: number[];
  z: number[];
}

interface Plot3dConfig {
  title?: string;
  type: 'scatter3d' | 'line3d';
  width: number;
  height: number;
  padding: number;
}

export function buildPlot3d(decl: Plot3dDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>): { config: Plot3dConfig; series: Plot3dSeries | null } {
  const defaults = readSpacingDefaults('plot3d');
  const typeValue = resolveValue(decl.properties.type, values, traces);
  const widthValue = resolveValue(decl.properties.width, values, traces);
  const heightValue = resolveValue(decl.properties.height, values, traces);
  const titleValue = resolveValue(decl.properties.title, values, traces);
  const x = asNumberArray(resolveValue(decl.properties.x, values, traces));
  const y = asNumberArray(resolveValue(decl.properties.y, values, traces));
  const z = asNumberArray(resolveValue(decl.properties.z, values, traces));
  const explicitWidth = hasExplicitProperty(decl.properties.width);
  const explicitHeight = hasExplicitProperty(decl.properties.height);
  const sizeMode = readRendererSizeMode(decl.properties.size_mode, values, traces, 'dynamic');
  const dynamicWidth = Math.max(defaults.minWidth, defaults.width + Math.min(220, Math.max(x.length, y.length, z.length) * 6));
  const dynamicHeight = Math.max(defaults.minHeight, Math.round(dynamicWidth * 0.68));
  const requestedWidth = typeof widthValue === 'number' ? widthValue : defaults.width;
  const requestedHeight = typeof heightValue === 'number' ? heightValue : defaults.height;

  const config: Plot3dConfig = {
    title: typeof titleValue === 'string' ? titleValue : decl.name,
    type: typeValue === 'line3d' ? 'line3d' : 'scatter3d',
    width: resolveRendererExtent(
      explicitWidth,
      requestedWidth,
      defaults.width,
      sizeMode,
      dynamicWidth,
      defaults.minWidth,
    ),
    height: resolveRendererExtent(
      explicitHeight,
      requestedHeight,
      defaults.height,
      sizeMode,
      dynamicHeight,
      defaults.minHeight,
    ),
    padding: typeof resolveValue(decl.properties.padding, values, traces) === 'number'
      ? resolveValue(decl.properties.padding, values, traces)
      : defaults.spacing.padding,
  };

  if (!x.length || x.length !== y.length || y.length !== z.length) {
    return { config, series: null };
  }

  return { config, series: { x, y, z } };
}

export function renderPlot3d(config: Plot3dConfig, series: Plot3dSeries): string {
  const padding = config.padding;
  const points = series.x.map((x, index) => projectPoint(x, series.y[index], series.z[index]));
  const guidePoints = [projectPoint(-1.2, 0, 0), projectPoint(1.2, 0, 0), projectPoint(0, -1.2, 0), projectPoint(0, 1.2, 0), projectPoint(0, 0, -1.2), projectPoint(0, 0, 1.2)];
  const boundsPoints = [...points, ...guidePoints];
  const xs = boundsPoints.map((point) => point.x);
  const ys = boundsPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (config.width - padding * 2) / Math.max(maxX - minX, 1),
    (config.height - padding * 2) / Math.max(maxY - minY, 1),
  );
  const offsetX = config.width / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = config.height / 2 + ((minY + maxY) / 2) * scale * 0.1;
  const normalized = points.map((point) => ({
    x: offsetX + point.x * scale,
    y: config.height - (offsetY + point.y * scale),
    depth: point.depth,
  }));
  const sorted = normalized.map((point, index) => ({ ...point, index })).sort((a, b) => a.depth - b.depth);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">`;
  svg += `<rect width="${config.width}" height="${config.height}" fill="#ffffff"/>`;
  if (config.title) {
    svg += `<text x="${config.width / 2}" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${escapeXml(config.title)}</text>`;
  }

  const origin = projectPoint(0, 0, 0);
  const axisX = projectPoint(1.35, 0, 0);
  const axisY = projectPoint(0, 1.35, 0);
  const axisZ = projectPoint(0, 0, 1.35);
  const projectAxis = (point: { x: number; y: number }) => ({
    x: offsetX + point.x * scale,
    y: config.height - (offsetY + point.y * scale),
  });
  const o = projectAxis(origin);
  const ax = projectAxis(axisX);
  const ay = projectAxis(axisY);
  const az = projectAxis(axisZ);

  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(ax.x)}" y2="${round(ax.y)}" stroke="#2563eb" stroke-width="2.5"/>`;
  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(ay.x)}" y2="${round(ay.y)}" stroke="#16a34a" stroke-width="2.5"/>`;
  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(az.x)}" y2="${round(az.y)}" stroke="#dc2626" stroke-width="2.5"/>`;
  svg += `<text x="${round(ax.x + 8)}" y="${round(ax.y)}" font-size="12" fill="#2563eb">x</text>`;
  svg += `<text x="${round(ay.x + 8)}" y="${round(ay.y)}" font-size="12" fill="#16a34a">y</text>`;
  svg += `<text x="${round(az.x + 8)}" y="${round(az.y)}" font-size="12" fill="#dc2626">z</text>`;

  svg += renderSphereGuide(o.x, o.y, scale * 0.95);

  if (config.type === 'line3d') {
    svg += `<polyline points="${normalized.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  sorted.forEach((point) => {
    const radius = 4 + point.depth * 1.2;
    svg += `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="${round(radius, 2)}" fill="#2563eb" fill-opacity="0.82" stroke="white" stroke-width="1.4"><title>point ${point.index + 1}</title></circle>`;
  });

  svg += `</svg>`;
  return svg;
}

function renderSphereGuide(cx: number, cy: number, radius: number): string {
  const rx = radius;
  const ry = radius * 0.38;
  let svg = '';
  svg += `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`;
  svg += `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" fill="none" stroke="#cbd5e1" stroke-dasharray="4 4"/>`;
  svg += `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(ry)}" ry="${round(rx)}" fill="none" stroke="#e2e8f0" stroke-dasharray="4 4" transform="rotate(35 ${round(cx)} ${round(cy)})"/>`;
  return svg;
}

function projectPoint(x: number, y: number, z: number): { x: number; y: number; depth: number } {
  const px = (x - y) * 0.92;
  const py = z + (x + y) * 0.45;
  const depth = z + (x + y) * 0.2;
  return { x: px, y: py, depth };
}

function resolveValue(expr: Expression | undefined, values: Record<string, GSValue>, traces: Map<string, Trace>): any {
  if (!expr) return undefined;
  switch (expr.type) {
    case 'Literal':
      return expr.value;
    case 'Identifier':
      return expr.name in values ? values[expr.name] : expr.name;
    case 'ArrayExpression':
      return expr.elements.map((element) => resolveValue(element, values, traces));
    case 'ObjectExpression':
      return Object.fromEntries(expr.properties.map((prop) => [prop.key, resolveValue(prop.value, values, traces)]));
    case 'MemberExpression': {
      if (expr.property === 'trace' && expr.object.type === 'Identifier') return traces.get(expr.object.name);
      const object = resolveValue(expr.object, values, traces);
      return object?.[expr.property];
    }
    case 'IndexExpression': {
      const object = resolveValue(expr.object, values, traces);
      const index = resolveValue(expr.index, values, traces);
      return Array.isArray(object) ? object[index] : object?.[index];
    }
    default:
      return undefined;
  }
}

function asNumberArray(value: any): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number');
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
