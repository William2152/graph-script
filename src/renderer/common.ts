import { ChartDeclaration, DiagramDeclaration, ErdDeclaration, Expression, FlowDeclaration, InfraDeclaration, PageDeclaration, Plot3dDeclaration, PseudoDeclaration, Scene3dDeclaration, TableDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';

export type RenderableDeclaration =
  | ChartDeclaration
  | FlowDeclaration
  | TableDeclaration
  | Plot3dDeclaration
  | PseudoDeclaration
  | DiagramDeclaration
  | Scene3dDeclaration
  | ErdDeclaration
  | InfraDeclaration
  | PageDeclaration;

export interface SvgDocument {
  width: number;
  height: number;
  svg: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function readString(value: any, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function readNumber(value: any, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readBoolean(value: any, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asStringArray(value: any): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function asNumberArray(value: any): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
}

export function resolveValue(expr: Expression | undefined, values: Record<string, GSValue>, traces: Map<string, Trace>): any {
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
    case 'UnaryExpression': {
      const operand = resolveValue(expr.operand, values, traces);
      return expr.operator === '-' ? -Number(operand ?? 0) : !operand;
    }
    case 'BinaryExpression': {
      const left = resolveValue(expr.left, values, traces);
      const right = resolveValue(expr.right, values, traces);
      switch (expr.operator) {
        case '+': return typeof left === 'string' || typeof right === 'string' ? `${left ?? ''}${right ?? ''}` : Number(left ?? 0) + Number(right ?? 0);
        case '-': return Number(left ?? 0) - Number(right ?? 0);
        case '*': return Number(left ?? 0) * Number(right ?? 0);
        case '/': return Number(left ?? 0) / Number(right ?? 1);
        case '%': return Number(left ?? 0) % Number(right ?? 1);
        case '^': return Math.pow(Number(left ?? 0), Number(right ?? 0));
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return Number(left ?? 0) < Number(right ?? 0);
        case '>': return Number(left ?? 0) > Number(right ?? 0);
        case '<=': return Number(left ?? 0) <= Number(right ?? 0);
        case '>=': return Number(left ?? 0) >= Number(right ?? 0);
        case '&&': return !!left && !!right;
        case '||': return !!left || !!right;
        default: return undefined;
      }
    }
    case 'CallExpression': {
      const callee = typeof expr.callee === 'string'
        ? expr.callee
        : expr.callee.type === 'Identifier'
          ? expr.callee.name
          : undefined;
      const args = expr.args.map((arg) => resolveValue(arg, values, traces));
      switch (callee) {
        case 'cell':
          return `cell(${args.join(',')})`;
        case 'grid':
          return { type: 'grid', args };
        case 'image': {
          const rawPath = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '');
          const format = rawPath.includes('.') ? rawPath.split('.').pop()?.toLowerCase() : undefined;
          return {
            type: 'imageAsset',
            path: rawPath,
            format,
          };
        }
        default:
          return undefined;
      }
    }
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
    case 'ConditionalExpression': {
      const test = resolveValue(expr.test, values, traces);
      return test ? resolveValue(expr.consequent, values, traces) : resolveValue(expr.alternate, values, traces);
    }
    default:
      return undefined;
  }
}

export function svgDocument(width: number, height: number, body: string, background = '#ffffff'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${background}"/>${body}</svg>`;
}

export function fitIntoBox(innerWidth: number, innerHeight: number, boxWidth: number, boxHeight: number): { scale: number; dx: number; dy: number } {
  const scale = Math.min(boxWidth / Math.max(innerWidth, 1), boxHeight / Math.max(innerHeight, 1));
  const dx = (boxWidth - innerWidth * scale) / 2;
  const dy = (boxHeight - innerHeight * scale) / 2;
  return { scale, dx, dy };
}

export function extractSvgDocument(svg: string): SvgDocument {
  const widthMatch = svg.match(/width="([0-9.]+)"/);
  const heightMatch = svg.match(/height="([0-9.]+)"/);
  const width = widthMatch ? Number(widthMatch[1]) : 800;
  const height = heightMatch ? Number(heightMatch[1]) : 600;
  const body = svg.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '');
  return { width, height, svg: body };
}

export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  let consumed = 0;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      consumed += 1;
    } else {
      lines.push(current);
      current = word;
      consumed += 1;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  const limited = lines.slice(0, maxLines);
  if (consumed < words.length && limited.length) {
    const lastIndex = limited.length - 1;
    const room = Math.max(0, maxChars - 3);
    const base = limited[lastIndex].slice(0, room).trimEnd();
    limited[lastIndex] = `${base}...`;
  }
  return limited;
}

export function looksLikeFormula(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if ((trimmed.startsWith('$') && trimmed.endsWith('$')) || (trimmed.startsWith('\\(') && trimmed.endsWith('\\)'))) return true;
  if (/\\[A-Za-z]+/.test(trimmed)) return true;
  if ((/[_^{}]/.test(trimmed) || /=/.test(trimmed)) && !/\s{2,}/.test(trimmed)) return true;
  return false;
}

export function normalizeFormulaText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed.slice(1, -1);
  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) return trimmed.slice(2, -2);
  return trimmed;
}

export function renderFormulaText(
  value: string,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    color?: string;
    anchor?: 'start' | 'middle' | 'end';
    weight?: string;
  } = {},
): string {
  const fontSize = options.fontSize ?? 22;
  const color = options.color ?? '#0f172a';
  const anchor = options.anchor ?? 'middle';
  const weight = options.weight ?? '500';
  return `<text x="${round(x)}" y="${round(y)}" text-anchor="${anchor}" font-size="${round(fontSize)}" font-style="italic" font-weight="${weight}" fill="${color}">${escapeXml(normalizeFormulaText(value))}</text>`;
}
