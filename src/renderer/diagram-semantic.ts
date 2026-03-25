import { DiagramElement, Expression } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { asStringArray, readBoolean, readNumber, readString, resolveValue } from './common';
import { measureDisplayFormula, measureRichTextBlock, readLatexMode } from './latex';

const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

const SEMANTIC_TYPES = new Set(['header', 'separator', 'lane', 'card', 'connector', 'loop_label']);
const CONTAINER_TYPES = new Set(['group', 'divider', 'spacer']);

const HEADER_TITLE_MIN = 22;
const CARD_TITLE_MIN = 18;
const BODY_TEXT_MIN = 14;
const FORMULA_TEXT_MIN = 18;
const CONNECTOR_LABEL_MIN = 14;
const CARD_GAP_MIN = 24;
const CHILD_GAP_MIN = 14;

export interface SemanticCompileResult {
  elements: DiagramElement[];
  minWidth: number;
  minHeight: number;
  hasSemantic: boolean;
}

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LaneSpec {
  id: string;
  section: string;
  order: number;
  ratio: number;
  columns: number;
  gapX: number;
  gapY: number;
  padding: number;
  frame: Frame;
}

interface CardLayout {
  id: string;
  section: string;
  row: number;
  col: number;
  span: number;
  rowSpan: number;
  width: number;
  height: number;
  x: number;
  y: number;
  laneId: string;
  compiled: DiagramElement;
}

interface ConnectorPath {
  points: { x: number; y: number }[];
  labelX: number;
  labelY: number;
  labelSegmentLength: number;
  labelSegmentStart: { x: number; y: number };
  labelSegmentEnd: { x: number; y: number };
}

interface BoxArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ConnectorSegmentObstacle {
  start: { x: number; y: number };
  end: { x: number; y: number };
  connectorId: string;
}

interface ConnectorRoutingContext {
  segments: ConnectorSegmentObstacle[];
  labels: BoxArea[];
}

interface ChildLayout {
  width: number;
  height: number;
  elements: DiagramElement[];
}

interface CardMeasurement {
  height: number;
  children: DiagramElement[];
}

interface ContainerOptions {
  layout: 'stack' | 'row' | 'columns';
  gap: number;
  padding: number;
  columns: number;
  align: 'start' | 'center' | 'end' | 'stretch';
}

export async function compileSemanticDiagram(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  width: number,
  height: number,
): Promise<SemanticCompileResult> {
  const hasSemantic = elements.some((element) => SEMANTIC_TYPES.has(element.type));
  if (!hasSemantic) {
    return { elements, minWidth: width, minHeight: height, hasSemantic: false };
  }

  const semantic = elements.filter((element) => SEMANTIC_TYPES.has(element.type));
  const plain = elements.filter((element) => !SEMANTIC_TYPES.has(element.type));

  const header = semantic.find((element) => element.type === 'header');
  const separator = semantic.find((element) => element.type === 'separator');
  const loopLabel = semantic.find((element) => element.type === 'loop_label');
  const laneElements = semantic.filter((element) => element.type === 'lane');
  const cardElements = semantic.filter((element) => element.type === 'card');
  const connectorElements = semantic.filter((element) => element.type === 'connector');

  const outerPadX = 36;
  const outerPadBottom = 48;
  const topPad = header ? 20 : 30;
  const contentX = outerPadX;
  const contentWidth = Math.max(820, width - outerPadX * 2);
  const compiled: DiagramElement[] = [];

  let cursorY = topPad;

  if (header) {
    const headerHeight = Math.max(60, getNumber(header, values, traces, 'h', 68));
    const fill = getString(header, values, traces, 'fill', '#173f76');
    const stroke = getString(header, values, traces, 'stroke', fill);
    const title = getString(header, values, traces, 'title', getString(header, values, traces, 'label', header.name));
    const color = getString(header, values, traces, 'color', '#ffffff');
    const size = Math.max(HEADER_TITLE_MIN, getNumber(header, values, traces, 'size', HEADER_TITLE_MIN));
    const titleBlock = await measureRichTextBlock(title, {
      x: width / 2,
      y: 0,
      maxWidth: contentWidth - 48,
      fontSize: size,
      weight: getString(header, values, traces, 'weight', '800'),
      anchor: 'middle',
      latex: readLatexMode(resolveValue(header.properties.latex, values, traces), 'auto'),
      maxLines: 2,
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
      y: cursorY + Math.max(8, (headerHeight - titleBlock.height) / 2),
      w: contentWidth - 48,
      h: titleBlock.height,
      anchor: 'middle',
      value: title,
      size,
      weight: getString(header, values, traces, 'weight', '800'),
      color,
      latex: getString(header, values, traces, 'latex', 'auto'),
      min_gap: CHILD_GAP_MIN,
    }));
    cursorY += headerHeight + Math.max(CARD_GAP_MIN, getNumber(header, values, traces, 'gap', 26));
  }

  const lanes = resolveLanes(laneElements, separator, values, traces, contentX, cursorY, contentWidth, height);
  const separatorHeight = separator ? Math.max(40, getNumber(separator, values, traces, 'h', 46)) : 0;
  if (separator) {
    const size = Math.max(CARD_TITLE_MIN + 2, getNumber(separator, values, traces, 'size', 22));
    const color = getString(separator, values, traces, 'color', '#333333');
    for (const lane of lanes) {
      const label = resolveLaneLabel(lane, separator, values, traces);
      const labelBlock = await measureRichTextBlock(label, {
        x: lane.frame.x + lane.frame.w / 2,
        y: 0,
        maxWidth: lane.frame.w - 24,
        fontSize: size,
        weight: getString(separator, values, traces, 'weight', '800'),
        anchor: 'middle',
        latex: 'auto',
        maxLines: 2,
      });
      compiled.push(element('text', `${separator.name}-${lane.id}-label`, {
        x: lane.frame.x + lane.frame.w / 2,
        y: cursorY + Math.max(0, (separatorHeight - labelBlock.height) / 2),
        w: lane.frame.w - 24,
        h: labelBlock.height,
        anchor: 'middle',
        value: label,
        size,
        weight: getString(separator, values, traces, 'weight', '800'),
        color,
      }));
    }
    cursorY += separatorHeight + Math.max(CARD_GAP_MIN, getNumber(separator, values, traces, 'gap', 30));
  }

  const laneTop = cursorY;
  for (const lane of lanes) {
    lane.frame.y = laneTop;
    lane.frame.h = Math.max(0, lane.frame.h - laneTop);
  }

  const cards = await layoutCards(cardElements, lanes, values, traces);
  let contentBottom = Math.max(laneTop, ...cards.map((card) => card.y + card.height));

  if (separator) {
    const separatorStroke = getString(separator, values, traces, 'stroke', '#a0a0a0');
    const dash = getString(separator, values, traces, 'dash', '10 12');
    const strokeWidth = getNumber(separator, values, traces, 'strokeWidth', 3);
    lanes.slice(0, -1).forEach((lane, index) => {
      const dividerX = lane.frame.x + lane.frame.w;
      compiled.push(element('line', `${separator.name}-divider-${index + 1}`, {
        x: dividerX,
        y: cursorY - separatorHeight + 6,
        x2: dividerX,
        y2: contentBottom + 18,
        stroke: separatorStroke,
        strokeWidth,
        dash,
        strokeOpacity: getNumber(separator, values, traces, 'strokeOpacity', 0.6),
        validation_ignore: true,
      }));
    });
  }

  if (loopLabel) {
    const loopValue = getString(loopLabel, values, traces, 'value', loopLabel.name);
    const loopSize = getNumber(loopLabel, values, traces, 'size', 38);
    const block = await measureRichTextBlock(loopValue, {
      x: width / 2,
      y: 0,
      maxWidth: Math.max(240, contentWidth * 0.35),
      fontSize: loopSize,
      weight: getString(loopLabel, values, traces, 'weight', '800'),
      anchor: 'middle',
      latex: 'auto',
      maxLines: 2,
    });
    compiled.push(element('text', `${loopLabel.name}-text`, {
      x: width / 2,
      y: (laneTop + contentBottom) / 2 - block.height / 2,
      w: Math.max(240, contentWidth * 0.35),
      h: block.height,
      anchor: 'middle',
      value: loopValue,
      size: loopSize,
      weight: getString(loopLabel, values, traces, 'weight', '800'),
      color: getString(loopLabel, values, traces, 'color', '#e0e0e0'),
      validation_ignore: true,
    }));
  }

  compiled.push(...cards.map((card) => card.compiled));
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const routingContext: ConnectorRoutingContext = { segments: [], labels: [] };
  const sortedConnectors = [...connectorElements].sort((a, b) =>
    estimateConnectorPriority(b, cardMap, values, traces) - estimateConnectorPriority(a, cardMap, values, traces),
  );
  for (const connector of sortedConnectors) {
    const connectorParts = await compileConnector(connector, cardMap, routingContext, values, traces);
    compiled.push(...connectorParts);
  }

  contentBottom = Math.max(contentBottom, ...compiled
    .map((elementToMeasure) => {
      const y = getNumber(elementToMeasure, values, traces, 'y', 0);
      const h = getNumber(elementToMeasure, values, traces, 'h', 0);
      return y + h;
    })
    .filter((value) => Number.isFinite(value)));

  return {
    elements: [...compiled, ...plain],
    minWidth: width,
    minHeight: Math.max(height, contentBottom + outerPadBottom),
    hasSemantic: true,
  };
}

