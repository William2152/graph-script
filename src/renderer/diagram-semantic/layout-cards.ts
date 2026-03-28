/**
 * Measures and positions cards inside lane grids, including row/column spans
 * and nested child content layout.
 */
import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { resolveValue } from '../common';
import { measureRichTextBlock, readLatexMode } from '../latex';
import {
  BODY_TEXT_MIN,
  CARD_TITLE_MIN,
  CHILD_GAP_MIN,
  CardLayout,
  CardMeasurement,
  LaneSpec,
} from './types';
import {
  clamp,
  computeColumnWidths,
  element,
  getColumnX,
  getNumber,
  getSlotWidth,
  getString,
  offsetChildren,
  readContainerOptions,
} from './helpers';
import { layoutContainerChildren } from './layout-container';

export async function layoutCards(
  cardElements: DiagramElement[],
  lanes: LaneSpec[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number = 1,
  fillImages: boolean = false,
  fontScale: number = 1,
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
    const innerW = Math.max(200, lane.frame.w - lane.padding * 2);
    const columnWidths = computeColumnWidths(lane, innerW);

    const measured: Array<{
      card: DiagramElement;
      row: number;
      col: number;
      span: number;
      rowSpan: number;
      width: number;
      height: number;
      children: DiagramElement[];
    }> = [];
    const rowHeights = new Map<number, number>();
    let maxRow = 1;
    for (const card of laneCards) {
      const row = Math.max(1, getNumber(card, values, traces, 'row', 1));
      const col = Math.max(1, getNumber(card, values, traces, 'col', 1));
      const span = Math.max(1, Math.min(lane.columns - col + 1, getNumber(card, values, traces, 'span', 1)));
      const rowSpan = Math.max(1, getNumber(card, values, traces, 'row_span', 1));
      maxRow = Math.max(maxRow, row + rowSpan - 1);
      const slotWidth = getSlotWidth(columnWidths, lane.gapX, col - 1, span);
      const hasExplicitWidth = card.properties.w != null;
      const preferredWidth = getNumber(card, values, traces, 'w', slotWidth);
      const minWidth = getNumber(card, values, traces, 'min_w', 0);
      const boundedMinWidth = minWidth > 0 ? Math.min(slotWidth, minWidth) : 0;
      const initialWidth = Math.max(boundedMinWidth, Math.min(slotWidth, preferredWidth));
      let measurement = await measureCard(card, initialWidth, values, traces, fontFamily, imageScale, fillImages, fontScale);
      let width = initialWidth;
      if (!hasExplicitWidth) {
        const compactWidth = clamp(measurement.width, boundedMinWidth || 0, slotWidth);
        if (Math.abs(compactWidth - width) > 10) {
          width = compactWidth;
          measurement = await measureCard(card, width, values, traces, fontFamily, imageScale, fillImages, fontScale);
        } else {
          width = compactWidth;
        }
      }
      measured.push({ card, row, col, span, rowSpan, width, height: measurement.height, children: measurement.children });
      if (rowSpan === 1) rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, measurement.height));
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
    let laneCursorY = lane.frame.y + 10;
    for (let row = 1; row <= maxRow; row += 1) {
      rowY.set(row, laneCursorY);
      laneCursorY += (rowHeights.get(row) ?? 0) + lane.gapY;
    }

    for (const entry of measured) {
      const slotWidth = getSlotWidth(columnWidths, lane.gapX, entry.col - 1, entry.span);
      const x = innerX + getColumnX(columnWidths, lane.gapX, entry.col - 1) + Math.max(0, (slotWidth - entry.width) / 2);
      const y = rowY.get(entry.row) ?? lane.frame.y;
      const reservedHeight = spanHeight(rowHeights, entry.row, entry.rowSpan, lane.gapY);
      const height = entry.rowSpan > 1 ? Math.max(entry.height, reservedHeight) : entry.height;
      const compiled = compileMeasuredCard(entry.card, x, y, entry.width, height, entry.children, values, traces, fontFamily);
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
  for (let current = row; current < row + rowSpan; current += 1) total += rowHeights.get(current) ?? 0;
  if (rowSpan > 1) total += gapY * (rowSpan - 1);
  return total;
}

async function measureCard(
  card: DiagramElement,
  width: number,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily: string,
  imageScale: number = 1,
  fillImages: boolean = false,
  fontScale: number = 1,
): Promise<CardMeasurement> {
  const padding = Math.max(20, getNumber(card, values, traces, 'padding', 24));
  const gap = Math.max(CHILD_GAP_MIN, getNumber(card, values, traces, 'gap', 18));
  const label = getString(card, values, traces, 'label', card.name);
  const subtitle = getString(card, values, traces, 'subtitle', '');
  const titleSize = Math.max(CARD_TITLE_MIN, getNumber(card, values, traces, 'size', CARD_TITLE_MIN)) * fontScale;
  const subtitleSize = Math.max(BODY_TEXT_MIN, getNumber(card, values, traces, 'subtitle_size', BODY_TEXT_MIN)) * fontScale;
  const latexMode = readLatexMode(resolveValue(card.properties.latex, values, traces), 'auto');

  const titleBlock = label
    ? await measureRichTextBlock(label, {
        x: width / 2,
        y: 0,
        maxWidth: width - 32,
        fontSize: titleSize,
        weight: '800',
        anchor: 'middle',
        latex: latexMode,
        maxLines: 3,
        fontFamily,
      })
    : { width: 0, height: 0 };

  const subtitleBlock = subtitle
    ? await measureRichTextBlock(subtitle, {
        x: width / 2,
        y: 0,
        maxWidth: width - 36,
        fontSize: subtitleSize,
        weight: '500',
        anchor: 'middle',
        latex: latexMode,
        maxLines: 4,
        fontFamily,
      })
    : { width: 0, height: 0 };

  const headerTop = 18;
  const titleBottomGap = titleBlock.height ? 12 : 0;
  const subtitleGap = subtitleBlock.height ? 8 : 0;
  const headerHeight = titleBlock.height || subtitleBlock.height
    ? Math.max(58, headerTop + titleBlock.height + (subtitleBlock.height ? titleBottomGap + titleBlock.height + subtitleGap : 0) + 12)
    : 28;

  const innerWidth = Math.max(140, width - padding * 2);
  const containerOptions = readContainerOptions(card, values, traces, 'stack', gap);
  const content = await layoutContainerChildren(card.children ?? [], innerWidth, containerOptions, values, traces, fontFamily, imageScale, fillImages, fontScale);
  const bodyTop = headerHeight + padding;
  const fallbackHeight = headerHeight + padding * 2 + (content.elements.length ? content.height : 52);
  const minHeight = getNumber(card, values, traces, 'min_h', 0);
  const compactWidth = clamp(Math.max(
    titleBlock.width ? titleBlock.width + 48 : 0,
    subtitleBlock.width ? subtitleBlock.width + 52 : 0,
    content.width ? content.width + padding * 2 : 0,
    getNumber(card, values, traces, 'compact_min_w', 220),
  ), getNumber(card, values, traces, 'min_w', 0) || 0, width);

  return {
    width: compactWidth,
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
  fontFamily: string,
): DiagramElement {
  const titleSize = Math.max(CARD_TITLE_MIN, getNumber(card, values, traces, 'size', CARD_TITLE_MIN));
  const subtitleSize = Math.max(BODY_TEXT_MIN, getNumber(card, values, traces, 'subtitle_size', BODY_TEXT_MIN));
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
    size: titleSize,
    title_size: titleSize,
    subtitle_size: subtitleSize,
    latex: getString(card, values, traces, 'latex', 'auto'),
    font_family: fontFamily,
    min_gap: Math.max(CHILD_GAP_MIN, getNumber(card, values, traces, 'gap', CHILD_GAP_MIN)),
    semantic_role: 'card',
    semantic_label_role: 'card_title',
    semantic_subtitle_role: 'body_text',
  }, children);
}
