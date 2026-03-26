import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { measureRichTextBlock, readLatexMode } from '../latex';
import {
  CardLayout,
  BoxArea,
  ConnectorPath,
  ConnectorRoutingContext,
  ConnectorSegmentObstacle,
  CONNECTOR_ANCHOR_EXIT_MIN,
  CONNECTOR_LABEL_MIN,
  CONNECTOR_TRACK_MIN_GAP,
} from './types';
import { clamp, element, getNumber, getString } from './helpers';

const CONNECTOR_LABEL_TRACK_CLEARANCE = 10;
const CONNECTOR_LABEL_PANEL_CLEARANCE = 12;
const CONNECTOR_LABEL_LABEL_CLEARANCE = 10;
const CONNECTOR_LABEL_LAYOUT_GAP = 16;
const CONNECTOR_LABEL_MAX_WIDTH = 240;

export async function compileConnector(
  connector: DiagramElement,
  cardMap: Map<string, CardLayout>,
  routingContext: ConnectorRoutingContext,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  fontFamily?: string,
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
  const labelDy = getNumber(connector, values, traces, 'label_dy', -12);
  const labelFill = getString(connector, values, traces, 'label_fill', '#ffffff');
  const labelFillOpacity = getNumber(connector, values, traces, 'label_fill_opacity', 0.96);
  const labelPadX = Math.max(10, getNumber(connector, values, traces, 'label_padding_x', 12));
  const labelPadY = Math.max(6, getNumber(connector, values, traces, 'label_padding_y', 7));
  const cards = [...cardMap.values()];
  const labelSize = label
    ? Math.max(CONNECTOR_LABEL_MIN, getNumber(connector, values, traces, 'size', CONNECTOR_LABEL_MIN))
    : CONNECTOR_LABEL_MIN;
  const labelMetrics = label
    ? await measureRichTextBlock(label, {
      x: 0,
      y: 0,
      maxWidth: CONNECTOR_LABEL_MAX_WIDTH,
      fontSize: labelSize,
      weight: getString(connector, values, traces, 'weight', '700'),
      anchor: 'middle',
      latex: readLatexMode(undefined, 'auto'),
      maxLines: 2,
      fontFamily,
    })
    : null;
  const path = routeConnector(
    fromCard,
    fromRef.anchor,
    toCard,
    toRef.anchor,
    route,
    cards,
    routingContext,
    labelMetrics
      ? {
        labelWidth: labelMetrics.width,
        labelHeight: labelMetrics.height,
        fromId: fromCard.id,
        toId: toCard.id,
        labelDx,
        labelDy,
        padX: labelPadX,
        padY: labelPadY,
      }
      : undefined,
  );
  const connectorSegments = pathSegments(path.points, connector.name);

  const segments: DiagramElement[] = [];
  for (let index = 0; index < connectorSegments.length; index += 1) {
    const { start, end } = connectorSegments[index];
    const type = index === connectorSegments.length - 1 ? 'arrow' : 'line';
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
      semantic_role: 'connector_segment',
    }));
  }

  if (label && labelMetrics) {
    const labelPlacement = placeConnectorLabel(
      path,
      labelMetrics.width,
      labelMetrics.height,
      cards,
      routingContext,
      connectorSegments,
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
        semantic_role: 'connector_label_bg',
        connector_from: fromCard.id,
        connector_to: toCard.id,
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
        font_family: fontFamily ?? '',
        min_gap: 16,
        validation_ignore: true,
        semantic_role: 'connector_label',
        connector_from: fromCard.id,
        connector_to: toCard.id,
      }));
      routingContext.labels.push(labelPlacement.box);
    } else {
      segments.push(element('box', `${connector.name}-label-missing`, {
        x: path.labelX,
        y: path.labelY,
        w: 1,
        h: 1,
        label: '',
        fill: 'none',
        stroke: 'none',
        size: labelSize,
        shadow: false,
        validation_ignore: true,
        semantic_role: 'connector_label',
        connector_from: fromCard.id,
        connector_to: toCard.id,
        connector_label_unplaced: true,
      }));
    }
  }

  routingContext.segments.push(...connectorSegments);
  return segments;
}