function resolveLanes(
  laneElements: DiagramElement[],
  separator: DiagramElement | undefined,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  contentX: number,
  cursorY: number,
  contentWidth: number,
  height: number,
): LaneSpec[] {
  const base = laneElements.map((element, index) => ({
    id: element.name,
    section: getString(element, values, traces, 'section', element.name),
    order: getNumber(element, values, traces, 'order', index + 1),
    ratio: Math.max(0.15, getNumber(element, values, traces, 'ratio', 1)),
    columns: Math.max(1, getNumber(element, values, traces, 'columns', 1)),
    gapX: Math.max(CARD_GAP_MIN, getNumber(element, values, traces, 'gap_x', getNumber(element, values, traces, 'gap', 28))),
    gapY: Math.max(CARD_GAP_MIN, getNumber(element, values, traces, 'gap_y', getNumber(element, values, traces, 'gap', 28))),
    padding: Math.max(18, getNumber(element, values, traces, 'padding', 22)),
  })).sort((a, b) => a.order - b.order);

  const labels = separator ? asStringArray(resolveValue(separator.properties.labels, values, traces)) : [];
  const laneCount = Math.max(1, base.length || labels.length || 1);
  const lanes = (base.length
    ? base
    : Array.from({ length: laneCount }, (_, index) => ({
        id: `lane-${index + 1}`,
        section: `lane-${index + 1}`,
        order: index + 1,
        ratio: 1,
        columns: 1,
        gapX: CARD_GAP_MIN,
        gapY: CARD_GAP_MIN,
        padding: 22,
      })));
  const totalRatio = lanes.reduce((sum, lane) => sum + lane.ratio, 0) || laneCount;

  let cursorX = contentX;
  return lanes.map((lane) => {
    const frameWidth = contentWidth * (lane.ratio / totalRatio);
    const frame = { x: cursorX, y: cursorY, w: frameWidth, h: height - cursorY };
    cursorX += frameWidth;
    return { ...lane, frame };
  });
}

function resolveLaneLabel(
  lane: LaneSpec,
  separator: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): string {
  const labels = asStringArray(resolveValue(separator.properties.labels, values, traces));
  return labels[lane.order - 1] ?? lane.section;
}

async function layoutCards(
  cardElements: DiagramElement[],
  lanes: LaneSpec[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<CardLayout[]> {
  const cards: CardLayout[] = [];

  for (const lane of lanes) {
    const laneCards = cardElements
      .filter((card) => getString(card, values, traces, 'section', '') === lane.section)
      .sort((a, b) => {
        const rowDiff = getNumber(a, values, traces, 'row', 1) - getNumber(b, values, traces, 'row', 1);
        if (rowDiff !== 0) return rowDiff;
        return getNumber(a, values, traces, 'col', 1) - getNumber(b, values, traces, 'col', 1);
      });
    if (!laneCards.length) continue;

    const innerX = lane.frame.x + lane.padding;
    const innerW = Math.max(160, lane.frame.w - lane.padding * 2);
    const columnWidth = (innerW - lane.gapX * (lane.columns - 1)) / lane.columns;

    const measured = [];
    const rowHeights = new Map<number, number>();
    let maxRow = 1;
    for (const card of laneCards) {
      const row = Math.max(1, getNumber(card, values, traces, 'row', 1));
      const col = Math.max(1, getNumber(card, values, traces, 'col', 1));
      const span = Math.max(1, Math.min(lane.columns - col + 1, getNumber(card, values, traces, 'span', 1)));
      const rowSpan = Math.max(1, getNumber(card, values, traces, 'row_span', 1));
      maxRow = Math.max(maxRow, row + rowSpan - 1);
      const slotWidth = columnWidth * span + lane.gapX * (span - 1);
      const preferredWidth = readNumber(resolveValue(card.properties.w, values, traces), slotWidth);
      const minWidth = getNumber(card, values, traces, 'min_w', 0);
      const boundedMinWidth = minWidth > 0 ? Math.min(slotWidth, minWidth) : 0;
      const width = Math.max(boundedMinWidth, Math.min(slotWidth, preferredWidth));
      const measurement = await measureCard(card, width, values, traces);
      measured.push({ card, row, col, span, rowSpan, width, height: measurement.height, children: measurement.children });
      if (rowSpan === 1) {
        rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, measurement.height));
      }
    }

    for (let row = 1; row <= maxRow; row += 1) {
      if (!rowHeights.has(row)) rowHeights.set(row, 0);
    }

    let adjusted = true;
    let guard = 0;
    while (adjusted && guard < 6) {
      adjusted = false;
      guard += 1;
      for (const entry of measured.filter((item) => item.rowSpan > 1)) {
        const currentHeight = spanHeight(rowHeights, entry.row, entry.rowSpan, lane.gapY);
        if (currentHeight + 0.1 < entry.height) {
          const delta = (entry.height - currentHeight) / entry.rowSpan;
          for (let row = entry.row; row < entry.row + entry.rowSpan; row += 1) {
            rowHeights.set(row, (rowHeights.get(row) ?? 0) + delta);
          }
          adjusted = true;
        }
      }
    }

    const rowY = new Map<number, number>();
    let cursorY = lane.frame.y + 8;
    for (let row = 1; row <= maxRow; row += 1) {
      rowY.set(row, cursorY);
      cursorY += (rowHeights.get(row) ?? 0) + lane.gapY;
    }

    for (const entry of measured) {
      const slotWidth = columnWidth * entry.span + lane.gapX * (entry.span - 1);
      const x = innerX + (entry.col - 1) * (columnWidth + lane.gapX) + Math.max(0, (slotWidth - entry.width) / 2);
      const y = rowY.get(entry.row) ?? lane.frame.y;
      const reservedHeight = spanHeight(rowHeights, entry.row, entry.rowSpan, lane.gapY);
      const height = entry.rowSpan > 1 ? Math.max(entry.height, reservedHeight) : entry.height;
      const compiled = compileMeasuredCard(entry.card, x, y, entry.width, height, entry.children, values, traces);
      cards.push({
        id: entry.card.name,
        section: lane.section,
        row: entry.row,
        col: entry.col,
        span: entry.span,
        rowSpan: entry.rowSpan,
        width: entry.width,
        height,
        x,
        y,
        laneId: lane.id,
        compiled,
      });
    }
  }

  return cards;
}

