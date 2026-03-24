import { Parser } from '@graphscript/parser';

describe('Parser', () => {
  test('parses simple data declaration', () => {
    const parser = new Parser();
    const program = parser.parse(`data:
  x = 1
  y = 2
`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('DataDeclaration');
  });

  test('parses constant declaration', () => {
    const parser = new Parser();
    const program = parser.parse(`const x = 10`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('ConstDeclaration');
  });

  test('parses use statement', () => {
    const parser = new Parser();
    const program = parser.parse(`use chart`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('UseStatement');
  });

  test('parses chart declaration', () => {
    const parser = new Parser();
    const program = parser.parse(`chart "Test":
  type = line
  x = [1, 2, 3]
  y = [4, 5, 6]
`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('ChartDeclaration');
  });

  test('parses algorithm with emit', () => {
    const parser = new Parser();
    const program = parser.parse(`algo Test(arr):
  x = 1
  emit:
    x = x
`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('AlgoDeclaration');
  });

  test('parses flow declaration with nodes', () => {
    const parser = new Parser();
    const program = parser.parse(`flow "Test":
  node a type=start
  node b type=end
  a -> b
`);
    expect(program.body.length).toBe(1);
    expect(program.body[0].type).toBe('FlowDeclaration');
  });
});
