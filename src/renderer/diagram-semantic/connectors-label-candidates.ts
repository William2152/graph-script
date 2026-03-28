/**
 * Generates and ranks candidate label boxes along connector segments/elbows
 * and contextual card gaps.
 */
import { BoxArea, CardLayout, ConnectorPath } from './types';
import {
  CONNECTOR_LABEL_LAYOUT_GAP,
  CONNECTOR_LABEL_PANEL_CLEARANCE,
} from './connectors-constants';
import {
  boxCenter,
} from './connectors-geometry';
import { scoreElbowLabelCandidate, scoreSegmentLabelCandidate } from './connectors-label-geometry';

export function connectorLabelCandidates(
  path: ConnectorPath,
  boxWidth: number,
  boxHeight: number,
  fromCard?: CardLayout,
  toCard?: CardLayout,
): Array<{ x: number; y: number; score: number }> {
  const candidates: Array<{ x: number; y: number; score: number }> = [];

  for (const candidate of connectorContextualLabelCandidates(path, boxWidth, boxHeight, fromCard, toCard)) {
    const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
    const center = boxCenter(box);
    candidates.push({
      x: candidate.x,
      y: candidate.y,
      score: candidate.penalty
        + Math.abs(center.x - path.labelX) * 0.2
        + Math.abs(center.y - path.labelY) * 0.2,
    });
  }
  for (let segmentIndex = 0; segmentIndex < path.labelSegments.length; segmentIndex += 1) {
    const segment = path.labelSegments[segmentIndex];
    const horizontal = segment.start.y === segment.end.y;
    const segmentCandidates = horizontal
      ? horizontalLabelCandidates(segment, boxWidth, boxHeight)
      : verticalLabelCandidates(segment, boxWidth, boxHeight);

    for (const candidate of segmentCandidates) {
      candidates.push(scoreSegmentLabelCandidate(path, segmentIndex, candidate, boxWidth, boxHeight, segment));
    }
  }

  for (let pointIndex = 1; pointIndex < path.points.length - 1; pointIndex += 1) {
    const pointCandidates = elbowLabelCandidates(path.points[pointIndex], boxWidth, boxHeight);
    for (const candidate of pointCandidates) {
      candidates.push(scoreElbowLabelCandidate(path, candidate, boxWidth, boxHeight));
    }
  }

  return uniqueLabelCandidates(candidates);
}

export function labelOffsetVariants(
  labelDx: number,
  labelDy: number,
): Array<{ dx: number; dy: number; penalty: number }> {
  const xScales = labelDx === 0 ? [1] : [1, 0.75, 0.5, 0.25, 0];
  const yScales = labelDy === 0 ? [1] : [1, 0.5, 0];
  const variants: Array<{ dx: number; dy: number; penalty: number }> = [];

  for (const xScale of xScales) {
    for (const yScale of yScales) {
      const dx = labelDx * xScale;
      const dy = labelDy * yScale;
      const penalty = Math.abs(labelDx - dx) * 0.9
        + Math.abs(labelDy - dy) * 0.9
        + ((xScale === 1 && yScale === 1) ? 0 : 18);
      variants.push({ dx, dy, penalty });
    }
  }

  return variants
    .filter((variant, index, list) =>
      list.findIndex((other) => Math.abs(other.dx - variant.dx) < 0.1 && Math.abs(other.dy - variant.dy) < 0.1) === index)
    .sort((left, right) => left.penalty - right.penalty);
}

export function labelDirectionPenalty(
  path: ConnectorPath,
  box: BoxArea,
  labelDx: number,
  labelDy: number,
): number {
  const center = boxCenter(box);
  let penalty = 0;

  if (labelDx > 0 && center.x + 0.1 < path.labelX) penalty += 180 + labelDx * 0.6;
  if (labelDx < 0 && center.x - 0.1 > path.labelX) penalty += 180 + Math.abs(labelDx) * 0.6;
  if (labelDy > 0 && center.y + 0.1 < path.labelY) penalty += 120 + labelDy * 0.6;
  if (labelDy < 0 && center.y - 0.1 > path.labelY) penalty += 120 + Math.abs(labelDy) * 0.6;

  return penalty;
}

