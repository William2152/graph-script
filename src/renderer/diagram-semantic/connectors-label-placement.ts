/**
 * Places connector labels while avoiding card boxes, existing labels,
 * and routed connector segments.
 */
import {
  BoxArea,
  CardLayout,
  ConnectorPath,
  ConnectorRoutingContext,
  ConnectorSegmentObstacle,
} from './types';
import {
  CONNECTOR_LABEL_LABEL_CLEARANCE,
  CONNECTOR_LABEL_PANEL_CLEARANCE,
  CONNECTOR_LABEL_TRACK_CLEARANCE,
} from './connectors-constants';
import {
  boxesOverlap,
  expandBox,
  segmentHitsBox,
} from './connectors-geometry';
import {
  connectorLabelCandidates,
  labelDirectionPenalty,
  labelOffsetVariants,
} from './connectors-label-candidates';

export function placeConnectorLabel(
  path: ConnectorPath,
  labelWidth: number,
  labelHeight: number,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
  currentSegments: ConnectorSegmentObstacle[],
  fromId: string,
  toId: string,
  labelDx: number,
  labelDy: number,
  padX: number,
  padY: number,
): { box: BoxArea; textX: number; textY: number; textWidth: number } | null {
  if (labelWidth <= 0 || labelHeight <= 0) return null;

  const boxWidth = labelWidth + padX * 2;
  const boxHeight = labelHeight + padY * 2;
  let best: { box: BoxArea; score: number } | null = null;
  const occupiedSegments = [...routingContext.segments, ...currentSegments];
  const fromCard = cards.find((card) => card.id === fromId);
  const toCard = cards.find((card) => card.id === toId);
  const candidates = connectorLabelCandidates(path, boxWidth, boxHeight, fromCard, toCard);
  const offsetVariants = labelOffsetVariants(labelDx, labelDy);

  for (const candidate of candidates) {
    for (const offset of offsetVariants) {
      const box: BoxArea = {
        x: candidate.x + offset.dx,
        y: candidate.y + offset.dy,
        width: boxWidth,
        height: boxHeight,
      };
      if (box.x < 0 || box.y < 0) {
        continue;
      }

      const overlapsCard = cards.some((card) => boxesOverlap(
        expandBox(box, CONNECTOR_LABEL_PANEL_CLEARANCE),
        { x: card.x, y: card.y, width: card.width, height: card.height },
      ));
      if (overlapsCard) {
        continue;
      }

      if (routingContext.labels.some((placed) => boxesOverlap(
        expandBox(box, CONNECTOR_LABEL_LABEL_CLEARANCE),
        expandBox(placed, CONNECTOR_LABEL_LABEL_CLEARANCE),
      ))) {
        continue;
      }

      if (occupiedSegments.some((segment) => segmentHitsBox(
        segment.start,
        segment.end,
        box,
        CONNECTOR_LABEL_TRACK_CLEARANCE,
      ))) {
        continue;
      }

      const score = candidate.score
        + offset.penalty
        + labelDirectionPenalty(path, box, labelDx, labelDy);
      if (!best || score < best.score) best = { box, score };
    }
  }

  if (!best) return null;

  return {
    box: best.box,
    textX: best.box.x + best.box.width / 2,
    textY: best.box.y + padY,
    textWidth: Math.max(1, best.box.width - padX * 2),
  };
}
