import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
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
import { planTableLayout, renderTable } from './table';
import { isValidatableDeclaration, validateAndAdjust, writeValidationReport, ValidationReport } from './validator';

export interface RenderOptions {
  outputDir?: string;
  format?: 'svg' | 'png' | 'jpg';
  scale?: number;
  quality?: number;
  fontScale?: number;
  imageScale?: number;
  fillImages?: boolean;
  baseDir?: string;
  skipValidation?: boolean;
  validationReport?: boolean;
}

export class Renderer {
  constructor(private options: RenderOptions = {}) {}

  async render(values: Record<string, GSValue>, traces: Map<string, Trace>, options: RenderOptions = {}): Promise<void> {
    const outputDir = options.outputDir || this.options.outputDir || './output';
    const baseDir = options.baseDir || this.options.baseDir || process.cwd();
    const skipValidation = options.skipValidation ?? this.options.skipValidation ?? false;
    const generateReport = options.validationReport ?? this.options.validationReport ?? false;
    const format = options.format ?? this.options.format ?? 'svg';
    const scale = options.scale ?? this.options.scale ?? 1;
    const quality = options.quality ?? this.options.quality ?? 90;
    const fontScale = options.fontScale ?? this.options.fontScale ?? 1;
    const imageScale = options.imageScale ?? this.options.imageScale ?? 1;
    const fillImages = options.fillImages ?? this.options.fillImages ?? false;

    fs.mkdirSync(outputDir, { recursive: true });

    for (const [name, value] of Object.entries(values)) {
      if (!value || typeof value !== 'object') continue;
      const decl = value as any;

      let declToRender = decl;
      let report: ValidationReport | null = null;

      if (!skipValidation && isValidatableDeclaration(decl.type)) {
        const result = await validateAndAdjust(decl, values, traces);
        declToRender = result.adjustedDecl;
        report = result.report;

        if (!result.validation.valid || generateReport) {
          const reportPath = path.join(outputDir, `${sanitizeFileName(decl.name || name)}-validation.json`);
          writeValidationReport(report, reportPath, decl.name || name);

          if (!result.validation.valid) {
            console.warn(`⚠ Validation issues in "${decl.name || name}". See: ${reportPath}`);
          }
        }
      }

      const svg = await this.renderDeclaration(name, declToRender, values, traces, baseDir, { fontScale, imageScale, fillImages });
      if (!svg) continue;
      await this.writeOutput(declToRender.name || name, svg, outputDir, declToRender.type.replace('Declaration', '').toLowerCase(), format, scale, quality);
    }
  }

  async renderDeclaration(name: string, decl: any, values: Record<string, GSValue>, traces: Map<string, Trace>, baseDir: string = this.options.baseDir || process.cwd(), renderOptions: { fontScale?: number; imageScale?: number; fillImages?: boolean } = {}): Promise<string | null> {
    if (!decl || typeof decl !== 'object') return null;
    switch (decl.type) {
      case 'ChartDeclaration': {
        const series = buildChartSeries(decl as ChartDeclaration, values, traces);
        const config = extractChartConfig(decl as ChartDeclaration, values, traces, series);
        return series.length ? renderChart(config, series) : null;
      }
      case 'FlowDeclaration':
        return renderFlow(layoutFlow(decl as FlowDeclaration), (decl as FlowDeclaration).name || name);
      case 'TableDeclaration':
        return renderTable(planTableLayout(decl as TableDeclaration, values, traces));
      case 'Plot3dDeclaration': {
        const { config, series } = buildPlot3d(decl as Plot3dDeclaration, values, traces);
        return series ? renderPlot3d(config, series) : null;
      }
      case 'PseudoDeclaration':
        return renderPseudoBlock(decl as PseudoDeclaration);
      case 'DiagramDeclaration':
        return await renderDiagram(
          decl as DiagramDeclaration,
          values,
          traces,
          async (target) => this.findAndRenderTarget(target, values, traces, baseDir, renderOptions),
          baseDir,
          renderOptions,
        );
      case 'Scene3dDeclaration':
        return renderScene3d(decl as Scene3dDeclaration, values, traces);
      case 'ErdDeclaration':
        return renderErd(decl as ErdDeclaration, values, traces);
      case 'InfraDeclaration':
        return renderInfra(decl as InfraDeclaration, values, traces);
      case 'PageDeclaration':
        return await renderPage(decl as PageDeclaration, values, traces, async (target) => this.findAndRenderTarget(target, values, traces, baseDir, renderOptions), renderOptions);
      default:
        return null;
    }
  }

  private async findAndRenderTarget(target: string, values: Record<string, GSValue>, traces: Map<string, Trace>, baseDir: string, renderOptions: { fontScale?: number; imageScale?: number; fillImages?: boolean } = {}): Promise<string | null> {
    const direct = values[target];
    if (direct && typeof direct === 'object') {
      return this.renderDeclaration(target, direct, values, traces, baseDir, renderOptions);
    }

    for (const [name, value] of Object.entries(values)) {
      if (value && typeof value === 'object' && (value as any).name === target) {
        return this.renderDeclaration(name, value, values, traces, baseDir, renderOptions);
      }
    }
    return null;
  }

  private async writeOutput(name: string, svg: string, outputDir: string, kind: string, format: 'svg' | 'png' | 'jpg', scale: number, quality: number): Promise<void> {
    const baseName = sanitizeFileName(name);
    
    if (format === 'svg') {
      const outputPath = path.join(outputDir, `${baseName}.svg`);
      fs.writeFileSync(outputPath, svg, 'utf-8');
      console.log(`Rendered ${kind}: ${outputPath}`);
      return;
    }

    try {
      const width = this.extractSvgWidth(svg);
      const height = this.extractSvgHeight(svg);
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      let sharpInstance = sharp(Buffer.from(svg)).resize(scaledWidth, scaledHeight);

      if (format === 'png') {
        const outputPath = path.join(outputDir, `${baseName}.png`);
        await sharpInstance.png().toFile(outputPath);
        console.log(`Rendered ${kind}: ${outputPath}`);
      } else if (format === 'jpg') {
        const outputPath = path.join(outputDir, `${baseName}.jpg`);
        await sharpInstance.jpeg({ quality }).toFile(outputPath);
        console.log(`Rendered ${kind}: ${outputPath}`);
      }
    } catch (error) {
      console.error(`Error converting to ${format}:`, error);
      const outputPath = path.join(outputDir, `${baseName}.svg`);
      fs.writeFileSync(outputPath, svg, 'utf-8');
      console.log(`Fallback to SVG: ${outputPath}`);
    }
  }

  private extractSvgWidth(svg: string): number {
    const match = svg.match(/width="(\d+)"/);
    return match ? parseInt(match[1], 10) : 800;
  }

  private extractSvgHeight(svg: string): number {
    const match = svg.match(/height="(\d+)"/);
    return match ? parseInt(match[1], 10) : 600;
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'output';
}
