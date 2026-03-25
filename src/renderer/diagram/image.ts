import * as fs from 'fs';
import * as path from 'path';
import { GSValue } from '../../runtime/values';
import { escapeXml, resolveValue } from '../common';

export function loadImageHref(srcValue: unknown, assetBaseDir: string): string {
  const source = resolveImageSource(srcValue);
  if (!source) throw new Error('Image element requires a valid src');
  const absolutePath = path.isAbsolute(source.path) ? source.path : path.resolve(assetBaseDir, source.path);
  if (!fs.existsSync(absolutePath)) throw new Error(`Image asset not found: ${absolutePath}`);

  const ext = (source.format || path.extname(absolutePath).slice(1)).toLowerCase();
  const mime = ext === 'png'
    ? 'image/png'
    : ext === 'svg'
      ? 'image/svg+xml'
      : null;
  if (!mime) throw new Error(`Unsupported image asset format: ${absolutePath}`);

  const encoded = fs.readFileSync(absolutePath).toString('base64');
  return `data:${mime};base64,${encoded}`;
}

export function resolveImageSource(srcValue: unknown): { path: string; format: string } | null {
  if (typeof srcValue === 'string' && srcValue.trim()) {
    return { path: srcValue, format: path.extname(srcValue).slice(1).toLowerCase() };
  }
  if (srcValue && typeof srcValue === 'object') {
    const candidate = srcValue as Record<string, unknown>;
    if (candidate.type === 'imageAsset' && typeof candidate.path === 'string') {
      const format = typeof candidate.format === 'string' && candidate.format
        ? candidate.format.toLowerCase()
        : path.extname(candidate.path).slice(1).toLowerCase();
      return { path: candidate.path, format };
    }
  }
  return null;
}

export function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}