function spanHeight(rowHeights: Map<number, number>, row: number, rowSpan: number, gapY: number): number {
  let total = 0;
  for (let current = row; current < row + rowSpan; current += 1) {
    total += rowHeights.get(current) ?? 0;
  }
  if (rowSpan > 1) total += gapY * (rowSpan - 1);
  return total;
}

async function measureCard(
  card: DiagramElement,
  width: number,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<CardMeasurement> {
  const padding = Math.max(18, getNumber(card, values, traces, 'padding', 22));
  const gap = Math.max(CHILD_GAP_MIN, getNumber(card, values, traces, 'gap', 16));
  const label = getString(card, values, traces, 'label', card.name);
  const subtitle = getString(card, values, traces, 'subtitle', '');
  const titleSize = Math.max(CARD_TITLE_MIN, getNumber(card, values, traces, 'size', CARD_TITLE_MIN));
  const latexMode = readLatexMode(resolveValue(card.properties.latex, values, traces), 'auto');

  const titleBlock = label
    ? await measureRichTextBlock(label, {
        x: width / 2,
        y: 0,
        maxWidth: width - 28,
        fontSize: titleSize,
        weight: '800',
        anchor: 'middle',
        latex: latexMode,
        maxLines: 3,
      })
    : { width: 0, height: 0, lines: 0, mathFallbackCount: 0, normalizedValue: '' };

  const subtitleBlock = subtitle
    ? await measureRichTextBlock(subtitle, {
        x: width / 2,
        y: 0,
        maxWidth: width - 32,
        fontSize: BODY_TEXT_MIN,
        weight: '500',
        anchor: 'middle',
        latex: latexMode,
        maxLines: 4,
      })
    : { width: 0, height: 0, lines: 0, mathFallbackCount: 0, normalizedValue: '' };

  const headerHeight = titleBlock.height || subtitleBlock.height
    ? Math.max(56, 18 + titleBlock.height + (subtitle ? 8 + subtitleBlock.height : 0) + 16)
    : 22;

  const innerWidth = Math.max(120, width - padding * 2);
  const containerOptions = readContainerOptions(card, values, traces, 'stack', gap);
  const content = await layoutContainerChildren(card.children ?? [], innerWidth, containerOptions, values, traces);
  const bodyTop = headerHeight + padding;
  const fallbackHeight = headerHeight + padding * 2 + (content.elements.length ? content.height : 44);
  const minHeight = getNumber(card, values, traces, 'min_h', 0);
  return {
    height: Math.max(minHeight, fallbackHeight),
    children: offsetChildren(content.elements, padding, bodyTop),
  };
}

function compileMeasuredCard(
  card: DiagramElement,
  x: number,
  y: number,
  w: number,
  h: number,
  children: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): DiagramElement {
  return element('panel', card.name, {
    x,
    y,
    w,
    h,
    label: getString(card, values, traces, 'label', card.name),
    subtitle: getString(card, values, traces, 'subtitle', ''),
    fill: getString(card, values, traces, 'fill', '#ffffff'),
    stroke: getString(card, values, traces, 'stroke', '#cbd5e1'),
    radius: getNumber(card, values, traces, 'radius', 18),
    shadow: false,
    strokeWidth: getNumber(card, values, traces, 'strokeWidth', 1.8),
    dash: getString(card, values, traces, 'dash', ''),
    size: Math.max(CARD_TITLE_MIN, getNumber(card, values, traces, 'size', CARD_TITLE_MIN)),
    latex: getString(card, values, traces, 'latex', 'auto'),
    min_gap: Math.max(CHILD_GAP_MIN, getNumber(card, values, traces, 'gap', CHILD_GAP_MIN)),
    semantic_role: 'card',
  }, children);
}

async function layoutContainerChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ChildLayout> {
  if (!children.length) return { width, height: 0, elements: [] };
  if (options.layout === 'row') return layoutRowChildren(children, width, options, values, traces);
  if (options.layout === 'columns') return layoutColumnChildren(children, width, options, values, traces);
  return layoutStackChildren(children, width, options, values, traces);
}

async function layoutStackChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ChildLayout> {
  let cursorY = 0;
  const elements: DiagramElement[] = [];
  for (const child of children) {
    const measured = await measureChild(child, width, values, traces);
    const x = resolveAlignedX(options.align, width, measured.width);
    elements.push(...offsetChildren(measured.elements, x, cursorY));
    cursorY += measured.height + options.gap;
  }
  const height = Math.max(0, cursorY - options.gap);
  return { width, height, elements };
}

async function layoutRowChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ChildLayout> {
  const count = Math.max(children.length, 1);
  const budget = Math.max(72, (width - options.gap * (count - 1)) / count);
  const measured = [];
  for (const child of children) {
    measured.push(await measureChild(child, budget, values, traces));
  }
  const totalWidth = measured.reduce((sum, entry) => sum + entry.width, 0) + options.gap * Math.max(0, measured.length - 1);
  if (totalWidth > width + 8 && children.length > 1) {
    return layoutStackChildren(children, width, { ...options, align: options.align === 'stretch' ? 'stretch' : 'center' }, values, traces);
  }
  const rowHeight = Math.max(...measured.map((entry) => entry.height), 40);
  let cursorX = resolveAlignedX(options.align, width, totalWidth);
  const elements: DiagramElement[] = [];
  measured.forEach((entry) => {
    const y = (rowHeight - entry.height) / 2;
    elements.push(...offsetChildren(entry.elements, cursorX, y));
    cursorX += entry.width + options.gap;
  });
  return { width, height: rowHeight, elements };
}

async function layoutColumnChildren(
  children: DiagramElement[],
  width: number,
  options: ContainerOptions,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ChildLayout> {
  const columns = Math.max(1, options.columns);
  const cellWidth = (width - options.gap * (columns - 1)) / columns;
  const measured = await Promise.all(children.map((child) => measureChild(child, cellWidth, values, traces)));
  const rowHeights = new Map<number, number>();
  measured.forEach((entry, index) => {
    const row = Math.floor(index / columns);
    rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, entry.height));
  });

  const elements: DiagramElement[] = [];
  let totalHeight = 0;
  for (let index = 0; index < measured.length; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const y = totalHeight + rowOffset(rowHeights, row, options.gap);
    const rowHeight = rowHeights.get(row) ?? measured[index].height;
    const localX = col * (cellWidth + options.gap) + resolveAlignedX(options.align, cellWidth, measured[index].width);
    const localY = y + (rowHeight - measured[index].height) / 2;
    elements.push(...offsetChildren(measured[index].elements, localX, localY));
  }

  if (rowHeights.size > 0) {
    totalHeight = [...rowHeights.values()].reduce((sum, value) => sum + value, 0) + options.gap * Math.max(0, rowHeights.size - 1);
  }
  return { width, height: totalHeight, elements };
}

function rowOffset(rowHeights: Map<number, number>, row: number, gap: number): number {
  let offset = 0;
  for (let current = 0; current < row; current += 1) {
    offset += (rowHeights.get(current) ?? 0) + gap;
  }
  return offset;
}

