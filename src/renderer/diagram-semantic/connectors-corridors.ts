/**
 * Corridor selection helpers for orthogonal connector routing.
 * Chooses candidate mid-lines that avoid blocked card intervals.
 */
import { CardLayout, ConnectorRoutingContext, CONNECTOR_TRACK_MIN_GAP } from './types';
import { clamp } from './helpers';
import { overlaps } from './connectors-geometry';

export function chooseMidXCandidates(
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

export function chooseMidYCandidates(
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

function buildBlockedIntervalsX(fromCard: CardLayout, toCard: CardLayout, fromY: number, toY: number, cards: CardLayout[]): Array<[number, number]> {
  return cards
    .filter((card) => card.id !== fromCard.id && card.id !== toCard.id)
    .filter((card) => overlaps(card.y - 28, card.y + card.height + 28, Math.min(fromY, toY), Math.max(fromY, toY)))
    .map((card) => [card.x - 28, card.x + card.width + 28] as [number, number]);
}

function buildBlockedIntervalsY(fromCard: CardLayout, toCard: CardLayout, cards: CardLayout[]): Array<[number, number]> {
  return cards
    .filter((card) => card.id !== fromCard.id && card.id !== toCard.id)
    .filter((card) => overlaps(card.x - 28, card.x + card.width + 28, Math.min(fromCard.x, toCard.x), Math.max(fromCard.x + fromCard.width, toCard.x + toCard.width)))
    .map((card) => [card.y - 28, card.y + card.height + 28] as [number, number]);
}

function corridorCandidates(preferred: number, start: number, end: number, blocked: Array<[number, number]>, occupiedCorridors: number[]): number[] {
  const lower = Math.min(start, end) - 28;
  const upper = Math.max(start, end) + 28;
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
      values.add(gapStart + 20);
      values.add(gapEnd - 20);
    }
  }

  for (const occupied of occupiedCorridors) {
    values.add(occupied - CONNECTOR_TRACK_MIN_GAP);
    values.add(occupied + CONNECTOR_TRACK_MIN_GAP);
    values.add(occupied - CONNECTOR_TRACK_MIN_GAP * 2);
    values.add(occupied + CONNECTOR_TRACK_MIN_GAP * 2);
  }

  const candidates = [...values]
    .map((value) => clamp(value, lower - 120, upper + 120))
    .filter((value, index, array) => array.findIndex((candidate) => Math.abs(candidate - value) < 1) === index)
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));

  const separated = candidates.filter((candidate) =>
    occupiedCorridors.every((occupied) => Math.abs(candidate - occupied) + 0.1 >= CONNECTOR_TRACK_MIN_GAP),
  );
  return separated.length ? separated : candidates;
}

function baseMidX(fromX: number, toX: number, fromAnchor: string, toAnchor: string): number {
  if (fromAnchor === 'right' && toAnchor === 'left' && toX <= fromX) return Math.max(fromX, toX) + 56;
  if (fromAnchor === 'left' && toAnchor === 'right' && toX >= fromX) return Math.min(fromX, toX) - 56;
  return (fromX + toX) / 2;
}

function baseMidY(fromY: number, toY: number, fromAnchor: string, toAnchor: string): number {
  if (fromAnchor === 'bottom' && toAnchor === 'top' && toY <= fromY) return Math.max(fromY, toY) + 48;
  if (fromAnchor === 'top' && toAnchor === 'bottom' && toY >= fromY) return Math.min(fromY, toY) - 48;
  return (fromY + toY) / 2;
}

function chooseFreeCorridor(preferred: number, start: number, end: number, blocked: Array<[number, number]>): number {
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

function mergeIntervals(intervals: Array<[number, number]>, minValue: number, maxValue: number): Array<[number, number]> {
  const sorted = intervals
    .map(([start, end]) => [Math.max(minValue, start), Math.min(maxValue, end)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1]) merged.push([...interval] as [number, number]);
    else last[1] = Math.max(last[1], interval[1]);
  }
  return merged;
}
