/**
 * Estimates connector processing priority so higher-impact routes are compiled first.
 */
import { DiagramElement } from '../../ast/types';
import { GSValue, Trace } from '../../runtime/values';
import { CardLayout } from './types';
import { getString } from './helpers';
import { parseAnchorRef } from './connectors-geometry';

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
