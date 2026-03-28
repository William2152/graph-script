import { PageDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { escapeXml, extractSvgDocument, readNumber, readString, resolveValue, round, svgDocument } from './common';
import { planPageLayout, PageTargetDocument } from './page-layout';
import { readReadabilityMode } from './readability-policy';

interface RenderEmbed {
  (target: string): Promise<string | null>;
}

export async function renderPage(decl: PageDeclaration, values: Record<string, GSValue>, traces: Map<string, Trace>, renderEmbed: RenderEmbed, renderOptions: { fontScale?: number; imageScale?: number; fillImages?: boolean } = {}): Promise<string> {
  const title = readString(resolveValue(decl.properties.title, values, traces), decl.name);
  const subtitle = readString(resolveValue(decl.properties.subtitle, values, traces), '');
  const readabilityMode = readReadabilityMode(decl.properties.readability_mode, values, traces, 'auto');
  const docs = new Map<string, PageTargetDocument>();

  for (const placement of decl.placements) {
    const embedded = await renderEmbed(placement.target);
    if (!embedded) {
      docs.set(placement.target, { target: placement.target, width: 800, height: 600, svg: null });
      continue;
    }
    const doc = extractSvgDocument(embedded);
    docs.set(placement.target, { target: placement.target, width: doc.width, height: doc.height, svg: embedded });
  }

  const layout = planPageLayout(decl, [...docs.values()], values, traces, { readabilityMode });
  const width = layout.width;
  const height = layout.height;

  let body = '';
  body += `<text x="${width / 2}" y="42" text-anchor="middle" font-size="30" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>`;
  if (subtitle) body += `<text x="${width / 2}" y="68" text-anchor="middle" font-size="15" fill="#64748b">${escapeXml(subtitle)}</text>`;

  for (const placement of layout.placements) {
    body += `<rect x="${round(placement.x)}" y="${round(placement.y)}" width="${round(placement.cellWidth)}" height="${round(placement.cellHeight)}" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>`;
    const embedded = docs.get(placement.target)?.svg;
    if (!embedded) {
      body += `<text x="${round(placement.x + placement.cellWidth / 2)}" y="${round(placement.y + placement.cellHeight / 2)}" text-anchor="middle" font-size="14" fill="#475569">Missing: ${escapeXml(placement.target)}</text>`;
      continue;
    }
    const doc = extractSvgDocument(embedded);
    const translateY = readabilityMode === 'legacy'
      ? placement.y + 12 + placement.dy
      : placement.y + 12;
    body += `<g transform="translate(${round(placement.x + 12 + placement.dx)}, ${round(translateY)}) scale(${round(placement.scale, 4)})">${doc.svg}</g>`;
  }

  return svgDocument(width, height, body, '#f8fafc');
}
