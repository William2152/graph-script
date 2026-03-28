/**
 * Score helpers for label candidate geometry around connector segments and elbows.
 */
import { ConnectorPath } from './types';
import {
  boxCenter,
  distancePointToPath,
  distancePointToSegment,
} from './connectors-geometry';

export function scoreSegmentLabelCandidate(
  path: ConnectorPath,
  segmentIndex: number,
  candidate: { x: number; y: number; penalty: number },
  boxWidth: number,
  boxHeight: number,
  segment: { start: { x: number; y: number }; end: { x: number; y: number } },
): { x: number; y: number; score: number } {
  const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
  const center = boxCenter(box);
  return {
    x: candidate.x,
    y: candidate.y,
    score: segmentIndex * 1000
      + candidate.penalty
      + Math.abs(center.x - path.labelX) * 0.35
      + Math.abs(center.y - path.labelY) * 0.35
      + distancePointToSegment(center, segment.start, segment.end),
  };
}

export function scoreElbowLabelCandidate(
  path: ConnectorPath,
  candidate: { x: number; y: number; penalty: number },
  boxWidth: number,
  boxHeight: number,
): { x: number; y: number; score: number } {
  const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
  const center = boxCenter(box);
  return {
    x: candidate.x,
    y: candidate.y,
    score: 4000
      + candidate.penalty
      + Math.abs(center.x - path.labelX) * 0.45
      + Math.abs(center.y - path.labelY) * 0.45
      + distancePointToPath(center, path.points),
  };
}
