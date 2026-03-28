import { DiagramElement } from '../../ast/types';
import { READABILITY_POLICY, ReadabilityMode } from '../readability-policy';

export const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

export const SEMANTIC_TYPES = new Set(['header', 'separator', 'lane', 'card', 'connector', 'loop_label']);
export const CONTAINER_TYPES = new Set(['group', 'divider', 'spacer']);

export const HEADER_TITLE_MIN = READABILITY_POLICY.headerTitleMin;
export const SECTION_TITLE_MIN = READABILITY_POLICY.sectionTitleMin;
export const CARD_TITLE_MIN = READABILITY_POLICY.cardTitleMin;
export const BODY_TEXT_MIN = READABILITY_POLICY.bodyTextMin;
export const FORMULA_TEXT_MIN = READABILITY_POLICY.formulaTextMin;
export const CONNECTOR_LABEL_MIN = READABILITY_POLICY.connectorLabelMin;
export const CONNECTOR_TRACK_MIN_GAP = 28;
export const CONNECTOR_ANCHOR_EXIT_MIN = 24;
export const CARD_GAP_MIN = 28;
export const CHILD_GAP_MIN = 16;
export const MIN_ASSET_WIDTH = 120;
export const MIN_ASSET_HEIGHT = 48;

export interface SemanticCompileOptions {
  fontFamily?: string;
  fontScale?: number;
  imageScale?: number;
  fillImages?: boolean;
  readabilityMode?: ReadabilityMode;
}

export interface SemanticCompileResult {
  elements: DiagramElement[];
  minWidth: number;
  minHeight: number;
  hasSemantic: boolean;
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaneSpec {
  id: string;
  section: string;
  order: number;
  ratio: number;
  columns: number;
  columnRatios: number[];
  gapX: number;
  gapY: number;
  padding: number;
  frame: Frame;
}

export interface CardLayout {
  id: string;
  section: string;
  row: number;
  col: number;
  span: number;
  rowSpan: number;
  width: number;
  height: number;
  x: number;
  y: number;
  laneId: string;
  compiled: DiagramElement;
}

export interface ConnectorPath {
  points: { x: number; y: number }[];
  labelX: number;
  labelY: number;
  labelSegmentLength: number;
  labelSegmentStart: { x: number; y: number };
  labelSegmentEnd: { x: number; y: number };
  labelSegments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    length: number;
  }>;
}

export interface BoxArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectorSegmentObstacle {
  start: { x: number; y: number };
  end: { x: number; y: number };
  connectorId: string;
}

export interface ConnectorRoutingContext {
  segments: ConnectorSegmentObstacle[];
  labels: BoxArea[];
}

export interface ChildLayout {
  width: number;
  height: number;
  elements: DiagramElement[];
}

export interface CardMeasurement {
  width: number;
  height: number;
  children: DiagramElement[];
}

export interface ContainerOptions {
  layout: 'stack' | 'row' | 'columns';
  gap: number;
  padding: number;
  columns: number;
  align: 'start' | 'center' | 'end' | 'stretch';
}
