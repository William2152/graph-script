import {
  extractBoundingBoxes,
  detectOverlaps,
  calculateOverlap,
  calculateReadability,
  calculateReadabilityScore,
  isIntendedOverlap,
  validateAndAdjust,
  validateDiagram,
  isValidatableDeclaration,
  needsRelayout,
  MIN_FONT_SIZE,
  MIN_ELEMENT_SIZE,
  BoundingBox,
  ReadabilityMetrics,
} from '../../src/renderer/validator';
import { DiagramElement } from '../../src/ast/types';
import { GSValue, Trace } from '../../src/runtime/values';

const ZERO_LOC = {
  start: { line: 0, column: 0, offset: 0 },
  end: { line: 0, column: 0, offset: 0 },
};

function makeElement(
  name: string,
  type: string,
  props: Record<string, any>,
  children?: DiagramElement[],
): DiagramElement {
  const properties: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    properties[key] = { type: 'Literal', value, location: ZERO_LOC };
  }
  return { name, type, properties, ...(children ? { children } : {}) };
}

function makeValues(): Record<string, GSValue> {
  return {};
}

function makeTraces(): Map<string, Trace> {
  return new Map();
}

describe('Validator', () => {
  test('recognizes validatable and relayout declaration types', () => {
    expect(isValidatableDeclaration('DiagramDeclaration')).toBe(true);
    expect(isValidatableDeclaration('FlowDeclaration')).toBe(true);
    expect(isValidatableDeclaration('UnknownDeclaration')).toBe(false);
    expect(needsRelayout('DiagramDeclaration')).toBe(true);
    expect(needsRelayout('ChartDeclaration')).toBe(false);
  });

  test('extracts bounding boxes from nested children', () => {
    const elements: DiagramElement[] = [
      makeElement('container', 'panel', { x: 100, y: 100, w: 400, h: 300 }, [
        makeElement('child1', 'box', { x: 20, y: 40, w: 150, h: 80 }),
        makeElement('child2', 'box', { x: 200, y: 40, w: 150, h: 80 }),
      ]),
    ];

    const boxes = extractBoundingBoxes(elements, makeValues(), makeTraces());
    expect(boxes).toHaveLength(3);
    expect(boxes[1].x).toBe(120);
    expect(boxes[1].y).toBe(140);
  });

  test('detects overlapping boxes', () => {
    const boxes: BoundingBox[] = [
      { id: 'box1', type: 'box', x: 0, y: 0, width: 100, height: 100, allowOverlap: false },
      { id: 'box2', type: 'box', x: 50, y: 50, width: 100, height: 100, allowOverlap: false },
    ];
    const issues = detectOverlaps(boxes);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].kind).toBe('overlap');
  });

  test('calculates overlap and readability metrics', () => {
    const a: BoundingBox = { id: 'a', type: 'box', x: 0, y: 0, width: 100, height: 100, allowOverlap: false };
    const b: BoundingBox = { id: 'b', type: 'box', x: 50, y: 50, width: 100, height: 100, allowOverlap: false };
    const overlap = calculateOverlap(a, b);
    expect(overlap.area).toBe(2500);
    expect(overlap.percentage).toBe(25);

    const elements: DiagramElement[] = [
      makeElement('text1', 'text', { x: 0, y: 0, size: 16, value: 'Hello' }),
      makeElement('box1', 'box', { x: 0, y: 0, w: 100, h: 60 }),
    ];
    const metrics = calculateReadability(elements, makeValues(), makeTraces());
    expect(metrics.minFontSize).toBe(16);
    expect(metrics.minElementSize).toBe(60);
  });

  test('penalizes poor readability and keeps minimum defaults', () => {
    const emptyMetrics = calculateReadability([], makeValues(), makeTraces());
    expect(emptyMetrics.minFontSize).toBe(MIN_FONT_SIZE);
    expect(emptyMetrics.minElementSize).toBe(MIN_ELEMENT_SIZE);

    const weak: ReadabilityMetrics = {
      minFontSize: 10,
      avgFontSize: 12,
      minElementSize: 18,
      density: 10000,
      elementCount: 64,
    };
    expect(calculateReadabilityScore(weak)).toBeLessThan(100);
    expect(calculateReadabilityScore(weak, [{
      kind: 'tight_gap',
      element1: { id: 'a', type: 'box' },
      element2: { id: 'b', type: 'box' },
      overlapArea: 0,
      overlapPercentage: 0,
      severity: 'warning',
      location: { x: 0, y: 0, width: 10, height: 10 },
      message: 'Gap too small',
    }])).toBeLessThan(calculateReadabilityScore(weak));
  });

  test('treats transparent and explicit overlaps as intended', () => {
    const transparent = makeElement('transparent', 'box', { x: 0, y: 0, w: 100, h: 80, fillOpacity: 0.3 });
    const explicit = makeElement('allowed', 'box', { x: 0, y: 0, w: 100, h: 80, allow_overlap: true });
    const normal = makeElement('normal', 'box', { x: 0, y: 0, w: 100, h: 80 });
    expect(isIntendedOverlap(transparent, makeValues(), makeTraces(), null)).toBe(true);
    expect(isIntendedOverlap(explicit, makeValues(), makeTraces(), null)).toBe(true);
    expect(isIntendedOverlap(normal, makeValues(), makeTraces(), null)).toBe(false);
  });

  test('validateAndAdjust and validateDiagram are async and detect issues', async () => {
    const decl = {
      type: 'DiagramDeclaration',
      name: 'test',
      properties: {},
      elements: [
        makeElement('box1', 'box', { x: 50, y: 50, w: 200, h: 100 }),
        makeElement('box2', 'box', { x: 100, y: 80, w: 200, h: 100 }),
      ],
    };

    const adjusted = await validateAndAdjust(decl, makeValues(), makeTraces());
    expect(adjusted.validation.issues.length).toBeGreaterThan(0);
    expect(adjusted.report).toBeDefined();

    const validation = await validateDiagram(decl, makeValues(), makeTraces());
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.kind === 'overlap')).toBe(true);
  });
});
