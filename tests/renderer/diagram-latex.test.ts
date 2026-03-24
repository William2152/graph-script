import { Parser } from '../../src/parser';
import { Evaluator } from '../../src/runtime';
import { DiagramDeclaration } from '../../src/ast/types';
import { renderDiagram } from '../../src/renderer/diagram';

async function render(source: string): Promise<string> {
  const parser = new Parser();
  const evaluator = new Evaluator();
  const program = parser.parse(source);
  const values = evaluator.execute(program);
  const decl = values.Latex as DiagramDeclaration;
  return renderDiagram(decl, values, evaluator.getTraces(), async () => null, process.cwd());
}

describe('Diagram LaTeX rendering', () => {
  test('renders formula nodes as MathJax SVG fragments', async () => {
    const svg = await render(`diagram "Latex":
  width = 800
  height = 400
  formula eq x=400 y=180 value="\\langle H \\rangle = \\sum_i c_i \\langle P_i \\rangle"
`);

    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<svg x=');
    expect(svg).toContain('P_i');
  });

  test('renders mixed inline math inside text-bearing elements', async () => {
    const svg = await render(`diagram "Latex":
  width = 900
  height = 420
  panel output x=120 y=90 w=660 h=180 label="OUTPUT: Energi Optimal ($E_{opt}$)" subtitle="Parameter optimal ($\\\\theta_{opt}$)"
`);

    expect(svg).toContain('OUTPUT: ');
    expect(svg).toContain('Energi ');
    expect(svg).toContain('Optimal ');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('theta');
  });

  test('auto normalizes shorthand quantum notation for formulas and text', async () => {
    const svg = await render(`diagram "Latex":
  width = 900
  height = 420
  panel output x=120 y=90 w=660 h=180 label="State |psi(theta)>" subtitle="Nilai Ekspektasi <P_i>"
  formula eq x=450 y=320 value="<H> = Sum_i c_i <P_i>"
`);

    expect(svg).toContain('viewBox=');
    expect(svg).toContain('data-latex');
    expect(svg).toContain('\\langle H \\rangle');
    expect(svg).toContain('\\psi');
  });
});