async function measureChild(
  child: DiagramElement,
  maxWidth: number,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<ChildLayout> {
  switch (child.type) {
    case 'text': {
      const fontSize = Math.max(BODY_TEXT_MIN, getNumber(child, values, traces, 'size', BODY_TEXT_MIN));
      const value = getString(child, values, traces, 'value', child.name);
      const weight = getString(child, values, traces, 'weight', '600');
      const align = getString(child, values, traces, 'align', 'center');
      const latex = readLatexMode(resolveValue(child.properties.latex, values, traces), 'auto');
      const metrics = await measureRichTextBlock(value, {
        x: 0,
        y: 0,
        maxWidth,
        fontSize,
        weight,
        anchor: alignToAnchor(align),
        latex,
        maxLines: Math.max(2, getNumber(child, values, traces, 'max_lines', 6)),
      });
      const width = Math.min(maxWidth, Math.max(24, metrics.width));
      return {
        width: Math.max(24, metrics.width),
        height: Math.max(fontSize, metrics.height),
        elements: [
          cloneElement(child, {
            x: align === 'start' ? 0 : align === 'end' ? width : width / 2,
            y: 0,
            w: width,
            h: Math.max(fontSize, metrics.height),
            anchor: alignToAnchor(align),
            size: fontSize,
            latex,
            math_fallback: metrics.mathFallbackCount > 0,
            normalized_value: metrics.normalizedValue,
            min_gap: CHILD_GAP_MIN,
          }),
        ],
      };
    }
    case 'formula': {
      const fontSize = Math.max(FORMULA_TEXT_MIN, getNumber(child, values, traces, 'size', FORMULA_TEXT_MIN));
      const value = getString(child, values, traces, 'value', child.name);
      const metrics = await measureDisplayFormula(value, { fontSize });
      const constrainedWidth = Math.min(Math.max(metrics.width, 48), maxWidth);
      return {
        width: constrainedWidth,
        height: metrics.height,
        elements: [
          cloneElement(child, {
            x: constrainedWidth / 2,
            y: metrics.ascent,
            w: constrainedWidth,
            h: metrics.height,
            ascent: metrics.ascent,
            size: fontSize,
            math_fallback: metrics.fallback,
            normalized_value: metrics.normalizedValue,
            min_gap: CHILD_GAP_MIN,
          }),
        ],
      };
    }
    case 'image': {
      const naturalWidth = Math.max(1, readNumber(resolveValue(child.properties.w, values, traces), Math.min(maxWidth, 180)));
      const naturalHeight = Math.max(1, readNumber(resolveValue(child.properties.h, values, traces), 82));
      const width = Math.min(maxWidth, naturalWidth);
      const scale = width / naturalWidth;
      const height = naturalHeight * scale;
      return {
        width,
        height,
        elements: [cloneElement(child, { x: 0, y: 0, w: width, h: height })],
      };
    }
    case 'divider': {
      const label = getString(child, values, traces, 'label', '');
      const stroke = getString(child, values, traces, 'stroke', '#cbd5e1');
      const strokeWidth = getNumber(child, values, traces, 'strokeWidth', 1.6);
      const textSize = Math.max(CONNECTOR_LABEL_MIN, getNumber(child, values, traces, 'size', 13));
      let labelHeight = 0;
      const elements: DiagramElement[] = [];
      if (label) {
        const labelMetrics = await measureRichTextBlock(label, {
          x: maxWidth / 2,
          y: 0,
          maxWidth: maxWidth * 0.75,
          fontSize: textSize,
          weight: getString(child, values, traces, 'weight', '700'),
          anchor: 'middle',
          latex: readLatexMode(resolveValue(child.properties.latex, values, traces), 'auto'),
          maxLines: 2,
        });
        labelHeight = labelMetrics.height + 8;
        elements.push(element('text', `${child.name}-label`, {
          x: maxWidth / 2,
          y: 0,
          w: maxWidth * 0.75,
          h: labelMetrics.height,
          anchor: 'middle',
          value: label,
          size: textSize,
          weight: getString(child, values, traces, 'weight', '700'),
          color: getString(child, values, traces, 'color', '#64748b'),
          validation_ignore: true,
        }));
      }
      elements.push(element('line', `${child.name}-line`, {
        x: 0,
        y: labelHeight + strokeWidth,
        x2: maxWidth,
        y2: labelHeight + strokeWidth,
        stroke,
        strokeWidth,
        validation_ignore: true,
      }));
      return {
        width: maxWidth,
        height: labelHeight + strokeWidth * 2 + 6,
        elements,
      };
    }
    case 'spacer': {
      const height = Math.max(0, getNumber(child, values, traces, 'h', getNumber(child, values, traces, 'size', CHILD_GAP_MIN)));
      return { width: 0, height, elements: [] };
    }
    case 'group': {
      const padding = Math.max(0, getNumber(child, values, traces, 'padding', 0));
      const gap = Math.max(CHILD_GAP_MIN, getNumber(child, values, traces, 'gap', CHILD_GAP_MIN));
      const layout = readContainerOptions(child, values, traces, 'stack', gap);
      const groupWidth = Math.min(maxWidth, Math.max(80, readNumber(resolveValue(child.properties.w, values, traces), maxWidth)));
      const innerWidth = Math.max(60, groupWidth - padding * 2);
      const content = await layoutContainerChildren(child.children ?? [], innerWidth, layout, values, traces);
      const fill = getString(child, values, traces, 'fill', 'none');
      const stroke = getString(child, values, traces, 'stroke', 'none');
      const visible = fill !== 'none' || stroke !== 'none' || readBoolean(resolveValue(child.properties.show_box, values, traces), false);
      const groupHeight = Math.max(getNumber(child, values, traces, 'min_h', 0), content.height + padding * 2);
      const box = element('box', child.name, {
        x: 0,
        y: 0,
        w: groupWidth,
        h: groupHeight,
        label: '',
        fill,
        stroke,
        radius: getNumber(child, values, traces, 'radius', 12),
        shadow: false,
        strokeWidth: getNumber(child, values, traces, 'strokeWidth', 1.4),
        validation_ignore: !visible,
        min_gap: layout.gap,
        semantic_role: 'group',
      }, offsetChildren(content.elements, padding, padding));
      return {
        width: groupWidth,
        height: groupHeight,
        elements: [box],
      };
    }
    default: {
      const width = Math.min(maxWidth, readNumber(resolveValue(child.properties.w, values, traces), maxWidth));
      const height = readNumber(resolveValue(child.properties.h, values, traces), 40);
      return {
        width,
        height,
        elements: [cloneElement(child, { x: 0, y: 0, w: width, h: height })],
      };
    }
  }
}

async function compileConnector(
  connector: DiagramElement,
  cardMap: Map<string, CardLayout>,
  routingContext: ConnectorRoutingContext,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): Promise<DiagramElement[]> {
  const fromRef = parseAnchorRef(getString(connector, values, traces, 'from', ''));
  const toRef = parseAnchorRef(getString(connector, values, traces, 'to', ''));
  if (!fromRef || !toRef) return [];

  const fromCard = cardMap.get(fromRef.cardId);
  const toCard = cardMap.get(toRef.cardId);
  if (!fromCard || !toCard) return [];

  const route = getString(connector, values, traces, 'route', 'auto');
  const stroke = getString(connector, values, traces, 'stroke', '#64748b');
  const strokeWidth = getNumber(connector, values, traces, 'strokeWidth', 3);
  const dash = getString(connector, values, traces, 'dash', '');
  const label = getString(connector, values, traces, 'label', '');
  const labelDx = getNumber(connector, values, traces, 'label_dx', 0);
  const labelDy = getNumber(connector, values, traces, 'label_dy', -10);
  const labelFill = getString(connector, values, traces, 'label_fill', '#ffffff');
  const labelFillOpacity = getNumber(connector, values, traces, 'label_fill_opacity', 0.95);
  const labelPadX = Math.max(8, getNumber(connector, values, traces, 'label_padding_x', 10));
  const labelPadY = Math.max(4, getNumber(connector, values, traces, 'label_padding_y', 6));
  const path = routeConnector(fromCard, fromRef.anchor, toCard, toRef.anchor, route, [...cardMap.values()], routingContext);

  const segments: DiagramElement[] = [];
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const start = path.points[index];
    const end = path.points[index + 1];
    const type = index === path.points.length - 2 ? 'arrow' : 'line';
    segments.push(element(type, `${connector.name}-seg-${index + 1}`, {
      x: start.x,
      y: start.y,
      x2: end.x,
      y2: end.y,
      stroke,
      strokeWidth,
      dash,
      connector_id: connector.name,
      connector_from: fromCard.id,
      connector_to: toCard.id,
    }));
    routingContext.segments.push({ start, end, connectorId: connector.name });
  }

  if (label) {
    const labelSize = Math.max(CONNECTOR_LABEL_MIN, getNumber(connector, values, traces, 'size', CONNECTOR_LABEL_MIN));
    const labelMetrics = await measureRichTextBlock(label, {
      x: path.labelX,
      y: path.labelY,
      maxWidth: Math.min(280, Math.max(160, path.labelSegmentLength - 24)),
      fontSize: labelSize,
      weight: getString(connector, values, traces, 'weight', '700'),
      anchor: 'middle',
      latex: readLatexMode(resolveValue(connector.properties.latex, values, traces), 'auto'),
      maxLines: 2,
    });

    const labelPlacement = placeConnectorLabel(
      path,
      labelMetrics.width,
      labelMetrics.height,
      [...cardMap.values()],
      routingContext,
      fromCard.id,
      toCard.id,
      labelDx,
      labelDy,
      labelPadX,
      labelPadY,
    );

    if (labelPlacement) {
      segments.push(element('box', `${connector.name}-label-bg`, {
        x: labelPlacement.box.x,
        y: labelPlacement.box.y,
        w: labelPlacement.box.width,
        h: labelPlacement.box.height,
        label: '',
        fill: labelFill,
        fillOpacity: labelFillOpacity,
        stroke: 'none',
        radius: 10,
        shadow: false,
        validation_ignore: true,
      }));
      segments.push(element('text', `${connector.name}-label`, {
        x: labelPlacement.textX,
        y: labelPlacement.textY,
        w: labelPlacement.textWidth,
        h: labelMetrics.height,
        anchor: 'middle',
        value: label,
        size: labelSize,
        weight: getString(connector, values, traces, 'weight', '700'),
        color: getString(connector, values, traces, 'color', stroke),
        latex: getString(connector, values, traces, 'latex', 'auto'),
        min_gap: CHILD_GAP_MIN,
        validation_ignore: true,
      }));
      routingContext.labels.push(labelPlacement.box);
    }
  }

  return segments;
}

