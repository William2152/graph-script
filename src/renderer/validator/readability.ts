import { DiagramDeclaration, DiagramElement, FlowDeclaration, PageDeclaration } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { readNumber, readString, resolveValue } from '../common';
import { compileSemanticDiagram } from '../diagram-semantic';
import { normalizeDiagramElementsForReadability } from '../diagram/readability';
import { layoutFlow, LayoutNode } from '../flow';
import { DEFAULT_FONT_FAMILY } from '../latex';
import { estimateDeclarationCanvasSize, findRenderableTargetDeclaration, planPageLayout } from '../page-layout';
import { readReadabilityMode, READABILITY_POLICY } from '../readability-policy';
import { BoundingBox, ReadabilityMetrics, ValidationIssue, ValidationSnapshot, MIN_FONT_SIZE, MIN_ELEMENT_SIZE } from './types';
import { getNumberProperty, getStringProperty } from './helpers';
import { extractBoundingBoxes } from './detection';

export function calculateReadability(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>
): ReadabilityMetrics {
  let minFontSize = Infinity;
  let totalFontSize = 0;
  let fontSizeCount = 0;
  let minElementSize = Infinity;
  let totalArea = 0;
  let elementCount = 0;

  function processElements(elems: DiagramElement[]): void {
    for (const element of elems) {
      elementCount++;

      if (element.type === 'text' || element.type === 'formula') {
        const fontSize = getNumberProperty(element, values, traces, 'size', 16);
        minFontSize = Math.min(minFontSize, fontSize);
        totalFontSize += fontSize;
        fontSizeCount++;
      }
      if (element.type === 'panel' || element.type === 'box') {
        const label = getStringProperty(element, values, traces, 'label', '');
        if (label) {
          const titleSize = getNumberProperty(element, values, traces, 'title_size', getNumberProperty(element, values, traces, 'size', 16));
          minFontSize = Math.min(minFontSize, titleSize);
          totalFontSize += titleSize;
          fontSizeCount++;
        }
        const subtitle = getStringProperty(element, values, traces, 'subtitle', '');
        if (subtitle) {
          const subtitleSize = getNumberProperty(element, values, traces, 'subtitle_size', 14);
          minFontSize = Math.min(minFontSize, subtitleSize);
          totalFontSize += subtitleSize;
          fontSizeCount++;
        }
      }

      const w = getNumberProperty(element, values, traces, 'w', 0);
      const h = getNumberProperty(element, values, traces, 'h', 0);
      const area = w * h;
      if (area > 0 && element.type !== 'text' && element.type !== 'formula') {
        minElementSize = Math.min(minElementSize, Math.min(w, h));
        totalArea += area;
      }

      if (element.children?.length) {
        processElements(element.children);
      }
    }
  }

  processElements(elements);

  return {
    minFontSize: minFontSize === Infinity ? MIN_FONT_SIZE : minFontSize,
    avgFontSize: fontSizeCount > 0 ? totalFontSize / fontSizeCount : 16,
    minElementSize: minElementSize === Infinity ? MIN_ELEMENT_SIZE : minElementSize,
    density: totalArea,
    elementCount,
  };
}

export function calculateReadabilityScore(metrics: ReadabilityMetrics, issues: ValidationIssue[] = []): number {
  let score = 100;

  if (metrics.minFontSize < MIN_FONT_SIZE) {
    score -= (MIN_FONT_SIZE - metrics.minFontSize) * 5;
  }

  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    score -= (MIN_ELEMENT_SIZE - metrics.minElementSize) * 2;
  }

  if (metrics.elementCount > 80) {
    score -= Math.min(10, (metrics.elementCount - 80) * 0.2);
  }

  for (const issue of issues) {
    if (issue.severity === 'error') score -= 12;
    else if (issue.severity === 'warning') score -= 6;
    else score -= 2;
  }

  return Math.max(0, Math.min(100, score));
}

export async function buildValidationSnapshot(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ValidationSnapshot> {
  if (decl.type === 'DiagramDeclaration') {
    const diagram = decl as DiagramDeclaration;
    const width = readNumber(resolveValue(diagram.properties.width, values, traces), 1280);
    const height = readNumber(resolveValue(diagram.properties.height, values, traces), 720);
    const fontFamily = readString(resolveValue(diagram.properties.font_family, values, traces), DEFAULT_FONT_FAMILY);
    const readabilityMode = readReadabilityMode(diagram.properties.readability_mode, values, traces, 'auto');
    const compiled = await compileSemanticDiagram(diagram.elements || [], values, traces, width, height, { fontFamily, readabilityMode });
    const elements = !compiled.hasSemantic
      ? normalizeDiagramElementsForReadability(compiled.elements, values, traces, { mode: readabilityMode })
      : compiled.elements;
    return {
      elements,
      boxes: extractBoundingBoxes(elements, values, traces),
    };
  }

  if (decl.type === 'FlowDeclaration') {
    const layout = layoutFlow(decl as FlowDeclaration);
    const boxes = layout.nodes.map((node) => ({
      id: node.id,
      type: 'flow-node',
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
      width: node.width,
      height: node.height,
      allowOverlap: false,
    }));
    return { elements: [], boxes };
  }

  if (decl.type === 'PageDeclaration') {
    const page = decl as PageDeclaration;
    const readabilityMode = readReadabilityMode(page.properties.readability_mode, values, traces, 'auto');
    const docs = [];
    for (const placement of page.placements) {
      const targetDecl = findRenderableTargetDeclaration(placement.target, values);
      const size = await estimateDeclarationCanvasSize(targetDecl, values, traces);
      docs.push({ target: placement.target, width: size.width, height: size.height });
    }
    const plan = planPageLayout(page, docs, values, traces, {
      readabilityMode,
      minEmbedScale: readNumber(resolveValue(page.properties.min_embed_scale, values, traces), READABILITY_POLICY.minEmbedScale),
    });
    const elements: DiagramElement[] = plan.placements.map((placement) =>
      literalElement('panel', `page-cell-${placement.target}`, {
        x: placement.x,
        y: placement.y,
        w: placement.cellWidth,
        h: placement.cellHeight,
        semantic_role: 'page_cell',
      }, [
        literalElement('embed', `page-embed-${placement.target}`, {
          x: 12 + placement.dx,
          y: 12,
          w: placement.renderedWidth,
          h: Math.max(1, placement.renderedHeight),
          scale: placement.scale,
          min_scale: readNumber(resolveValue(page.properties.min_embed_scale, values, traces), READABILITY_POLICY.minEmbedScale),
          target: placement.target,
          below_min_scale: placement.belowMinScale,
        }),
      ]));
    return {
      elements,
      boxes: extractBoundingBoxes(elements, values, traces),
    };
  }

  const elements = decl.elements || [];
  return { elements, boxes: extractBoundingBoxes(elements, values, traces) };
}

function literalElement(type: string, name: string, props: Record<string, string | number | boolean>, children?: DiagramElement[]): DiagramElement {
  return {
    type,
    name,
    properties: Object.fromEntries(Object.entries(props).map(([key, value]) => [
      key,
      { type: 'Literal', value, location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } } },
    ])),
    ...(children?.length ? { children } : {}),
  };
}