function connectorContextualLabelCandidates(
  path: ConnectorPath,
  boxWidth: number,
  boxHeight: number,
  fromCard?: CardLayout,
  toCard?: CardLayout,
): Array<{ x: number; y: number; penalty: number }> {
  if (!fromCard || !toCard) return [];

  const union = {
    x: Math.min(fromCard.x, toCard.x),
    y: Math.min(fromCard.y, toCard.y),
    width: Math.max(fromCard.x + fromCard.width, toCard.x + toCard.width) - Math.min(fromCard.x, toCard.x),
    height: Math.max(fromCard.y + fromCard.height, toCard.y + toCard.height) - Math.min(fromCard.y, toCard.y),
  };
  const gap = CONNECTOR_LABEL_LAYOUT_GAP + 12;
  const candidates: Array<{ x: number; y: number; penalty: number }> = [];

  if (allPointsShareX(path.points)) {
    const upperCard = fromCard.y <= toCard.y ? fromCard : toCard;
    const lowerCard = upperCard === fromCard ? toCard : fromCard;
    const gapTop = upperCard.y + upperCard.height;
    const gapBottom = lowerCard.y;
    const gapHeight = gapBottom - gapTop;
    const sideXCandidates = [
      { x: union.x + union.width + CONNECTOR_LABEL_PANEL_CLEARANCE + 2, penalty: 8 },
      { x: union.x + union.width + gap, penalty: 16 },
      { x: union.x - boxWidth - CONNECTOR_LABEL_PANEL_CLEARANCE - 2, penalty: 8 },
      { x: union.x - boxWidth - gap, penalty: 16 },
    ];
    const yCandidates = uniqueNumbers([
      gapTop + (gapHeight - boxHeight) / 2,
      gapTop - boxHeight - gap,
      gapBottom + gap,
      upperCard.y - boxHeight - gap,
      lowerCard.y + lowerCard.height + gap,
    ]);
    for (const y of yCandidates) {
      const yPenalty = Math.abs(y - (gapTop + (gapHeight - boxHeight) / 2)) < 1
        ? 12
        : (Math.abs(y - (gapTop - boxHeight - gap)) < 1 || Math.abs(y - (gapBottom + gap)) < 1 ? 24 : 36);
      for (const side of sideXCandidates) {
        candidates.push({ x: side.x, y, penalty: yPenalty + side.penalty });
      }
    }
  }

  if (allPointsShareY(path.points)) {
    const leftCard = fromCard.x <= toCard.x ? fromCard : toCard;
    const rightCard = leftCard === fromCard ? toCard : fromCard;
    const gapLeft = leftCard.x + leftCard.width;
    const gapRight = rightCard.x;
    const gapWidth = gapRight - gapLeft;
    const sideYCandidates = [
      { y: union.y - boxHeight - CONNECTOR_LABEL_PANEL_CLEARANCE - 2, penalty: 8 },
      { y: union.y - boxHeight - gap, penalty: 16 },
      { y: union.y + union.height + CONNECTOR_LABEL_PANEL_CLEARANCE + 2, penalty: 8 },
      { y: union.y + union.height + gap, penalty: 16 },
    ];
    const xCandidates = uniqueNumbers([
      gapLeft + (gapWidth - boxWidth) / 2,
      gapLeft - boxWidth - gap,
      gapRight + gap,
      leftCard.x - boxWidth - gap,
      rightCard.x + rightCard.width + gap,
    ]);
    for (const x of xCandidates) {
      const xPenalty = Math.abs(x - (gapLeft + (gapWidth - boxWidth) / 2)) < 1
        ? 12
        : (Math.abs(x - (gapLeft - boxWidth - gap)) < 1 || Math.abs(x - (gapRight + gap)) < 1 ? 24 : 36);
      for (const side of sideYCandidates) {
        candidates.push({ x, y: side.y, penalty: xPenalty + side.penalty });
      }
    }
  }

  return candidates;
}