function estimateConnectorPriority(
  connector: DiagramElement,
  cardMap: Map<string, CardLayout>,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
): number {
  const fromRef = parseAnchorRef(getString(connector, values, traces, 'from', ''));
  const toRef = parseAnchorRef(getString(connector, values, traces, 'to', ''));
  if (!fromRef || !toRef) return 0;

  const fromCard = cardMap.get(fromRef.cardId);
  const toCard = cardMap.get(toRef.cardId);
  if (!fromCard || !toCard) return 0;

  const span = Math.abs((fromCard.x + fromCard.width / 2) - (toCard.x + toCard.width / 2))
    + Math.abs((fromCard.y + fromCard.height / 2) - (toCard.y + toCard.height / 2));
  const lanePenalty = fromCard.laneId === toCard.laneId ? 0 : 280;
  const labelPenalty = getString(connector, values, traces, 'label', '') ? 120 : 0;
  const autoBonus = getString(connector, values, traces, 'route', 'auto') === 'auto' ? 40 : 0;
  return span + lanePenalty + labelPenalty + autoBonus;
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function placeConnectorLabel(
  path: ConnectorPath,
  labelWidth: number,
  labelHeight: number,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
  fromId: string,
  toId: string,
  labelDx: number,
  labelDy: number,
  padX: number,
  padY: number,
): { box: BoxArea; textX: number; textY: number; textWidth: number } | null {
  if (labelWidth <= 0 || labelHeight <= 0) return null;

  const horizontal = path.labelSegmentStart.y === path.labelSegmentEnd.y;
  const segmentLength = horizontal
    ? Math.abs(path.labelSegmentEnd.x - path.labelSegmentStart.x)
    : Math.abs(path.labelSegmentEnd.y - path.labelSegmentStart.y);
  const requiredLength = horizontal ? labelWidth + 24 : labelHeight + 20;
  if (segmentLength + 0.1 < requiredLength) return null;

  const boxWidth = labelWidth + padX * 2;
  const boxHeight = labelHeight + padY * 2;
  const segmentCenter = boxCenter({
    x: Math.min(path.labelSegmentStart.x, path.labelSegmentEnd.x),
    y: Math.min(path.labelSegmentStart.y, path.labelSegmentEnd.y),
    width: Math.abs(path.labelSegmentEnd.x - path.labelSegmentStart.x),
    height: Math.abs(path.labelSegmentEnd.y - path.labelSegmentStart.y),
  });
  const gap = 12;

  const candidates = horizontal
    ? [
        { x: segmentCenter.x - boxWidth / 2, y: path.labelSegmentStart.y - boxHeight - gap },
        { x: segmentCenter.x - boxWidth / 2, y: path.labelSegmentStart.y + gap },
        { x: Math.min(path.labelSegmentStart.x, path.labelSegmentEnd.x) + 8, y: path.labelSegmentStart.y - boxHeight - gap },
        { x: Math.max(path.labelSegmentStart.x, path.labelSegmentEnd.x) - boxWidth - 8, y: path.labelSegmentStart.y + gap },
      ]
    : [
        { x: path.labelSegmentStart.x - boxWidth - gap, y: segmentCenter.y - boxHeight / 2 },
        { x: path.labelSegmentStart.x + gap, y: segmentCenter.y - boxHeight / 2 },
        { x: path.labelSegmentStart.x - boxWidth - gap, y: Math.min(path.labelSegmentStart.y, path.labelSegmentEnd.y) + 8 },
        { x: path.labelSegmentStart.x + gap, y: Math.max(path.labelSegmentStart.y, path.labelSegmentEnd.y) - boxHeight - 8 },
      ];

  let best: { box: BoxArea; score: number } | null = null;
  const currentSegments = pathSegments(path.points, '__current__');

  for (const candidate of candidates) {
    const box: BoxArea = {
      x: candidate.x + labelDx,
      y: candidate.y + labelDy,
      width: boxWidth,
      height: boxHeight,
    };

    let score = Math.abs(candidate.x - (horizontal ? segmentCenter.x - boxWidth / 2 : path.labelSegmentStart.x))
      + Math.abs(candidate.y - (horizontal ? path.labelSegmentStart.y - boxHeight - gap : segmentCenter.y - boxHeight / 2));

    for (const card of cards) {
      if (card.id === fromId || card.id === toId) continue;
      if (boxesOverlap(expandBox(box, 6), { x: card.x, y: card.y, width: card.width, height: card.height })) {
        score += 100000;
      }
    }

    for (const placed of routingContext.labels) {
      if (boxesOverlap(expandBox(box, 4), expandBox(placed, 4))) score += 80000;
    }

    for (const segment of [...routingContext.segments, ...currentSegments]) {
      if (segmentHitsBox(segment.start, segment.end, box, 4)) score += 25000;
    }

    if (!best || score < best.score) best = { box, score };
  }

  if (!best || best.score >= 100000) return null;

  return {
    box: best.box,
    textX: best.box.x + best.box.width / 2,
    textY: best.box.y + padY,
    textWidth: Math.max(1, best.box.width - padX * 2),
  };
}

function routeConnector(
  fromCard: CardLayout,
  fromAnchor: string,
  toCard: CardLayout,
  toAnchor: string,
  route: string,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
): ConnectorPath {
  const offset = 28;
  const fromPoint = anchorPoint(fromCard, fromAnchor);
  const toPoint = anchorPoint(toCard, toAnchor);
  const fromOut = nudgePoint(fromPoint, fromAnchor, offset);
  const toOut = nudgePoint(toPoint, toAnchor, offset);

  const candidateRoutes = uniqueRoutes(route === 'auto'
    ? ['auto', 'hvh', 'vhv', 'hv', 'vh']
    : [route, 'hvh', 'vhv', 'hv', 'vh', 'auto']);

  let best: { points: { x: number; y: number }[]; score: number } | null = null;
  for (const candidate of candidateRoutes) {
    const pathCandidates = buildConnectorCandidatePaths(
      candidate,
      fromCard,
      fromAnchor,
      toCard,
      toAnchor,
      fromPoint,
      fromOut,
      toPoint,
      toOut,
      cards,
      routingContext,
    );
    for (const pathCandidate of pathCandidates) {
      const points = simplifyPoints(pathCandidate);
      const score = scoreConnectorPath(points, cards, fromCard.id, toCard.id, routingContext);
      if (!best || score < best.score) {
        best = { points, score };
      }
      if (score === 0) break;
    }
    if (best?.score === 0) break;
  }

  const points = spreadConnectorPath(best?.points ?? [fromPoint, fromOut, toOut, toPoint], routingContext);
  let labelX = (fromPoint.x + toPoint.x) / 2;
  let labelY = (fromPoint.y + toPoint.y) / 2;
  let labelSegmentLength = 0;
  let labelSegmentStart = points[0];
  let labelSegmentEnd = points[points.length - 1];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (segmentLength > labelSegmentLength) {
      labelSegmentLength = segmentLength;
      labelX = (start.x + end.x) / 2;
      labelY = (start.y + end.y) / 2;
      labelSegmentStart = start;
      labelSegmentEnd = end;
    }
  }

  return { points, labelX, labelY, labelSegmentLength, labelSegmentStart, labelSegmentEnd };
}

