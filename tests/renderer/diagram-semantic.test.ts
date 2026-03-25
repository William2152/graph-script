import * as path from 'path';
import { Parser } from '../../src/parser';
import { Evaluator } from '../../src/runtime';
import { DiagramDeclaration } from '../../src/ast/types';
import { compileSemanticDiagram } from '../../src/renderer/diagram-semantic';
import { renderDiagram } from '../../src/renderer/diagram';

function parseAndEval(source: string): { decl: DiagramDeclaration; values: Record<string, unknown>; traces: Map<string, any> } {
  const parser = new Parser();
  const evaluator = new Evaluator();
  const program = parser.parse(source);
  const values = evaluator.execute(program);
  return { decl: values.Semantic as DiagramDeclaration, values, traces: evaluator.getTraces() };
}

describe('Semantic diagram layout', () => {
  test('lays out lanes and cards without overlap', async () => {
    const { decl, values, traces } = parseAndEval(`diagram "Semantic":
  width = 1400
  height = 900
  header top title="Header"
  separator split labels=["Bagian Klasik", "Bagian Kuantum"]
  lane classical section="classical" order=1 ratio=0.45 columns=1
  lane quantum section="quantum" order=2 ratio=0.55 columns=2
  card hamiltonian section="classical" row=1 label="Hamiltonian":
    formula eq value="H = c0 II + c1 ZI"
  card energy section="classical" row=2 label="Energi":
    formula e value="<H> = Sum_i c_i <P_i>"
  card ansatz section="quantum" row=1 col=1 label="Ansatz":
    text prep value="State\\nPreparation"
  card measurement section="quantum" row=1 col=2 label="Measurement":
    text pauli value="Pauli strings"
`);
    const compiled = await compileSemanticDiagram(decl.elements, values as any, traces, 1400, 900);
    const panels = compiled.elements.filter((element) => element.type === 'panel');
    expect(panels.length).toBe(4);

    const first = panels[0].properties;
    const second = panels[1].properties;
    const firstBottom = (first.y as any).value + (first.h as any).value;
    const secondTop = (second.y as any).value;
    expect(firstBottom).toBeLessThan(secondTop);
  });

  test('supports grouped card content with divider and row span', async () => {
    const source = `const ans = image("assets/vqe/ansatz.png")

diagram "Semantic":
  width = 1400
  height = 900
  header top title="Header"
  separator split labels=["A", "B"]
  lane left section="left" order=1 ratio=0.4 columns=1
  lane right section="right" order=2 ratio=0.6 columns=3
  card leftCard section="left" row=1 label="Left":
    text t value="Alpha"
  card measurement section="right" row=1 col=2 span=2 row_span=2 label="Measurement":
    group zBlock layout="stack" gap=10:
      text title value="Basis Z"
      image ans src=ans w=160 h=72 fit="contain" fill="none" stroke="none"
      formula z value="<ZI>, <IZ>, <ZZ>"
    divider cut
    group xBlock layout="stack" gap=10:
      text title value="Basis X"
      formula x value="<XX>"
  card state section="right" row=2 col=1 label="State":
    formula psi value="|psi(theta)>"
`;
    const { decl, values, traces } = parseAndEval(source);
    const compiled = await compileSemanticDiagram(decl.elements, values as any, traces, 1400, 900);
    const measurement = compiled.elements.find((element) => element.type === 'panel' && element.name === 'measurement')!;
    expect((measurement.properties.h as any).value).toBeGreaterThan(360);
    const groupBoxes = measurement.children?.filter((child) => child.name === 'zBlock' || child.name === 'xBlock') ?? [];
    expect(groupBoxes.length).toBe(2);
  });

  test('renders semantic connector as orthogonal segments', async () => {
    const { decl, values, traces } = parseAndEval(`diagram "Semantic":
  width = 1200
  height = 700
  header top title="Header"
  separator split labels=["A", "B"]
  lane left section="left" order=1 columns=1
  lane right section="right" order=2 columns=1
  card a section="left" row=1 label="A":
    text t value="Alpha"
  card b section="right" row=1 label="B":
    text t value="Beta"
  connector link from="a.right" to="b.left" stroke="#2563eb" strokeWidth=4
`);
    const compiled = await compileSemanticDiagram(decl.elements, values as any, traces, 1200, 700);
    const segments = compiled.elements.filter((element) => element.name.startsWith('link-seg-'));
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[segments.length - 1].type).toBe('arrow');
  });

  test('staggered connector corridors avoid reusing the same middle track', async () => {
    const { decl, values, traces } = parseAndEval(`diagram "Semantic":
  width = 1280
  height = 820
  header top title="Header"
  separator split labels=["Left", "Right"]
  lane left section="left" order=1 ratio=0.5 columns=1
  lane right section="right" order=2 ratio=0.5 columns=1
  card a section="left" row=1 label="A":
    text t value="Alpha"
  card b section="left" row=2 label="B":
    text t value="Beta"
  card c section="right" row=1 label="C":
    text t value="Gamma"
  card d section="right" row=2 label="D":
    text t value="Delta"
  connector upper from="a.right" to="d.left" label="Loop A"
  connector lower from="b.right" to="c.left" label="Loop B"
`);

    const compiled = await compileSemanticDiagram(decl.elements, values as any, traces, 1280, 820);
    const upperVertical = compiled.elements
      .filter((element) => element.name.startsWith('upper-seg-'))
      .find((element) => (element.properties.x as any).value === (element.properties.x2 as any).value);
    const lowerVertical = compiled.elements
      .filter((element) => element.name.startsWith('lower-seg-'))
      .find((element) => (element.properties.x as any).value === (element.properties.x2 as any).value);

    expect(upperVertical).toBeDefined();
    expect(lowerVertical).toBeDefined();
    expect((upperVertical!.properties.x as any).value).not.toBe((lowerVertical!.properties.x as any).value);
  });

  test('semantic rendering grows canvas height when needed', async () => {
    const { decl, values, traces } = parseAndEval(`diagram "Semantic":
  width = 1200
  height = 500
  background = "#ffffff"
  header top title="Header"
  separator split labels=["A"]
  lane one section="one" order=1 columns=1
  card c1 section="one" row=1 label="One":
    text v value="Alpha"
  card c2 section="one" row=2 label="Two":
    text v value="Beta"
  card c3 section="one" row=3 label="Three":
    text v value="Gamma"
  card c4 section="one" row=4 label="Four":
    text v value="Delta"
`);
    const svg = await renderDiagram(decl, values as any, traces, async () => null, path.resolve(__dirname, '../../temp'));
    const heightMatch = svg.match(/height="([0-9.]+)"/);
    expect(Number(heightMatch?.[1] ?? 0)).toBeGreaterThan(500);
  });
});
