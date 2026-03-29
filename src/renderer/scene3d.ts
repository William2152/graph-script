import { Scene3dDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { readNumber, readString, resolveValue, round, svgDocument, escapeXml } from './common';
import {
  hasExplicitProperty,
  readRendererSizeMode,
  readSpacingDefaults,
  resolveRendererExtent,
} from './readability-policy';

interface ProjectedPoint { x: number; y: number; depth: number }

export interface Scene3dLayoutPlan {
  width: number;
  height: number;
  title: string;
  axisScale: number;
  originX: number;
  originY: number;
}

export function planScene3dLayout(
  decl: Scene3dDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Scene3dLayoutPlan {
  const defaults = readSpacingDefaults('scene3d');
  const explicitWidth = hasExplicitProperty(decl.properties.width);
  const explicitHeight = hasExplicitProperty(decl.properties.height);
  const sizeMode = readRendererSizeMode(decl.properties.size_mode, values, traces, 'dynamic');
  const dynamicWidth = Math.max(defaults.minWidth, defaults.width + Math.min(260, decl.elements.length * 18));
  const dynamicHeight = Math.max(defaults.minHeight, Math.round(dynamicWidth * 0.64));
  const width = resolveRendererExtent(
    explicitWidth,
    readNumber(resolveValue(decl.properties.width, values, traces), defaults.width),
    defaults.width,
    sizeMode,
    dynamicWidth,
    defaults.minWidth,
  );
  const height = resolveRendererExtent(
    explicitHeight,
    readNumber(resolveValue(decl.properties.height, values, traces), defaults.height),
    defaults.height,
    sizeMode,
    dynamicHeight,
    defaults.minHeight,
  );
  const title = readString(resolveValue(decl.properties.title, values, traces), decl.name);
  const axisScale = readNumber(resolveValue(decl.properties.scale, values, traces), 130);
  const originX = width / 2;
  const originY = height / 2 + 24;

  return { width, height, title, axisScale, originX, originY };
}

export function renderScene3d(decl: Scene3dDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>): string {
  const { width, height, title, axisScale, originX, originY } = planScene3dLayout(decl, values, traces);
  const project = (x: number, y: number, z: number): ProjectedPoint => {
    const px = (x - y) * 0.92;
    const py = z + (x + y) * 0.46;
    const depth = z + (x + y) * 0.2;
    return { x: originX + px * axisScale, y: originY - py * axisScale, depth };
  };

  const entries = decl.elements.map((element) => ({
    element,
    p: project(
      readNumber(resolveValue(element.properties.x, values, traces), 0),
      readNumber(resolveValue(element.properties.y, values, traces), 0),
      readNumber(resolveValue(element.properties.z, values, traces), 0),
    ),
  })).sort((a, b) => a.p.depth - b.p.depth);

  let body = '';
  body += `<text x="${width / 2}" y="34" text-anchor="middle" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>`;
  body += renderAxes(project);
  body += renderSphereGuide(originX, originY, axisScale * 1.02);

  entries.forEach(({ element, p }) => {
    const kind = element.type.toLowerCase();
    const color = readString(resolveValue(element.properties.color, values, traces), '#2563eb');
    const label = readString(resolveValue(element.properties.label, values, traces), element.name);
    if (kind === 'sphere') {
      const radius = readNumber(resolveValue(element.properties.radius, values, traces), 0.12) * axisScale;
      body += `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${round(Math.max(6, radius))}" fill="${color}" fill-opacity="0.82" stroke="#ffffff" stroke-width="2"/>`;
    } else if (kind === 'cube') {
      const size = readNumber(resolveValue(element.properties.size, values, traces), 0.18) * axisScale;
      body += `<rect x="${round(p.x - size / 2)}" y="${round(p.y - size / 2)}" width="${round(size)}" height="${round(size)}" rx="8" fill="${color}" fill-opacity="0.82" stroke="#ffffff" stroke-width="2"/>`;
    } else if (kind === 'arrow3' || kind === 'vector') {
      const dx = readNumber(resolveValue(element.properties.dx, values, traces), 0);
      const dy = readNumber(resolveValue(element.properties.dy, values, traces), 0);
      const dz = readNumber(resolveValue(element.properties.dz, values, traces), 1);
      const end = project(
        readNumber(resolveValue(element.properties.x, values, traces), 0) + dx,
        readNumber(resolveValue(element.properties.y, values, traces), 0) + dy,
        readNumber(resolveValue(element.properties.z, values, traces), 0) + dz,
      );
      body += `<defs><marker id="scene-arrow-${escapeXml(element.name)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker></defs>`;
      body += `<line x1="${round(p.x)}" y1="${round(p.y)}" x2="${round(end.x)}" y2="${round(end.y)}" stroke="${color}" stroke-width="4" marker-end="url(#scene-arrow-${escapeXml(element.name)})"/>`;
    }
    body += `<text x="${round(p.x + 10)}" y="${round(p.y - 10)}" font-size="12" fill="#334155">${escapeXml(label)}</text>`;
  });

  return svgDocument(width, height, body, '#ffffff');
}

function renderAxes(project: (x: number, y: number, z: number) => ProjectedPoint): string {
  const o = project(0, 0, 0);
  const xAxis = project(1.3, 0, 0);
  const yAxis = project(0, 1.3, 0);
  const zAxis = project(0, 0, 1.3);
  let svg = '';
  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(xAxis.x)}" y2="${round(xAxis.y)}" stroke="#2563eb" stroke-width="2.6"/>`;
  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(yAxis.x)}" y2="${round(yAxis.y)}" stroke="#16a34a" stroke-width="2.6"/>`;
  svg += `<line x1="${round(o.x)}" y1="${round(o.y)}" x2="${round(zAxis.x)}" y2="${round(zAxis.y)}" stroke="#dc2626" stroke-width="2.6"/>`;
  svg += `<text x="${round(xAxis.x + 6)}" y="${round(xAxis.y)}" font-size="12" fill="#2563eb">x</text>`;
  svg += `<text x="${round(yAxis.x + 6)}" y="${round(yAxis.y)}" font-size="12" fill="#16a34a">y</text>`;
  svg += `<text x="${round(zAxis.x + 6)}" y="${round(zAxis.y)}" font-size="12" fill="#dc2626">z</text>`;
  return svg;
}

function renderSphereGuide(cx: number, cy: number, radius: number): string {
  return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" fill="none" stroke="#cbd5e1" stroke-width="1.6"/><ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(radius)}" ry="${round(radius * 0.38)}" fill="none" stroke="#cbd5e1" stroke-dasharray="4 4"/><ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(radius * 0.36)}" ry="${round(radius)}" fill="none" stroke="#e2e8f0" stroke-dasharray="4 4" transform="rotate(35 ${round(cx)} ${round(cy)})"/>`;
}