function buildConnectorCandidatePaths(
  route: string,
  fromCard: CardLayout,
  fromAnchor: string,
  toCard: CardLayout,
  toAnchor: string,
  fromPoint: { x: number; y: number },
  fromOut: { x: number; y: number },
  toPoint: { x: number; y: number },
  toOut: { x: number; y: number },
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
): { x: number; y: number }[][] {
  switch (route) {
    case 'hv':
      return [[fromPoint, fromOut, { x: toOut.x, y: fromOut.y }, toOut, toPoint]];
    case 'vh':
      return [[fromPoint, fromOut, { x: fromOut.x, y: toOut.y }, toOut, toPoint]];
    case 'vhv':
      return chooseMidYCandidates(fromCard, toCard, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
        .map((midY) => [fromPoint, fromOut, { x: fromOut.x, y: midY }, { x: toOut.x, y: midY }, toOut, toPoint]);
    case 'hvh':
      return chooseMidXCandidates(fromCard, toCard, fromOut.x, toOut.x, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
        .map((midX) => [fromPoint, fromOut, { x: midX, y: fromOut.y }, { x: midX, y: toOut.y }, toOut, toPoint]);
    default:
      if (isHorizontalAnchor(fromAnchor) && isHorizontalAnchor(toAnchor)) {
        return chooseMidXCandidates(fromCard, toCard, fromOut.x, toOut.x, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
          .map((midX) => [fromPoint, fromOut, { x: midX, y: fromOut.y }, { x: midX, y: toOut.y }, toOut, toPoint]);
      }
      if (!isHorizontalAnchor(fromAnchor) && !isHorizontalAnchor(toAnchor)) {
        return chooseMidYCandidates(fromCard, toCard, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
          .map((midY) => [fromPoint, fromOut, { x: fromOut.x, y: midY }, { x: toOut.x, y: midY }, toOut, toPoint]);
      }
      if (isHorizontalAnchor(fromAnchor)) {
        return [
          [fromPoint, fromOut, { x: toOut.x, y: fromOut.y }, toOut, toPoint],
          ...chooseMidXCandidates(fromCard, toCard, fromOut.x, toOut.x, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
            .map((midX) => [fromPoint, fromOut, { x: midX, y: fromOut.y }, { x: midX, y: toOut.y }, toOut, toPoint]),
        ];
      }
      return [
        [fromPoint, fromOut, { x: fromOut.x, y: toOut.y }, toOut, toPoint],
        ...chooseMidYCandidates(fromCard, toCard, fromOut.y, toOut.y, fromAnchor, toAnchor, cards, routingContext)
          .map((midY) => [fromPoint, fromOut, { x: fromOut.x, y: midY }, { x: toOut.x, y: midY }, toOut, toPoint]),
      ];
  }
}

function chooseMidXCandidates(
  fromCard: CardLayout,
  toCard: CardLayout,
  fromX: number,
  toX: number,
  fromY: number,
  toY: number,
  fromAnchor: string,
  toAnchor: string,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
): number[] {
  const preferred = chooseFreeCorridor(
    baseMidX(fromX, toX, fromAnchor, toAnchor),
    Math.min(fromX, toX),
    Math.max(fromX, toX),
    buildBlockedIntervalsX(fromCard, toCard, fromY, toY, cards),
  );
  return corridorCandidates(
    preferred,
    Math.min(fromX, toX),
    Math.max(fromX, toX),
    buildBlockedIntervalsX(fromCard, toCard, fromY, toY, cards),
    routingContext.segments
      .filter((segment) => segment.start.x === segment.end.x && overlaps(Math.min(segment.start.y, segment.end.y), Math.max(segment.start.y, segment.end.y), Math.min(fromY, toY), Math.max(fromY, toY)))
      .map((segment) => segment.start.x),
  );
}

function chooseMidYCandidates(
  fromCard: CardLayout,
  toCard: CardLayout,
  fromY: number,
  toY: number,
  fromAnchor: string,
  toAnchor: string,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
): number[] {
  const preferred = chooseFreeCorridor(
    baseMidY(fromY, toY, fromAnchor, toAnchor),
    Math.min(fromY, toY),
    Math.max(fromY, toY),
    buildBlockedIntervalsY(fromCard, toCard, cards),
  );
  return corridorCandidates(
    preferred,
    Math.min(fromY, toY),
    Math.max(fromY, toY),
    buildBlockedIntervalsY(fromCard, toCard, cards),
    routingContext.segments
      .filter((segment) => segment.start.y === segment.end.y && overlaps(Math.min(segment.start.x, segment.end.x), Math.max(segment.start.x, segment.end.x), Math.min(fromCard.x, toCard.x), Math.max(fromCard.x + fromCard.width, toCard.x + toCard.width)))
      .map((segment) => segment.start.y),
  );
}

function buildBlockedIntervalsX(
  fromCard: CardLayout,
  toCard: CardLayout,
  fromY: number,
  toY: number,
  cards: CardLayout[],
): Array<[number, number]> {
  return cards
    .filter((card) => card.id !== fromCard.id && card.id !== toCard.id)
    .filter((card) => overlaps(card.y - 24, card.y + card.height + 24, Math.min(fromY, toY), Math.max(fromY, toY)))
    .map((card) => [card.x - 24, card.x + card.width + 24] as [number, number]);
}

function buildBlockedIntervalsY(
  fromCard: CardLayout,
  toCard: CardLayout,
  cards: CardLayout[],
): Array<[number, number]> {
  return cards
    .filter((card) => card.id !== fromCard.id && card.id !== toCard.id)
    .filter((card) => overlaps(card.x - 24, card.x + card.width + 24, Math.min(fromCard.x, toCard.x), Math.max(fromCard.x + fromCard.width, toCard.x + toCard.width)))
    .map((card) => [card.y - 24, card.y + card.height + 24] as [number, number]);
}

function corridorCandidates(
  preferred: number,
  start: number,
  end: number,
  blocked: Array<[number, number]>,
  occupiedCorridors: number[],
): number[] {
  const lower = Math.min(start, end) - 24;
  const upper = Math.max(start, end) + 24;
  const merged = mergeIntervals(blocked, lower, upper);
  const gaps: Array<[number, number]> = [];
  let cursor = lower;
  for (const [blockStart, blockEnd] of merged) {
    if (blockStart > cursor) gaps.push([cursor, blockStart]);
    cursor = Math.max(cursor, blockEnd);
  }
  if (cursor < upper) gaps.push([cursor, upper]);

  const values = new Set<number>([
    preferred,
    lower - 72,
    lower - 40,
    upper + 40,
    upper + 72,
    preferred - 56,
    preferred + 56,
    preferred - 92,
    preferred + 92,
  ]);

  for (const [gapStart, gapEnd] of gaps) {
    const width = gapEnd - gapStart;
    if (width <= 0) continue;
    values.add((gapStart + gapEnd) / 2);
    if (width >= 24) {
      values.add(gapStart + 18);
      values.add(gapEnd - 18);
    }
    if (width >= 80) {
      values.add(gapStart + width / 3);
      values.add(gapEnd - width / 3);
    }
  }

  for (const occupied of occupiedCorridors) {
    values.add(occupied - 34);
    values.add(occupied + 34);
    values.add(occupied - 58);
    values.add(occupied + 58);
  }

  return [...values]
    .map((value) => clampConnectorCorridor(value, lower - 120, upper + 120))
    .filter((value, index, array) => array.findIndex((candidate) => Math.abs(candidate - value) < 1) === index)
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
}

function clampConnectorCorridor(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function baseMidX(fromX: number, toX: number, fromAnchor: string, toAnchor: string): number {
  if (fromAnchor === 'right' && toAnchor === 'left' && toX <= fromX) return Math.max(fromX, toX) + 48;
  if (fromAnchor === 'left' && toAnchor === 'right' && toX >= fromX) return Math.min(fromX, toX) - 48;
  return (fromX + toX) / 2;
}

function baseMidY(fromY: number, toY: number, fromAnchor: string, toAnchor: string): number {
  if (fromAnchor === 'bottom' && toAnchor === 'top' && toY <= fromY) return Math.max(fromY, toY) + 42;
  if (fromAnchor === 'top' && toAnchor === 'bottom' && toY >= fromY) return Math.min(fromY, toY) - 42;
  return (fromY + toY) / 2;
}

function chooseFreeCorridor(
  preferred: number,
  start: number,
  end: number,
  blocked: Array<[number, number]>,
): number {
  if (!blocked.length) return preferred;

  const lower = Math.min(start, end) - 24;
  const upper = Math.max(start, end) + 24;
  const merged = mergeIntervals(blocked, lower, upper);
  const gaps: Array<[number, number]> = [];
  let cursor = lower;
  for (const [blockStart, blockEnd] of merged) {
    if (blockStart > cursor) gaps.push([cursor, blockStart]);
    cursor = Math.max(cursor, blockEnd);
  }
  if (cursor < upper) gaps.push([cursor, upper]);
  if (!gaps.length) return preferred;

  const viable = gaps.filter(([gapStart, gapEnd]) => gapEnd - gapStart >= 18);
  const candidates = viable.length ? viable : gaps;
  const containing = candidates.find(([gapStart, gapEnd]) => preferred >= gapStart && preferred <= gapEnd);
  if (containing) return preferred;

  return candidates
    .map(([gapStart, gapEnd]) => ({ center: (gapStart + gapEnd) / 2, width: gapEnd - gapStart }))
    .sort((a, b) => Math.abs(a.center - preferred) - Math.abs(b.center - preferred) || b.width - a.width)[0].center;
}

function mergeIntervals(
  intervals: Array<[number, number]>,
  minValue: number,
  maxValue: number,
): Array<[number, number]> {
  const sorted = intervals
    .map(([start, end]) => [Math.max(minValue, start), Math.min(maxValue, end)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1]) {
      merged.push([...interval] as [number, number]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }
  return merged;
}

function uniqueRoutes(routes: string[]): string[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route)) return false;
    seen.add(route);
    return true;
  });
}

function scoreConnectorPath(
  points: { x: number; y: number }[],
  cards: CardLayout[],
  fromId: string,
  toId: string,
  routingContext: ConnectorRoutingContext,
): number {
  let intersections = 0;
  let length = 0;
  let connectorPenalty = 0;
  let labelPenalty = 0;
  let clearancePenalty = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    length += Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    for (const card of cards) {
      if (card.id === fromId || card.id === toId) continue;
      if (segmentHitsCard(start, end, card)) {
        intersections += 1;
      } else {
        clearancePenalty += connectorClearancePenalty(start, end, card);
      }
    }
    for (const segment of routingContext.segments) {
      connectorPenalty += scoreSegmentInteraction(start, end, segment.start, segment.end);
    }
    for (const label of routingContext.labels) {
      if (segmentHitsBox(start, end, label, 6)) labelPenalty += 1;
    }
  }

  return intersections * 100000 + labelPenalty * 40000 + connectorPenalty + clearancePenalty + length + Math.max(0, points.length - 2) * 18;
}

function segmentHitsCard(
  start: { x: number; y: number },
  end: { x: number; y: number },
  card: CardLayout,
): boolean {
  const left = card.x + 2;
  const right = card.x + card.width - 2;
  const top = card.y + 2;
  const bottom = card.y + card.height - 2;
  if (start.y === end.y) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return start.y > top && start.y < bottom && maxX > left && minX < right;
  }
  if (start.x === end.x) {
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return start.x > left && start.x < right && maxY > top && minY < bottom;
  }
  return false;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0;
}

function spreadConnectorPath(
  points: { x: number; y: number }[],
  routingContext: ConnectorRoutingContext,
): { x: number; y: number }[] {
  if (points.length < 5 || !routingContext.segments.length) return points;

  const adjusted = points.map((point) => ({ ...point }));
  const minimumSpacing = 32;

  for (let index = 1; index < adjusted.length - 2; index += 1) {
    const start = adjusted[index];
    const end = adjusted[index + 1];
    if (start.x !== end.x && start.y !== end.y) continue;

    let requiredShift = 0;
    for (const existing of routingContext.segments) {
      if (start.x === end.x && existing.start.x === existing.end.x) {
        const delta = Math.abs(start.x - existing.start.x);
        const overlapLength = rangeOverlapLength(start.y, end.y, existing.start.y, existing.end.y);
        if (delta < minimumSpacing && overlapLength > 0) {
          requiredShift = Math.max(requiredShift, minimumSpacing - delta + 6);
        }
      }
      if (start.y === end.y && existing.start.y === existing.end.y) {
        const delta = Math.abs(start.y - existing.start.y);
        const overlapLength = rangeOverlapLength(start.x, end.x, existing.start.x, existing.end.x);
        if (delta < minimumSpacing && overlapLength > 0) {
          requiredShift = Math.max(requiredShift, minimumSpacing - delta + 6);
        }
      }
    }

    if (requiredShift <= 0) continue;

    if (start.x === end.x) {
      const before = adjusted[index - 1];
      const after = adjusted[index + 2];
      const center = (before.x + after.x) / 2;
      const direction = start.x <= center ? -1 : 1;
      adjusted[index] = { x: adjusted[index].x + direction * requiredShift, y: adjusted[index].y };
      adjusted[index + 1] = { x: adjusted[index + 1].x + direction * requiredShift, y: adjusted[index + 1].y };
    } else {
      const before = adjusted[index - 1];
      const after = adjusted[index + 2];
      const center = (before.y + after.y) / 2;
      const direction = start.y <= center ? -1 : 1;
      adjusted[index] = { x: adjusted[index].x, y: adjusted[index].y + direction * requiredShift };
      adjusted[index + 1] = { x: adjusted[index + 1].x, y: adjusted[index + 1].y + direction * requiredShift };
    }
  }

  return simplifyPoints(adjusted);
}

function segmentHitsBox(
  start: { x: number; y: number },
  end: { x: number; y: number },
  box: BoxArea,
  padding = 0,
): boolean {
  const expanded = expandBox(box, padding);
  if (start.y === end.y) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return start.y >= expanded.y && start.y <= expanded.y + expanded.height && maxX >= expanded.x && minX <= expanded.x + expanded.width;
  }
  if (start.x === end.x) {
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return start.x >= expanded.x && start.x <= expanded.x + expanded.width && maxY >= expanded.y && minY <= expanded.y + expanded.height;
  }
  return false;
}

