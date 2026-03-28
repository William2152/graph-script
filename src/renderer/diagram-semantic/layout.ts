/**
 * Semantic diagram layout orchestrator that composes lanes, cards, decorators,
 * and connector compilation into final renderable elements.
 */
import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { resolveValue } from '../common';
import { expandGraphElements } from '../graph';
import { DEFAULT_FONT_FAMILY, measureRichTextBlock, readLatexMode } from '../latex';
import { compileConnector, estimateConnectorPriority } from './connectors';
import {
  BODY_TEXT_MIN,
  CARD_GAP_MIN,
  CHILD_GAP_MIN,
  HEADER_TITLE_MIN,
  SECTION_TITLE_MIN,
  BoxArea,
  ConnectorRoutingContext,
  SemanticCompileOptions,
  SemanticCompileResult,
  SEMANTIC_TYPES,
} from './types';
import {
  element,
  getNumber,
  getString,
  measureSemanticBounds,
  resolveLaneLabel,
  resolveLanes,
} from './helpers';
import { layoutCards } from './layout-cards';
import { compactLaneFrames } from './layout-decorators';

export async function compileSemanticDiagram(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  width: number,
  height: number,
  options: SemanticCompileOptions = {},
): Promise<SemanticCompileResult> {
  const hasSemantic = elements.some((element) => SEMANTIC_TYPES.has(element.type));
  if (!hasSemantic) {
    return { elements: expandGraphElements(elements, values, traces), minWidth: width, minHeight: height, hasSemantic: false };
  }

  const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;
  const imageScale = options.imageScale ?? 1;
  const fillImages = options.fillImages ?? false;
  const fontScale = options.fontScale ?? 1;
  const semantic = elements.filter((element) => SEMANTIC_TYPES.has(element.type));
  const plain = elements.filter((element) => !SEMANTIC_TYPES.has(element.type));

  const header = semantic.find((element) => element.type === 'header');
  const separator = semantic.find((element) => element.type === 'separator');
  const loopLabel = semantic.find((element) => element.type === 'loop_label');
  const laneElements = semantic.filter((element) => element.type === 'lane');
  const cardElements = semantic.filter((element) => element.type === 'card');
  const connectorElements = semantic.filter((element) => element.type === 'connector');

  const outerPadX = 36;
  const outerPadBottom = 36;
  const topPad = header ? 20 : 30;
  const contentX = outerPadX;
  const contentWidth = Math.max(900, width - outerPadX * 2);
  const compiled: DiagramElement[] = [];

  let cursorY = topPad;

  if (header) {
    const headerHeight = Math.max(70, getNumber(header, values, traces, 'h', 76));
    const fill = getString(header, values, traces, 'fill', '#173f76');
    const stroke = getString(header, values, traces, 'stroke', fill);
    const title = getString(header, values, traces, 'title', getString(header, values, traces, 'label', header.name));
    const color = getString(header, values, traces, 'color', '#ffffff');
    const size = Math.max(HEADER_TITLE_MIN, getNumber(header, values, traces, 'size', HEADER_TITLE_MIN));
    const titleBlock = await measureRichTextBlock(title, {
      x: width / 2,
      y: 0,
      maxWidth: contentWidth - 56,
      fontSize: size,
      weight: getString(header, values, traces, 'weight', '800'),
      anchor: 'middle',
      latex: readLatexMode(resolveValue(header.properties.latex, values, traces), 'auto'),
      maxLines: 2,
      fontFamily,
    });
    compiled.push(element('box', `${header.name}-bg`, {
      x: contentX,
      y: cursorY,
      w: contentWidth,
      h: headerHeight,
      label: '',
      fill,
      stroke,
      radius: getNumber(header, values, traces, 'radius', 0),
      shadow: false,
      validation_ignore: true,
    }));
    compiled.push(element('text', `${header.name}-title`, {
      x: width / 2,
      y: cursorY + Math.max(10, (headerHeight - titleBlock.height) / 2),
      w: contentWidth - 56,
      h: titleBlock.height,
      anchor: 'middle',
      value: title,
      size,
      weight: getString(header, values, traces, 'weight', '800'),
      color,
      latex: getString(header, values, traces, 'latex', 'auto'),
      font_family: fontFamily,
      min_gap: CHILD_GAP_MIN,
      semantic_role: 'header_title',
    }));
    cursorY += headerHeight + Math.max(CARD_GAP_MIN, getNumber(header, values, traces, 'gap', 30));
  }

  let lanes = resolveLanes(laneElements, separator, values, traces, contentX, cursorY, contentWidth, height);
  const separatorHeight = separator ? Math.max(46, getNumber(separator, values, traces, 'h', 48)) : 0;
  const separatorGap = separator ? Math.max(CARD_GAP_MIN, getNumber(separator, values, traces, 'gap', 30)) : 0;
  const reservedLabelAreas: BoxArea[] = [];
  const laneTop = cursorY + separatorHeight + separatorGap;
  for (const lane of lanes) {
    lane.frame.y = laneTop;
    lane.frame.h = Math.max(0, lane.frame.h - laneTop);
  }

  let cards = await layoutCards(cardElements, lanes, values, traces, fontFamily, imageScale, fillImages, fontScale);
  lanes = compactLaneFrames(lanes, cards, contentX, contentWidth, separator ? 84 : 52);
  for (const lane of lanes) {
    lane.frame.y = laneTop;
    lane.frame.h = Math.max(0, height - laneTop);
  }
  cards = await layoutCards(cardElements, lanes, values, traces, fontFamily, imageScale, fillImages, fontScale);
  let contentBottom = Math.max(laneTop, ...cards.map((card) => card.y + card.height));
  const packedLeft = lanes.length ? Math.min(...lanes.map((lane) => lane.frame.x)) : contentX;
  const packedRight = lanes.length ? Math.max(...lanes.map((lane) => lane.frame.x + lane.frame.w)) : contentX + contentWidth;
  const packedCenterX = (packedLeft + packedRight) / 2;

  if (header) {
    const headerBg = compiled.find((elementToFind) => elementToFind.name === `${header.name}-bg`);
    const headerTitle = compiled.find((elementToFind) => elementToFind.name === `${header.name}-title`);
    const headerWidth = Math.max(360, packedRight - packedLeft);
    if (headerBg) {
      headerBg.properties.x = { type: 'Literal', value: packedLeft, location: headerBg.properties.x.location };
      headerBg.properties.w = { type: 'Literal', value: headerWidth, location: headerBg.properties.w.location };
    }
    if (headerTitle) {
      headerTitle.properties.x = { type: 'Literal', value: packedCenterX, location: headerTitle.properties.x.location };
      headerTitle.properties.w = { type: 'Literal', value: Math.max(280, headerWidth - 56), location: headerTitle.properties.w.location };
    }
  }

  if (separator) {
    const size = Math.max(SECTION_TITLE_MIN, getNumber(separator, values, traces, 'size', SECTION_TITLE_MIN));
    const color = getString(separator, values, traces, 'color', '#333333');
    for (const lane of lanes) {
      const label = resolveLaneLabel(lane, separator, values, traces);
      const labelBlock = await measureRichTextBlock(label, {
        x: lane.frame.x + lane.frame.w / 2,
        y: 0,
        maxWidth: lane.frame.w - 28,
        fontSize: size,
        weight: getString(separator, values, traces, 'weight', '800'),
        anchor: 'middle',
        latex: 'auto',
        maxLines: 2,
        fontFamily,
      });
      compiled.push(element('text', `${separator.name}-${lane.id}-label`, {
        x: lane.frame.x + lane.frame.w / 2,
        y: cursorY + Math.max(0, (separatorHeight - labelBlock.height) / 2),
        w: lane.frame.w - 28,
        h: labelBlock.height,
        anchor: 'middle',
        value: label,
        size,
        weight: getString(separator, values, traces, 'weight', '800'),
        color,
        font_family: fontFamily,
        semantic_role: 'section_heading',
      }));
      reservedLabelAreas.push({
        x: lane.frame.x + 14,
        y: cursorY + Math.max(0, (separatorHeight - labelBlock.height) / 2),
        width: Math.max(120, lane.frame.w - 28),
        height: labelBlock.height,
      });
    }
  }

  if (separator) {
    const separatorStroke = getString(separator, values, traces, 'stroke', '#a0a0a0');
    const dash = getString(separator, values, traces, 'dash', '10 12');
    const strokeWidth = getNumber(separator, values, traces, 'strokeWidth', 3);
    const strokeOpacity = getNumber(separator, values, traces, 'strokeOpacity', 0.6);
    if (strokeOpacity > 0.01) {
      lanes.slice(0, -1).forEach((lane, index) => {
        const dividerX = lane.frame.x + lane.frame.w + 42;
        compiled.push(element('line', `${separator.name}-divider-${index + 1}`, {
          x: dividerX,
          y: cursorY + 6,
          x2: dividerX,
          y2: contentBottom + 5,
          stroke: separatorStroke,
          strokeWidth,
          dash,
          strokeOpacity,
          validation_ignore: true,
        }));
      });
    }
  }

  if (loopLabel) {
    const loopValue = getString(loopLabel, values, traces, 'value', loopLabel.name);
    const loopSize = Math.max(BODY_TEXT_MIN, getNumber(loopLabel, values, traces, 'size', 26));
    const block = await measureRichTextBlock(loopValue, {
      x: width / 2,
      y: 0,
      maxWidth: Math.max(220, (packedRight - packedLeft) * 0.32),
      fontSize: loopSize,
      weight: getString(loopLabel, values, traces, 'weight', '700'),
      anchor: 'middle',
      latex: 'auto',
      maxLines: 2,
      fontFamily,
    });
    compiled.push(element('text', `${loopLabel.name}-text`, {
      x: width / 2,
      y: (laneTop + contentBottom) / 2 - block.height / 2,
      w: Math.max(220, (packedRight - packedLeft) * 0.32),
      h: block.height,
      anchor: 'middle',
      value: loopValue,
      size: loopSize,
      weight: getString(loopLabel, values, traces, 'weight', '700'),
      color: getString(loopLabel, values, traces, 'color', '#e0e0e0'),
      font_family: fontFamily,
      validation_ignore: true,
      semantic_role: 'decorative',
    }));
  }

  compiled.push(...cards.map((card) => card.compiled));
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const routingContext: ConnectorRoutingContext = { segments: [], labels: [...reservedLabelAreas] };
  const sortedConnectors = [...connectorElements].sort((a, b) =>
    estimateConnectorPriority(b, cardMap, values, traces) - estimateConnectorPriority(a, cardMap, values, traces),
  );
  for (const connector of sortedConnectors) {
    const connectorParts = await compileConnector(connector, cardMap, routingContext, values, traces, fontFamily);
    compiled.push(...connectorParts);
  }

  contentBottom = Math.max(contentBottom, ...compiled
    .map((elementToMeasure) => {
      const y = getNumber(elementToMeasure, values, traces, 'y', 0);
      const h = getNumber(elementToMeasure, values, traces, 'h', 0);
      return y + h;
    })
    .filter((value) => Number.isFinite(value)));

  const finalElements = expandGraphElements([...compiled, ...plain], values, traces);
  const bounds = measureSemanticBounds(finalElements, values, traces);
  return {
    elements: finalElements,
    minWidth: Math.max(720, Math.min(width, bounds.maxX + outerPadX)),
    minHeight: Math.max(360, bounds.maxY + outerPadBottom),
    hasSemantic: true,
  };
}

export { isSemanticDiagramElement } from './helpers';
