#!/usr/bin/env bun

import { readFileSync } from 'fs';
import * as path from 'path';
import { Parser } from '../src/parser';
import { Evaluator } from '../src/runtime';
import { Renderer } from '../src/renderer';
import { validateDiagram } from '../src/renderer/validator';

interface SmokeCase {
  name: string;
  file: string;
  declarationName?: string;
  minScore: number;
  width?: number;
  height?: number;
  minFont: number;
}

const repoRoot = path.resolve(import.meta.dir, '..');

const cases: SmokeCase[] = [
  {
    name: 'Figure 4.16',
    file: path.join(repoRoot, 'temp', 'fig-4-16-vqe-measurement.gs'),
    minScore: 100,
    minFont: 18,
  },
  {
    name: 'Semantic Card Smoke',
    file: path.join(repoRoot, 'temp', 'semantic-card-smoke.gs'),
    minScore: 100,
    minFont: 16,
  },
  {
    name: 'Figure 4.18 Direct',
    file: path.join(repoRoot, 'temp', 'qaoa', 'Gambar_4_18_MaxCut_Problem_Statement.gs'),
    declarationName: 'Gambar_4_18_MaxCut_Problem_Statement',
    minScore: 95,
    minFont: 16,
  },
  {
    name: 'Figure 4.18 Page Embed',
    file: path.join(repoRoot, 'temp', 'qaoa', 'Gambar_4_18_MaxCut_Problem_Statement_Page.gs'),
    declarationName: 'Gambar_4_18_Page_Embed',
    minScore: 95,
    minFont: 16,
  },
];

function parseDeclaration(source: string, declarationName?: string): { decl: any; values: Record<string, unknown>; traces: Map<string, unknown> } {
  const parser = new Parser();
  const evaluator = new Evaluator();
  const program = parser.parse(source);
  const values = evaluator.execute(program) as Record<string, unknown>;
  const decl = Object.values(values).find((value) =>
    value
    && typeof value === 'object'
    && (value as { type?: string }).type?.endsWith('Declaration')
    && (!declarationName || (value as { name?: string }).name === declarationName),
  ) as any | undefined;
  if (!decl) throw new Error(`No declaration found${declarationName ? ` for "${declarationName}"` : ''}`);
  return { decl, values, traces: evaluator.getTraces() as Map<string, unknown> };
}

async function runCase(testCase: SmokeCase): Promise<void> {
  const source = readFileSync(testCase.file, 'utf8');
  const { decl, values, traces } = parseDeclaration(source, testCase.declarationName);
  const validation = await validateDiagram(decl, values as any, traces as any);
  if (!validation.valid) {
    throw new Error(`${testCase.name}: validation failed with ${validation.issues.length} issues`);
  }
  if (validation.readabilityScore < testCase.minScore) {
    throw new Error(`${testCase.name}: readability score ${validation.readabilityScore} is below ${testCase.minScore}`);
  }

  const assetBaseDir = path.dirname(testCase.file);
  const renderer = new Renderer({ baseDir: assetBaseDir });
  const svg = await renderer.renderDeclaration(decl.name, decl, values as any, traces as any, assetBaseDir);
  if (!svg) throw new Error(`${testCase.name}: renderer returned no SVG`);
  const sizeMatch = svg.match(/width="([0-9.]+)" height="([0-9.]+)"/);
  if (!sizeMatch) throw new Error(`${testCase.name}: rendered SVG is missing width/height`);

  const width = Number(sizeMatch[1]);
  const height = Number(sizeMatch[2]);
  if (testCase.width != null && width !== testCase.width) {
    throw new Error(`${testCase.name}: expected width ${testCase.width}, got ${width}`);
  }
  if (testCase.height != null && height !== testCase.height) {
    throw new Error(`${testCase.name}: expected height ${testCase.height}, got ${height}`);
  }

  if (!svg.includes('font-family="DejaVu Sans, Arial, sans-serif"')) {
    throw new Error(`${testCase.name}: expected semantic SVG output to use DejaVu Sans default font family`);
  }

  const fontSizes = Array.from(svg.matchAll(/font-size="([0-9.]+)"/g)).map((match) => Number(match[1]));
  const minFont = fontSizes.length ? Math.min(...fontSizes) : 0;
  if (minFont < testCase.minFont) {
    throw new Error(`${testCase.name}: rendered min font size ${minFont} is below ${testCase.minFont}`);
  }

  console.log(`PASS ${testCase.name}: score=${validation.readabilityScore}, size=${width}x${height}, minFont=${minFont}`);
}

async function main(): Promise<void> {
  for (const testCase of cases) {
    await runCase(testCase);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