function expandBox(box: BoxArea, padding: number): BoxArea {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

function connectorClearancePenalty(
  start: { x: number; y: number },
  end: { x: number; y: number },
  card: CardLayout,
): number {
  const padded = { x: card.x - 10, y: card.y - 10, width: card.width + 20, height: card.height + 20 };
  return segmentHitsBox(start, end, padded, 0) ? 900 : 0;
}

function scoreSegmentInteraction(
  startA: { x: number; y: number },
  endA: { x: number; y: number },
  startB: { x: number; y: number },
  endB: { x: number; y: number },
): number {
  if (startA.x === endA.x && startB.x === endB.x) {
    const delta = Math.abs(startA.x - startB.x);
    const overlapLength = rangeOverlapLength(startA.y, endA.y, startB.y, endB.y);
    if (delta < 1 && overlapLength > 0) return 90000 + overlapLength * 18;
    if (delta < 24 && overlapLength > 0) return 22000 + Math.round((24 - delta) * overlapLength * 1.5);
    return 0;
  }

  if (startA.y === endA.y && startB.y === endB.y) {
    const delta = Math.abs(startA.y - startB.y);
    const overlapLength = rangeOverlapLength(startA.x, endA.x, startB.x, endB.x);
    if (delta < 1 && overlapLength > 0) return 90000 + overlapLength * 18;
    if (delta < 24 && overlapLength > 0) return 22000 + Math.round((24 - delta) * overlapLength * 1.5);
    return 0;
  }

  if (segmentsCrossOrthogonally(startA, endA, startB, endB)) return 6000;
  return 0;
}

function segmentsCrossOrthogonally(
  startA: { x: number; y: number },
  endA: { x: number; y: number },
  startB: { x: number; y: number },
  endB: { x: number; y: number },
): boolean {
  if (startA.y === endA.y && startB.x === endB.x) {
    return betweenInclusive(startB.x, startA.x, endA.x) && betweenInclusive(startA.y, startB.y, endB.y);
  }
  if (startA.x === endA.x && startB.y === endB.y) {
    return betweenInclusive(startA.x, startB.x, endB.x) && betweenInclusive(startB.y, startA.y, endA.y);
  }
  return false;
}

function rangeOverlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)));
}

