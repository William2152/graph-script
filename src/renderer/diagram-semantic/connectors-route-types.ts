/**
 * Shared route/label contracts to decouple routing orchestration
 * from label placement implementation details.
 */
import {
  BoxArea,
  CardLayout,
  ConnectorPath,
  ConnectorRoutingContext,
  ConnectorSegmentObstacle,
} from './types';

export interface LabelPreference {
  labelWidth: number;
  labelHeight: number;
  fromId: string;
  toId: string;
  labelDx: number;
  labelDy: number;
  padX: number;
  padY: number;
}

export interface LabelPlacement {
  box: BoxArea;
  textX: number;
  textY: number;
  textWidth: number;
}

export type PlaceLabelFn = (
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
) => LabelPlacement | null;
