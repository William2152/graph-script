import { DiagramElement } from '../../ast/types';
import {
  BODY_TEXT_MIN,
  CARD_TITLE_MIN,
  CONNECTOR_LABEL_MIN,
  CONNECTOR_TRACK_MIN_GAP,
  FORMULA_TEXT_MIN,
  HEADER_TITLE_MIN,
  SECTION_TITLE_MIN,
} from '../diagram-semantic';

export const OVERLAP_TOLERANCE = 5;
export const MAX_RETRIES = 5;
export const MIN_FONT_SIZE = 14;
export const MIN_ELEMENT_SIZE = 20;
export const MIN_LAYOUT_GAP = 14;
export const EXCESSIVE_GAP_MULTIPLIER = 3;
export const OVERFLOW_TOLERANCE = 3;
export { CONNECTOR_TRACK_MIN_GAP };

export interface BoundingBox {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowOverlap: boolean;
  parentId?: string;
  validationIgnore?: boolean;
  ancestorIds?: string[];
}

export interface ValidationIssue {
  kind:
    | 'overlap'
    | 'overflow'
    | 'tight_gap'
    | 'awkward_spacing'
    | 'connector_cross_panel'
    | 'connector_crowding'
    | 'math_fallback'
    | 'undersized_text'
    | 'undersized_asset'
    | 'weak_hierarchy'
    | 'dense_panel'
    | 'decorative_interference'
    | 'connector_label_crowding'
    | 'embed_too_small'
    | 'excessive_empty_space'
    | 'misaligned_siblings'
    | 'plain_math_text'
    | 'manual_coordinates_in_dynamic_mode'
    | 'hard_constraint_overflow'
    | 'canvas_overflow_clipping';
  element1: { id: string; type: string };
  element2: { id: string; type: string };
  overlapArea: number;
  overlapPercentage: number;
  severity: 'error' | 'warning' | 'info';
  location: { x: number; y: number; width: number; height: number };
  message?: string;
}

export type OverlapIssue = ValidationIssue;

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  readabilityScore: number;
}

export interface ReadabilityMetrics {
  minFontSize: number;
  avgFontSize: number;
  minElementSize: number;
  density: number;
  elementCount: number;
}

export interface ValidationReport {
  timestamp: string;
  file: string;
  declaration: string;
  declarationType: string;
  attempts: number;
  success: boolean;
  readabilityScore: number;
  issues: Array<{
    kind?: ValidationIssue['kind'];
    severity: 'error' | 'warning' | 'info';
    element1: string;
    element2: string;
    overlapArea: number;
    overlapPercentage: number;
    location: { x: number; y: number; width: number; height: number };
    message?: string;
  }>;
  metrics: {
    minFontSize: number;
    avgFontSize: number;
    minElementSize: number;
    density: number;
    elementCount: number;
  };
  suggestions: string[];
}

export interface RelayoutStrategy {
  type: 'spacing' | 'scaling' | 'reposition';
  factor: number;
}

export interface ElementParentMap {
  elementId: string;
  parentId: string | null;
}

export interface ValidationSnapshot {
  elements: DiagramElement[];
  boxes: BoundingBox[];
  decl?: any;
  canvas?: { width: number; height: number };
}

export interface SemanticRoleEntry {
  id: string;
  type: string;
  role: string;
  size: number;
  box: BoundingBox | null;
  parentId?: string;
  connectorFrom?: string;
  connectorTo?: string;
  unplaced?: boolean;
}

export const SEMANTIC_ROLE_MIN_SIZE: Record<string, number> = {
  header_title: HEADER_TITLE_MIN,
  section_heading: SECTION_TITLE_MIN,
  card_title: CARD_TITLE_MIN,
  body_text: BODY_TEXT_MIN,
  connector_label: CONNECTOR_LABEL_MIN,
  display_formula: FORMULA_TEXT_MIN,
};

export const OVERLAP_TYPES_ALLOWED = new Set(['line', 'arrow', 'connector', 'embed']);

export const VALIDATABLE_DECLARATION_TYPES = new Set([
  'DiagramDeclaration',
  'FlowDeclaration',
  'ChartDeclaration',
  'TableDeclaration',
  'ErdDeclaration',
  'InfraDeclaration',
  'Plot3dDeclaration',
  'Scene3dDeclaration',
  'PageDeclaration',
]);

export const NEEDS_RELAYOUT_TYPES = new Set([
  'DiagramDeclaration',
  'FlowDeclaration',
  'ErdDeclaration',
  'InfraDeclaration',
  'PageDeclaration',
]);

export const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

export function isValidatableDeclaration(declType: string): boolean {
  return VALIDATABLE_DECLARATION_TYPES.has(declType);
}

export function needsRelayout(declType: string): boolean {
  return NEEDS_RELAYOUT_TYPES.has(declType);
}
