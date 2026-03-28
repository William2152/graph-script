/**
 * Connector path scoring and post-route spreading.
 * Penalizes intersections/clearance violations and nudges tracks for separation.
 */
import {
  CardLayout,
  ConnectorRoutingContext,
  CONNECTOR_ANCHOR_EXIT_MIN,
  CONNECTOR_TRACK_MIN_GAP,
} from './types';
import {
  betweenInclusive,
  rangeOverlapLength,
  segmentHitsBox,
  segmentHitsCard,
  segmentLength,
  simplifyPoints,
} from './connectors-geometry';

export function scoreConnectorPath(
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
    length += segmentLength(start, end);
    for (const card of cards) {
      if (card.id === fromId || card.id === toId) continue;
      if (segmentHitsCard(start, end, card)) intersections += 1;
      else clearancePenalty += connectorClearancePenalty(start, end, card);
    }
    for (const segment of routingContext.segments) connectorPenalty += scoreSegmentInteraction(start, end, segment.start, segment.end);
    for (const label of routingContext.labels) {
      if (segmentHitsBox(start, end, label, 6)) labelPenalty += 1;
    }
  }

  return intersections * 100000
    + labelPenalty * 40000
    + connectorPenalty
    + clearancePenalty
    + connectorAnchorLegPenalty(points)
    + length
    + Math.max(0, points.length - 2) * 28;
}

export function spreadConnectorPath(
  points: { x: number; y: number }[],
  routingContext: ConnectorRoutingContext,
  cards: CardLayout[],
  fromId: string,
  toId: string,
): { x: number; y: number }[] {
  if (points.length < 5 || !routingContext.segments.length) return points;
  let adjusted = points.map((point) => ({ ...point }));
  const maxPasses = 4;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (let index = 1; index < adjusted.length - 2; index += 1) {
      const start = adjusted[index];
      const end = adjusted[index + 1];
      if (start.x !== end.x && start.y !== end.y) continue;

      let requiredShift = 0;
      for (const existing of routingContext.segments) {
        if (start.x === end.x && existing.start.x === existing.end.x) {
          const delta = Math.abs(start.x - existing.start.x);
          const overlapLength = rangeOverlapLength(start.y, end.y, existing.start.y, existing.end.y);
          if (delta + 0.1 < CONNECTOR_TRACK_MIN_GAP && overlapLength > 0) {
            requiredShift = Math.max(requiredShift, CONNECTOR_TRACK_MIN_GAP - delta);
          }
        }
        if (start.y === end.y && existing.start.y === existing.end.y) {
          const delta = Math.abs(start.y - existing.start.y);
          const overlapLength = rangeOverlapLength(start.x, end.x, existing.start.x, existing.end.x);
          if (delta + 0.1 < CONNECTOR_TRACK_MIN_GAP && overlapLength > 0) {
            requiredShift = Math.max(requiredShift, CONNECTOR_TRACK_MIN_GAP - delta);
          }
        }
      }

      if (requiredShift <= 0) continue;

      const before = adjusted[index - 1];
      const after = adjusted[index + 2];
      const preferredDirection = start.x === end.x
        ? (start.x <= (before.x + after.x) / 2 ? -1 : 1)
        : (start.y <= (before.y + after.y) / 2 ? -1 : 1);
      const candidateDirections = [preferredDirection, -preferredDirection];
      let bestTrial: { points: { x: number; y: number }[]; score: number } | null = null;

      for (const direction of candidateDirections) {
        const shifted = shiftConnectorSegment(
          adjusted,
          index,
          start.x === end.x ? direction * requiredShift : 0,
          start.y === end.y ? direction * requiredShift : 0,
        );
        const simplified = simplifyPoints(shifted);
        if (!hasMinimumAnchorLegs(simplified)) continue;

        const score = scoreConnectorPath(simplified, cards, fromId, toId, routingContext);
        if (!bestTrial || score < bestTrial.score) {
          bestTrial = { points: simplified, score };
        }
      }

      if (!bestTrial) continue;
      adjusted = bestTrial.points;
      changed = true;
      break;
    }

    if (!changed) break;
  }

  return simplifyPoints(adjusted);
}

