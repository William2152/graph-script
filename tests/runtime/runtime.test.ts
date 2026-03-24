import { Parser } from '@graphscript/parser';
import { Evaluator } from '@graphscript/runtime';

describe('Runtime', () => {
  test('evaluates simple data', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`data:
  x = 1
  y = 2
`);
    const values = evaluator.execute(program);
    expect(values.x).toBe(1);
    expect(values.y).toBe(2);
  });

  test('evaluates constants', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`const PI = 3.14`);
    const values = evaluator.execute(program);
    expect(values.PI).toBe(3.14);
  });

  test('evaluates expressions', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`data:
  x = 1 + 2
  y = 10 * 5
  z = 2 ^ 3
`);
    const values = evaluator.execute(program);
    expect(values.x).toBe(3);
    expect(values.y).toBe(50);
    expect(values.z).toBe(8);
  });

  test('evaluates function calls', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`data:
  xs = range(0, 5, 1)
`);
    const values = evaluator.execute(program);
    expect(values.xs).toEqual([0, 1, 2, 3, 4]);
  });

  test('runs algorithm with trace', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`algo Sum(arr):
  total = 0
  for x in arr:
    total = total + x
    emit:
      x = x
      total = total

data:
  result = Sum([1, 2, 3])
`);
    const values = evaluator.execute(program);
    const trace = evaluator.getTrace('Sum');
    expect(trace).toBeDefined();
    expect(trace?.rows.length).toBe(3);
  });

  test('uses math functions', () => {
    const parser = new Parser();
    const evaluator = new Evaluator();
    const program = parser.parse(`data:
  s = sin(0)
  c = cos(0)
`);
    const values = evaluator.execute(program);
    expect(values.s).toBeCloseTo(0);
    expect(values.c).toBeCloseTo(1);
  });
});