function horizontalLabelCandidates(
  segment: { start: { x: number; y: number }; end: { x: number; y: number }; length: number },
  boxWidth: number,
  boxHeight: number,
): Array<{ x: number; y: number; penalty: number }> {
  const minX = Math.min(segment.start.x, segment.end.x);
  const maxX = Math.max(segment.start.x, segment.end.x);
  const centerX = (minX + maxX) / 2;
  const y = segment.start.y;
  const fractions = [0.25, 0.5, 0.75];
  const xCandidates = uniqueNumbers([
    centerX - boxWidth / 2,
    minX - boxWidth / 2,
    maxX - boxWidth / 2,
    minX + 12 - boxWidth / 2,
    maxX - 12 - boxWidth / 2,
    ...fractions.map((fraction) => minX + (maxX - minX) * fraction - boxWidth / 2),
  ]);

  const candidates: Array<{ x: number; y: number; penalty: number }> = [];
  for (const x of xCandidates) {
    candidates.push({ x, y: y - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 0 });
    candidates.push({ x, y: y + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 0 });
  }

  candidates.push({ x: minX - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y: y - boxHeight / 2, penalty: 28 });
  candidates.push({ x: maxX + CONNECTOR_LABEL_LAYOUT_GAP, y: y - boxHeight / 2, penalty: 28 });
  candidates.push({ x: minX - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y: y - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: minX - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y: y + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: maxX + CONNECTOR_LABEL_LAYOUT_GAP, y: y - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: maxX + CONNECTOR_LABEL_LAYOUT_GAP, y: y + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  return candidates;
}

function verticalLabelCandidates(
  segment: { start: { x: number; y: number }; end: { x: number; y: number }; length: number },
  boxWidth: number,
  boxHeight: number,
): Array<{ x: number; y: number; penalty: number }> {
  const minY = Math.min(segment.start.y, segment.end.y);
  const maxY = Math.max(segment.start.y, segment.end.y);
  const centerY = (minY + maxY) / 2;
  const x = segment.start.x;
  const fractions = [0.25, 0.5, 0.75];
  const yCandidates = uniqueNumbers([
    centerY - boxHeight / 2,
    minY - boxHeight / 2,
    maxY - boxHeight / 2,
    minY + 10 - boxHeight / 2,
    maxY - 10 - boxHeight / 2,
    ...fractions.map((fraction) => minY + (maxY - minY) * fraction - boxHeight / 2),
  ]);

  const candidates: Array<{ x: number; y: number; penalty: number }> = [];
  for (const y of yCandidates) {
    candidates.push({ x: x - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y, penalty: 0 });
    candidates.push({ x: x + CONNECTOR_LABEL_LAYOUT_GAP, y, penalty: 0 });
  }

  candidates.push({ x: x - boxWidth / 2, y: minY - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 28 });
  candidates.push({ x: x - boxWidth / 2, y: maxY + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 28 });
  candidates.push({ x: x - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y: minY - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: x + CONNECTOR_LABEL_LAYOUT_GAP, y: minY - boxHeight - CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: x - boxWidth - CONNECTOR_LABEL_LAYOUT_GAP, y: maxY + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  candidates.push({ x: x + CONNECTOR_LABEL_LAYOUT_GAP, y: maxY + CONNECTOR_LABEL_LAYOUT_GAP, penalty: 42 });
  return candidates;
}

function elbowLabelCandidates(
  point: { x: number; y: number },
  boxWidth: number,
  boxHeight: number,
): Array<{ x: number; y: number; penalty: number }> {
  const gap = CONNECTOR_LABEL_LAYOUT_GAP;
  return [
    { x: point.x - boxWidth / 2, y: point.y - boxHeight - gap, penalty: 24 },
    { x: point.x - boxWidth / 2, y: point.y + gap, penalty: 24 },
    { x: point.x - boxWidth - gap, y: point.y - boxHeight / 2, penalty: 24 },
    { x: point.x + gap, y: point.y - boxHeight / 2, penalty: 24 },
    { x: point.x - boxWidth - gap, y: point.y - boxHeight - gap, penalty: 36 },
    { x: point.x + gap, y: point.y - boxHeight - gap, penalty: 36 },
    { x: point.x - boxWidth - gap, y: point.y + gap, penalty: 36 },
    { x: point.x + gap, y: point.y + gap, penalty: 36 },
  ];
}

function uniqueLabelCandidates(
  candidates: Array<{ x: number; y: number; score: number }>,
): Array<{ x: number; y: number; score: number }> {
  return candidates
    .filter((candidate, index, list) =>
      list.findIndex((other) => Math.abs(other.x - candidate.x) < 1 && Math.abs(other.y - candidate.y) < 1) === index)
    .sort((left, right) => left.score - right.score);
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index, array) => array.findIndex((candidate) => Math.abs(candidate - value) < 1) === index);
}

function allPointsShareX(points: Array<{ x: number; y: number }>): boolean {
  return points.length > 1 && points.every((point) => Math.abs(point.x - points[0].x) < 1);
}

function allPointsShareY(points: Array<{ x: number; y: number }>): boolean {
  return points.length > 1 && points.every((point) => Math.abs(point.y - points[0].y) < 1);
}
