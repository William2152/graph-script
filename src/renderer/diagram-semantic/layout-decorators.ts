import { CardLayout, LaneSpec } from './types';

/**
 * Compacts lane frame widths based on measured card occupancy.
 */
export function compactLaneFrames(
  lanes: LaneSpec[],
  cards: CardLayout[],
  contentX: number,
  contentWidth: number,
  laneGap: number,
): LaneSpec[] {
  if (lanes.length <= 1 && !cards.length) return lanes;

  const requiredWidths = new Map<string, number>();
  for (const lane of lanes) {
    const laneCards = cards.filter((card) => card.laneId === lane.id);
    const columnWidths = Array.from({ length: lane.columns }, () => 0);
    let required = Math.max(180, lane.padding * 2 + 120);

    for (const card of laneCards) {
      if (card.span === 1) {
        const colIndex = Math.max(0, Math.min(lane.columns - 1, card.col - 1));
        columnWidths[colIndex] = Math.max(columnWidths[colIndex], card.width);
      }
      required = Math.max(required, card.width + lane.padding * 2);
    }

    const columnPackedWidth = columnWidths.reduce((sum, value) => sum + value, 0)
      + Math.max(0, lane.columns - 1) * lane.gapX
      + lane.padding * 2;
    requiredWidths.set(lane.id, Math.max(required, columnPackedWidth));
  }

  const packedWidth = lanes.reduce((sum, lane) => sum + (requiredWidths.get(lane.id) ?? lane.frame.w), 0)
    + Math.max(0, lanes.length - 1) * laneGap;
  if (packedWidth >= contentWidth - 8) return lanes;

  let cursorX = contentX + Math.max(0, (contentWidth - packedWidth) / 2);
  return lanes.map((lane) => {
    const frameWidth = requiredWidths.get(lane.id) ?? lane.frame.w;
    const nextLane: LaneSpec = {
      ...lane,
      frame: {
        ...lane.frame,
        x: cursorX,
        w: frameWidth,
      },
    };
    cursorX += frameWidth + laneGap;
    return nextLane;
  });
}
