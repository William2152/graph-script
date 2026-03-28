/**
 * Geometry helpers used by connector routing and label placement.
 * Includes overlap checks, segment utilities, anchors, and path normalization.
 */
import { CardLayout, BoxArea, ConnectorSegmentObstacle } from './types';
import { clamp } from './helpers';

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0;
}

export function rangeOverlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)));
}

export function segmentLength(start: { x: number; y: number }, end: { x: number; y: number }): number {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
}

export function distancePointToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  if (start.y === end.y) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const x = clamp(point.x, minX, maxX);
    return Math.abs(point.x - x) + Math.abs(point.y - start.y);
  }
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const y = clamp(point.y, minY, maxY);
  return Math.abs(point.x - start.x) + Math.abs(point.y - y);
}

export function distancePointToPath(point: { x: number; y: number }, points: { x: number; y: number }[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distancePointToSegment(point, points[index], points[index + 1]));
  }
  return Number.isFinite(best) ? best : 0;
}

export function betweenInclusive(value: number, start: number, end: number): boolean {
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function expandBox(box: BoxArea, padding: number): BoxArea {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export function boxCenter(box: BoxArea): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function segmentHitsBox(start: { x: number; y: number }, end: { x: number; y: number }, box: BoxArea, padding = 0): boolean {
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

export function segmentHitsCard(start: { x: number; y: number }, end: { x: number; y: number }, card: CardLayout): boolean {
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

export function pathSegments(points: { x: number; y: number }[], connectorId: string): ConnectorSegmentObstacle[] {
  const segments: ConnectorSegmentObstacle[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({ start: points[index], end: points[index + 1], connectorId });
  }
  return segments;
}

export function simplifyPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const deduped = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
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

export function anchorPoint(card: CardLayout, anchor: string): { x: number; y: number } {
  switch (anchor) {
    case 'top': return { x: card.x + card.width / 2, y: card.y };
    case 'bottom': return { x: card.x + card.width / 2, y: card.y + card.height };
    case 'left': return { x: card.x, y: card.y + card.height / 2 };
    case 'right':
    default:
      return { x: card.x + card.width, y: card.y + card.height / 2 };
  }
}

export function nudgePoint(point: { x: number; y: number }, anchor: string, distance: number): { x: number; y: number } {
  switch (anchor) {
    case 'top': return { x: point.x, y: point.y - distance };
    case 'bottom': return { x: point.x, y: point.y + distance };
    case 'left': return { x: point.x - distance, y: point.y };
    case 'right':
    default:
      return { x: point.x + distance, y: point.y };
  }
}

export function isHorizontalAnchor(anchor: string): boolean {
  return anchor === 'left' || anchor === 'right';
}

export function parseAnchorRef(value: string): { cardId: string; anchor: string } | null {
  if (!value) return null;
  const [cardId, anchor = 'right'] = value.split('.');
  if (!cardId) return null;
  return { cardId, anchor };
}
