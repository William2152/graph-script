/**
 * Routing strategy for semantic connectors.
 * Generates candidate orthogonal paths and chooses the lowest-penalty route.
 */
import {
  CardLayout,
  ConnectorPath,
  ConnectorRoutingContext,
} from './types';
import {
  anchorPoint,
  isHorizontalAnchor,
  nudgePoint,
  pathSegments,
  segmentLength,
  simplifyPoints,
} from './connectors-geometry';
import { spreadConnectorPath, scoreConnectorPath } from './connectors-scoring';
import { chooseMidXCandidates, chooseMidYCandidates } from './connectors-corridors';
import { LabelPreference, PlaceLabelFn } from './connectors-route-types';
import { placeConnectorLabel } from './connectors-label-placement';

export function routeConnector(
  fromCard: CardLayout,
  fromAnchor: string,
  toCard: CardLayout,
  toAnchor: string,
  route: string,
  cards: CardLayout[],
  routingContext: ConnectorRoutingContext,
  placeLabel: PlaceLabelFn = placeConnectorLabel,
  labelPreference?: LabelPreference,
): ConnectorPath {
  const offset = 30;
  const fromPoint = anchorPoint(fromCard, fromAnchor);
  const toPoint = anchorPoint(toCard, toAnchor);
  const fromOut = nudgePoint(fromPoint, fromAnchor, offset);
  const toOut = nudgePoint(toPoint, toAnchor, offset);

  if (route === 'auto') {
    const directPath = tryDirectAlignedRoute(
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
      placeLabel,
      labelPreference,
    );
    if (directPath) return directPath;
  }

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
      const points = spreadConnectorPath(
        simplifyPoints(pathCandidate),
        routingContext,
        cards,
        fromCard.id,
        toCard.id,
      );
      let score = scoreConnectorPath(points, cards, fromCard.id, toCard.id, routingContext);
      if (labelPreference) {
        const previewPath = connectorPathDetails(points);
        const previewPlacement = placeLabel(
          previewPath,
          labelPreference.labelWidth,
          labelPreference.labelHeight,
          cards,
          routingContext,
          pathSegments(points, '__preview__'),
          labelPreference.fromId,
          labelPreference.toId,
          labelPreference.labelDx,
          labelPreference.labelDy,
          labelPreference.padX,
          labelPreference.padY,
        );
        score += previewPlacement ? -22000 : 260000;
      }
      if (!best || score < best.score) best = { points, score };
      if (score === 0) break;
    }
    if (best?.score === 0) break;
  }

  return connectorPathDetails(best?.points ?? [fromPoint, fromOut, toOut, toPoint]);
}

export function tryDirectAlignedRoute(
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
  placeLabel: PlaceLabelFn = placeConnectorLabel,
  labelPreference?: LabelPreference,
): ConnectorPath | null {
  const alignedVertical = !isHorizontalAnchor(fromAnchor)
    && !isHorizontalAnchor(toAnchor)
    && Math.abs(fromPoint.x - toPoint.x) < 1;
  const alignedHorizontal = isHorizontalAnchor(fromAnchor)
    && isHorizontalAnchor(toAnchor)
    && Math.abs(fromPoint.y - toPoint.y) < 1;
  if (!alignedVertical && !alignedHorizontal) return null;

  const points = simplifyPoints([fromPoint, fromOut, toOut, toPoint]);
  const directPath = connectorPathDetails(points);
  const directSegments = pathSegments(points, '__direct__');
  const score = scoreConnectorPath(points, cards, fromCard.id, toCard.id, routingContext);
  if (score >= 100000) return null;

  if (labelPreference) {
    const placement = placeLabel(
      directPath,
      labelPreference.labelWidth,
      labelPreference.labelHeight,
      cards,
      routingContext,
      directSegments,
      labelPreference.fromId,
      labelPreference.toId,
      labelPreference.labelDx,
      labelPreference.labelDy,
      labelPreference.padX,
      labelPreference.padY,
    );
    if (!placement) return null;
  }

  return directPath;
}

export function connectorPathDetails(points: { x: number; y: number }[]): ConnectorPath {
  const labelSegments = points
    .slice(0, -1)
    .map((start, index) => ({
      start,
      end: points[index + 1],
      length: segmentLength(start, points[index + 1]),
    }))
    .filter((segment) => segment.length > 0)
    .sort((left, right) => right.length - left.length);

  let labelX = (points[0].x + points[points.length - 1].x) / 2;
  let labelY = (points[0].y + points[points.length - 1].y) / 2;
  let labelSegmentLength = labelSegments[0]?.length ?? 0;
  let labelSegmentStart = labelSegments[0]?.start ?? points[0];
  let labelSegmentEnd = labelSegments[0]?.end ?? points[points.length - 1];

  if (labelSegments[0]) {
    labelX = (labelSegments[0].start.x + labelSegments[0].end.x) / 2;
    labelY = (labelSegments[0].start.y + labelSegments[0].end.y) / 2;
  }

  return { points, labelX, labelY, labelSegmentLength, labelSegmentStart, labelSegmentEnd, labelSegments };
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

function uniqueRoutes(routes: string[]): string[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route)) return false;
    seen.add(route);
    return true;
  });
}