export function estimateConnectorPriority(
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

function placeConnectorLabel(
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
  const candidates = connectorLabelCandidates(path, boxWidth, boxHeight);

  for (const candidate of candidates) {
    const box: BoxArea = {
      x: candidate.x + labelDx,
      y: candidate.y + labelDy,
      width: boxWidth,
      height: boxHeight,
    };

    if (cards.some((card) => boxesOverlap(
      expandBox(box, CONNECTOR_LABEL_PANEL_CLEARANCE),
      { x: card.x, y: card.y, width: card.width, height: card.height },
    ))) {
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

    if (!best || candidate.score < best.score) best = { box, score: candidate.score };
  }

  if (!best) return null;

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
  labelPreference?: {
    labelWidth: number;
    labelHeight: number;
    fromId: string;
    toId: string;
    labelDx: number;
    labelDy: number;
    padX: number;
    padY: number;
  },
): ConnectorPath {
  const offset = 30;
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
        const previewPlacement = placeConnectorLabel(
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

function connectorLabelCandidates(path: ConnectorPath, boxWidth: number, boxHeight: number): Array<{ x: number; y: number; score: number }> {
  const candidates: Array<{ x: number; y: number; score: number }> = [];

  for (let segmentIndex = 0; segmentIndex < path.labelSegments.length; segmentIndex += 1) {
    const segment = path.labelSegments[segmentIndex];
    const horizontal = segment.start.y === segment.end.y;
    const segmentCandidates = horizontal
      ? horizontalLabelCandidates(segment, boxWidth, boxHeight)
      : verticalLabelCandidates(segment, boxWidth, boxHeight);

    for (const candidate of segmentCandidates) {
      const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
      const center = boxCenter(box);
      candidates.push({
        x: candidate.x,
        y: candidate.y,
        score: segmentIndex * 1000
          + candidate.penalty
          + Math.abs(center.x - path.labelX) * 0.35
          + Math.abs(center.y - path.labelY) * 0.35
          + distancePointToSegment(center, segment.start, segment.end),
      });
    }
  }

  for (let pointIndex = 1; pointIndex < path.points.length - 1; pointIndex += 1) {
    const pointCandidates = elbowLabelCandidates(path.points[pointIndex], boxWidth, boxHeight);
    for (const candidate of pointCandidates) {
      const box = { x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight };
      const center = boxCenter(box);
      candidates.push({
        x: candidate.x,
        y: candidate.y,
        score: 4000
          + candidate.penalty
          + Math.abs(center.x - path.labelX) * 0.45
          + Math.abs(center.y - path.labelY) * 0.45
          + distancePointToPath(center, path.points),
      });
    }
  }

  return uniqueLabelCandidates(candidates);
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

function connectorPathDetails(points: { x: number; y: number }[]): ConnectorPath {
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

function uniqueRoutes(routes: string[]): string[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route)) return false;
    seen.add(route);
    return true;
  });
}

function scoreConnectorPath(points: { x: number; y: number }[], cards: CardLayout[], fromId: string, toId: string, routingContext: ConnectorRoutingContext): number {
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

function segmentHitsCard(start: { x: number; y: number }, end: { x: number; y: number }, card: CardLayout): boolean {
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

function segmentHitsBox(start: { x: number; y: number }, end: { x: number; y: number }, box: BoxArea, padding = 0): boolean {
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

function rangeOverlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd)));
}

function segmentLength(start: { x: number; y: number }, end: { x: number; y: number }): number {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
}

function distancePointToSegment(
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

function distancePointToPath(point: { x: number; y: number }, points: { x: number; y: number }[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distancePointToSegment(point, points[index], points[index + 1]));
  }
  return Number.isFinite(best) ? best : 0;
}

function connectorAnchorLegPenalty(points: { x: number; y: number }[]): number {
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

function anchorPoint(card: CardLayout, anchor: string): { x: number; y: number } {
  switch (anchor) {
    case 'top': return { x: card.x + card.width / 2, y: card.y };
    case 'bottom': return { x: card.x + card.width / 2, y: card.y + card.height };
    case 'left': return { x: card.x, y: card.y + card.height / 2 };
    case 'right':
    default:
      return { x: card.x + card.width, y: card.y + card.height / 2 };
  }
}

function nudgePoint(point: { x: number; y: number }, anchor: string, distance: number): { x: number; y: number } {
  switch (anchor) {
    case 'top': return { x: point.x, y: point.y - distance };
    case 'bottom': return { x: point.x, y: point.y + distance };
    case 'left': return { x: point.x - distance, y: point.y };
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

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
