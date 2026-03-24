import * as fs from 'fs';
import * as path from 'path';
import {
  ChartDeclaration,
  DiagramDeclaration,
  ErdDeclaration,
  FlowDeclaration,
  InfraDeclaration,
  PageDeclaration,
  Plot3dDeclaration,
  PseudoDeclaration,
  Scene3dDeclaration,
  TableDeclaration,
} from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { buildChartSeries, extractChartConfig, renderChart } from './chart';
import { renderDiagram } from './diagram';
import { renderErd } from './erd';
import { layoutFlow, renderFlow } from './flow';
import { renderInfra } from './infra';
import { renderPage } from './page';
import { buildPlot3d, renderPlot3d } from './plot3d';
import { renderPseudoBlock } from './pseudo';
import { renderScene3d } from './scene3d';
import { buildTableData, renderTable } from './table';

export interface RenderOptions {
  outputDir?: string;
  format?: 'svg';
  baseDir?: string;
}

export class Renderer {
  constructor(private options: RenderOptions = {}) {}

  render(values: Record<string, GSValue>, traces: Map<string, Trace>, options: RenderOptions = {}): void {
    const outputDir = options.outputDir || this.options.outputDir || './output';
    const baseDir = options.baseDir || this.options.baseDir || process.cwd();
    fs.mkdirSync(outputDir, { recursive: true });

    for (const [name, value] of Object.entries(values)) {
      if (!value || typeof value !== 'object') continue;
      const decl = value as any;
      const svg = this.renderDeclaration(name, decl, values, traces, baseDir);
      if (!svg) continue;
      this.writeSvg(decl.name || name, svg, outputDir, decl.type.replace('Declaration', '').toLowerCase());
    }
  }

  renderDeclaration(name: string, decl: any, values: Record<string, GSValue>, traces: Map<string, Trace>, baseDir: string = this.options.baseDir || process.cwd()): string | null {
    if (!decl || typeof decl !== 'object') return null;
    switch (decl.type) {
      case 'ChartDeclaration': {
        const config = extractChartConfig(decl as ChartDeclaration, values, traces);
        const series = buildChartSeries(decl as ChartDeclaration, values, traces);
        return series.length ? renderChart(config, series) : null;
      }
      case 'FlowDeclaration':
        return renderFlow(layoutFlow(decl as FlowDeclaration), (decl as FlowDeclaration).name || name);
      case 'TableDeclaration':
        return renderTable(buildTableData(decl as TableDeclaration, values, traces));
      case 'Plot3dDeclaration': {
        const { config, series } = buildPlot3d(decl as Plot3dDeclaration, values, traces);
        return series ? renderPlot3d(config, series) : null;
      }
      case 'PseudoDeclaration':
        return renderPseudoBlock(decl as PseudoDeclaration);
      case 'DiagramDeclaration':
        return renderDiagram(
          decl as DiagramDeclaration,
          values,
          traces,
          (target) => this.findAndRenderTarget(target, values, traces, baseDir),
          baseDir,
        );
      case 'Scene3dDeclaration':
        return renderScene3d(decl as Scene3dDeclaration, values, traces);
      case 'ErdDeclaration':
        return renderErd(decl as ErdDeclaration);
      case 'InfraDeclaration':
        return renderInfra(decl as InfraDeclaration, values, traces);
      case 'PageDeclaration':
        return renderPage(decl as PageDeclaration, values, traces, (target) => this.findAndRenderTarget(target, values, traces, baseDir));
      default:
        return null;
    }
  }

  private findAndRenderTarget(target: string, values: Record<string, GSValue>, traces: Map<string, Trace>, baseDir: string): string | null {
    const direct = values[target];
    if (direct && typeof direct === 'object') {
      return this.renderDeclaration(target, direct, values, traces, baseDir);
    }

    for (const [name, value] of Object.entries(values)) {
      if (value && typeof value === 'object' && (value as any).name === target) {
        return this.renderDeclaration(name, value, values, traces, baseDir);
      }
    }
    return null;
  }

  private writeSvg(name: string, svg: string, outputDir: string, kind: string): void {
    const outputPath = path.join(outputDir, `${sanitizeFileName(name)}.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered ${kind}: ${outputPath}`);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'output';
}
