/**
 * Connector compilation orchestrator for semantic diagrams.
 * Resolves endpoint references, routes connector paths, and emits optional labels.
 */
import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { measureRichTextBlock, readLatexMode } from '../latex';
import {
  CardLayout,
  CONNECTOR_LABEL_MIN,
  ConnectorRoutingContext,
} from './types';
import { element, getNumber, getString } from './helpers';
import { CONNECTOR_LABEL_MAX_WIDTH } from './connectors-constants';
import { parseAnchorRef, pathSegments } from './connectors-geometry';
import { placeConnectorLabel } from './connectors-label-placement';
import { routeConnector } from './connectors-routing';
import { estimateConnectorPriority } from './connectors-priority';
import { LabelPreference } from './connectors-route-types';

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
  const labelPreference: LabelPreference | undefined = labelMetrics
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
    : undefined;

  const path = routeConnector(
    fromCard,
    fromRef.anchor,
    toCard,
    toRef.anchor,
    route,
    cards,
    routingContext,
    placeConnectorLabel,
    labelPreference,
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

export { estimateConnectorPriority };
