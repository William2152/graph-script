import { looksLikeFormula, normalizeFormulaText, wrapText } from './common';
import { FitMode, FlowNodeDecl, LayoutNode, NodeBox } from './flow-types';

/**
 * Node text measuring and node box creation for flow layout.
 */
export function measureNodes(
  orderedNodeIds: string[],
  nodeById: Map<string, FlowNodeDecl>,
  fontSize: number,
  fit: FitMode,
): Map<string, NodeBox> {
  const measured = new Map<string, NodeBox>();
  orderedNodeIds.forEach((id) => {
    const node = nodeById.get(id);
    if (!node) return;
    measured.set(id, measureNode(node.label || node.id, node.nodeType, fontSize, fit));
  });
  return measured;
}

export function createNode(id: string, box?: NodeBox): LayoutNode {
  const measured = box ?? measureNode(id, undefined, 17, 'readable');
  return {
    id,
    label: measured.label,
    nodeType: measured.nodeType,
    width: measured.width,
    height: measured.height,
    lines: measured.lines,
    x: 0,
    y: 0,
    fontSize: measured.fontSize,
    lineHeight: measured.lineHeight,
    textMode: measured.textMode,
  };
}

function measureNode(label: string, type: string | undefined, fontSize: number, fit: FitMode): NodeBox {
  const kind = (type ?? 'process').toLowerCase();
  const textMode: 'plain' | 'formula' = looksLikeFormula(label) ? 'formula' : 'plain';
  const normalized = textMode === 'formula' ? normalizeFormulaText(label) : label;
  const lineHeight = Math.round(fontSize * 1.28);
  const maxChars = fit === 'compact'
    ? (kind === 'decision' ? 16 : 20)
    : (kind === 'decision' ? 18 : 24);
  const lines = textMode === 'formula' ? [normalized] : wrapText(normalized, maxChars, 5);
  const longest = Math.max(...lines.map((line) => line.length), 8);
  const charWidth = textMode === 'formula' ? fontSize * 0.7 : fontSize * 0.64;
  const textWidth = longest * charWidth;
  const textHeight = lines.length * lineHeight;
  const widthPadding = textMode === 'formula' ? 74 : 58;

  switch (kind) {
    case 'decision':
      return {
        width: Math.max(230, textWidth + 86),
        height: Math.max(128, textHeight + 64),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    case 'start':
    case 'end':
      return {
        width: Math.max(180, textWidth + 70),
        height: Math.max(72, textHeight + 38),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    case 'data':
      return {
        width: Math.max(220, textWidth + 62),
        height: Math.max(88, textHeight + 42),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
    default:
      return {
        width: Math.max(250, textWidth + widthPadding),
        height: Math.max(98, textHeight + 42),
        lines,
        fontSize,
        lineHeight,
        textMode,
        label,
        nodeType: type,
      };
  }
}
