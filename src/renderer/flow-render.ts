import { escapeXml, renderFormulaText, round } from './common';
import { FlowLayout, LayoutNode } from './flow-types';

/**
 * SVG rendering for an already-computed flow layout.
 */
export function renderFlow(layout: FlowLayout, title?: string): string {
  const titleBlock = title ? 72 : 24;
  const contentWidth = Math.max(0, layout.maxX - layout.minX);
  const contentHeight = Math.max(0, layout.maxY - layout.minY);
  const targetWidth = Math.max(layout.options.targetWidth, contentWidth + 120);
  const targetHeight = Math.max(layout.options.targetHeight, contentHeight + titleBlock + 90);
  const svgWidth = Math.max(560, targetWidth);
  const svgHeight = Math.max(360, targetHeight);
  const horizontalPadding = Math.max(50, (svgWidth - contentWidth) / 2);
  const offsetX = horizontalPadding - layout.minX;
  const verticalSlack = Math.max(24, svgHeight - (contentHeight + titleBlock + 34));
  const offsetY = titleBlock + verticalSlack / 2 - layout.minY;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${round(svgWidth)}" height="${round(svgHeight)}" viewBox="0 0 ${round(svgWidth)} ${round(svgHeight)}">`;
  svg += `<rect width="${round(svgWidth)}" height="${round(svgHeight)}" fill="#ffffff"/>`;
  if (title) {
    svg += `<text x="${round(svgWidth / 2)}" y="36" text-anchor="middle" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>`;
  }

  svg += `<defs>`;
  svg += `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`;
  svg += `<path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>`;
  svg += `</defs>`;
  svg += `<g transform="translate(${round(offsetX)}, ${round(offsetY)})">`;

  layout.edges.forEach((edge) => {
    if (edge.points.length < 2) return;
    const polyline = edge.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
    svg += `<polyline points="${polyline}" fill="none" stroke="#475569" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" marker-end="url(#arrow)"/>`;
    if (edge.label) {
      const mid = edge.points[Math.floor(edge.points.length / 2)];
      const chipWidth = Math.max(56, edge.label.length * 8 + 24);
      svg += `<rect x="${round(mid.x - chipWidth / 2)}" y="${round(mid.y - 22)}" width="${round(chipWidth)}" height="24" rx="12" fill="#ffffff" stroke="#cbd5e1"/>`;
      svg += `<text x="${round(mid.x)}" y="${round(mid.y - 7)}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${escapeXml(edge.label)}</text>`;
    }
  });

  layout.nodes.forEach((node) => {
    svg += renderNode(node);
  });

  svg += `</g></svg>`;
  return svg;
}

function renderNode(node: LayoutNode): string {
  const type = (node.nodeType ?? 'process').toLowerCase();
  const theme = nodeTheme(type);
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const textBlockHeight = node.lines.length * node.lineHeight;
  const textStart = node.y - textBlockHeight / 2 + node.fontSize * 0.82;

  let svg = `<g>`;
  switch (type) {
    case 'start':
    case 'end':
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" rx="${round(node.height / 2)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    case 'decision': {
      const top = `${round(node.x)},${round(y)}`;
      const right = `${round(node.x + node.width / 2)},${round(node.y)}`;
      const bottom = `${round(node.x)},${round(node.y + node.height / 2)}`;
      const left = `${round(node.x - node.width / 2)},${round(node.y)}`;
      svg += `<polygon points="${top} ${right} ${bottom} ${left}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    }
    case 'data': {
      const skew = 18;
      svg += `<polygon points="${round(x + skew)},${round(y)} ${round(x + node.width)},${round(y)} ${round(x + node.width - skew)},${round(y + node.height)} ${round(x)},${round(y + node.height)}" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
    }
    default:
      svg += `<rect x="${round(x)}" y="${round(y)}" width="${round(node.width)}" height="${round(node.height)}" rx="16" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2.2"/>`;
      break;
  }

  node.lines.forEach((line, index) => {
    const lineY = textStart + index * node.lineHeight;
    if (node.textMode === 'formula') {
      svg += renderFormulaText(line, node.x, lineY, {
        fontSize: node.fontSize,
        color: theme.text,
        anchor: 'middle',
        weight: '700',
      });
    } else {
      svg += `<text x="${round(node.x)}" y="${round(lineY)}" text-anchor="middle" font-size="${round(node.fontSize)}" font-weight="700" fill="${theme.text}">${escapeXml(line)}</text>`;
    }
  });
  svg += `</g>`;
  return svg;
}

function nodeTheme(type: string): { fill: string; stroke: string; text: string } {
  switch (type) {
    case 'start':
      return { fill: '#dcfce7', stroke: '#16a34a', text: '#166534' };
    case 'end':
      return { fill: '#fee2e2', stroke: '#dc2626', text: '#991b1b' };
    case 'decision':
      return { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' };
    case 'data':
      return { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' };
    default:
      return { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' };
  }
}