function betweenInclusive(value: number, start: number, end: number): boolean {
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

function boxCenter(box: BoxArea): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function pathSegments(points: { x: number; y: number }[], connectorId: string): ConnectorSegmentObstacle[] {
  const segments: ConnectorSegmentObstacle[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({ start: points[index], end: points[index + 1], connectorId });
  }
  return segments;
}

function simplifyPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const deduped = points.filter((point, index) =>
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  );
  if (deduped.length <= 2) return deduped;
  const simplified = [deduped[0]];
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const prev = simplified[simplified.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];
    const isCollinear = (prev.x === current.x && current.x === next.x) || (prev.y === current.y && current.y === next.y);
    if (!isCollinear) simplified.push(current);
  }
  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

function anchorPoint(card: CardLayout, anchor: string): { x: number; y: number } {
  switch (anchor) {
    case 'top':
      return { x: card.x + card.width / 2, y: card.y };
    case 'bottom':
      return { x: card.x + card.width / 2, y: card.y + card.height };
    case 'left':
      return { x: card.x, y: card.y + card.height / 2 };
    case 'right':
    default:
      return { x: card.x + card.width, y: card.y + card.height / 2 };
  }
}

function nudgePoint(point: { x: number; y: number }, anchor: string, distance: number): { x: number; y: number } {
  switch (anchor) {
    case 'top':
      return { x: point.x, y: point.y - distance };
    case 'bottom':
      return { x: point.x, y: point.y + distance };
    case 'left':
      return { x: point.x - distance, y: point.y };
    case 'right':
    default:
      return { x: point.x + distance, y: point.y };
  }
}

function isHorizontalAnchor(anchor: string): boolean {
  return anchor === 'left' || anchor === 'right';
}

function parseAnchorRef(value: string): { cardId: string; anchor: string } | null {
  if (!value) return null;
  const [cardId, anchor = 'right'] = value.split('.');
  if (!cardId) return null;
  return { cardId, anchor };
}

function readContainerOptions(
  elementToRead: DiagramElement,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fallbackLayout: 'stack' | 'row' | 'columns',
  fallbackGap: number,
): ContainerOptions {
  const rawLayout = getString(elementToRead, values, traces, 'layout', fallbackLayout);
  const layout = rawLayout === 'row' || rawLayout === 'columns' ? rawLayout : 'stack';
  const align = getString(elementToRead, values, traces, 'align', layout === 'row' ? 'center' : 'center');
  return {
    layout,
    gap: Math.max(CHILD_GAP_MIN, getNumber(elementToRead, values, traces, 'gap', fallbackGap)),
    padding: Math.max(0, getNumber(elementToRead, values, traces, 'padding', 0)),
    columns: Math.max(1, getNumber(elementToRead, values, traces, 'columns', 2)),
    align: align === 'start' || align === 'end' || align === 'stretch' ? align : 'center',
  };
}

function resolveAlignedX(align: string, containerWidth: number, childWidth: number): number {
  if (align === 'start') return 0;
  if (align === 'end') return Math.max(0, containerWidth - childWidth);
  if (align === 'stretch') return 0;
  return Math.max(0, (containerWidth - childWidth) / 2);
}

function alignToAnchor(align: string): 'start' | 'middle' | 'end' {
  if (align === 'start') return 'start';
  if (align === 'end') return 'end';
  return 'middle';
}

function offsetChildren(children: DiagramElement[], dx: number, dy: number): DiagramElement[] {
  return children.map((child) => offsetElement(child, dx, dy));
}

function offsetElement(elementToOffset: DiagramElement, dx: number, dy: number): DiagramElement {
  return cloneElement(elementToOffset, {
    x: getLiteralNumber(elementToOffset.properties.x) + dx,
    y: getLiteralNumber(elementToOffset.properties.y) + dy,
  });
}

function getLiteralNumber(exprValue?: Expression): number {
  if (!exprValue) return 0;
  if (exprValue.type === 'Literal' && typeof exprValue.value === 'number') return exprValue.value;
  return 0;
}

function cloneElement(elementToClone: DiagramElement, additions: Record<string, string | number | boolean>): DiagramElement {
  return {
    ...elementToClone,
    properties: {
      ...elementToClone.properties,
      ...Object.fromEntries(Object.entries(additions).map(([key, value]) => [key, expr(value)])),
    },
  };
}

function element(type: string, name: string, props: Record<string, string | number | boolean>, children?: DiagramElement[]): DiagramElement {
  return {
    type,
    name,
    properties: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, expr(value)])),
    ...(children?.length ? { children } : {}),
  };
}

function expr(value: string | number | boolean): Expression {
  return { type: 'Literal', value, location: ZERO_LOC };
}

function getString(elementToRead: DiagramElement, values: Record<string, GSValue>, traces: Map<string, Trace>, key: string, fallback = ''): string {
  return readString(resolveValue(elementToRead.properties[key], values, traces), fallback);
}

function getNumber(elementToRead: DiagramElement, values: Record<string, GSValue>, traces: Map<string, Trace>, key: string, fallback = 0): number {
  return readNumber(resolveValue(elementToRead.properties[key], values, traces), fallback);
}

export function isSemanticDiagramElement(element: DiagramElement): boolean {
  return SEMANTIC_TYPES.has(element.type) || CONTAINER_TYPES.has(element.type);
}