export function connectorAnchorLegPenalty(points: { x: number; y: number }[]): number {
  if (points.length <= 2) return 0;

  let penalty = 0;
  const firstLeg = segmentLength(points[0], points[1]);
  const lastLeg = segmentLength(points[points.length - 2], points[points.length - 1]);

  if (firstLeg + 0.1 < CONNECTOR_ANCHOR_EXIT_MIN) {
    penalty += 120000 + Math.round((CONNECTOR_ANCHOR_EXIT_MIN - firstLeg) * 2500);
  }
  if (lastLeg + 0.1 < CONNECTOR_ANCHOR_EXIT_MIN) {
    penalty += 120000 + Math.round((CONNECTOR_ANCHOR_EXIT_MIN - lastLeg) * 2500);
  }

  return penalty;
}

function connectorClearancePenalty(start: { x: number; y: number }, end: { x: number; y: number }, card: CardLayout): number {
  const padded = { x: card.x - 12, y: card.y - 12, width: card.width + 24, height: card.height + 24 };
  return segmentHitsBox(start, end, padded, 0) ? 1200 : 0;
}

function scoreSegmentInteraction(startA: { x: number; y: number }, endA: { x: number; y: number }, startB: { x: number; y: number }, endB: { x: number; y: number }): number {
  if (startA.x === endA.x && startB.x === endB.x) {
    const delta = Math.abs(startA.x - startB.x);
    const overlapLength = rangeOverlapLength(startA.y, endA.y, startB.y, endB.y);
    if (delta < 1 && overlapLength > 0) return 90000 + overlapLength * 18;
    if (delta < CONNECTOR_TRACK_MIN_GAP && overlapLength > 0) {
      return 42000 + Math.round((CONNECTOR_TRACK_MIN_GAP - delta) * overlapLength * 1.8);
    }
    return 0;
  }
  if (startA.y === endA.y && startB.y === endB.y) {
    const delta = Math.abs(startA.y - startB.y);
    const overlapLength = rangeOverlapLength(startA.x, endA.x, startB.x, endB.x);
    if (delta < 1 && overlapLength > 0) return 90000 + overlapLength * 18;
    if (delta < CONNECTOR_TRACK_MIN_GAP && overlapLength > 0) {
      return 42000 + Math.round((CONNECTOR_TRACK_MIN_GAP - delta) * overlapLength * 1.8);
    }
    return 0;
  }
  if (segmentsCrossOrthogonally(startA, endA, startB, endB)) return 6000;
  return 0;
}

function segmentsCrossOrthogonally(startA: { x: number; y: number }, endA: { x: number; y: number }, startB: { x: number; y: number }, endB: { x: number; y: number }): boolean {
  if (startA.y === endA.y && startB.x === endB.x) {
    return betweenInclusive(startB.x, startA.x, endA.x) && betweenInclusive(startA.y, startB.y, endB.y);
  }
  if (startA.x === endA.x && startB.y === endB.y) {
    return betweenInclusive(startA.x, startB.x, endB.x) && betweenInclusive(startB.y, startA.y, endA.y);
  }
  return false;
}

function hasMinimumAnchorLegs(points: { x: number; y: number }[]): boolean {
  return connectorAnchorLegPenalty(points) === 0;
}

function shiftConnectorSegment(
  points: { x: number; y: number }[],
  index: number,
  deltaX: number,
  deltaY: number,
): { x: number; y: number }[] {
  const shifted = points.map((point) => ({ ...point }));
  shifted[index] = { x: shifted[index].x + deltaX, y: shifted[index].y + deltaY };
  shifted[index + 1] = { x: shifted[index + 1].x + deltaX, y: shifted[index + 1].y + deltaY };
  return shifted;
}
