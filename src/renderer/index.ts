import * as fs from 'fs';
import * as path from 'path';
import { FlowDeclaration, ChartDeclaration, TableDeclaration, Plot3dDeclaration } from '../ast/types';
import { GSValue, Trace } from '../runtime/values';
import { renderBarChart, renderLineChart, extractChartConfig, extractDataSeries } from './chart';
import { layoutFlow, renderFlow } from './flow';
import { buildTableData, renderTable } from './table';
import { buildPlot3d, renderPlot3d } from './plot3d';

export interface RenderOptions {
  outputDir?: string;
  format?: 'svg';
}

export class Renderer {
  private outputDir: string;

  constructor(options: RenderOptions = {}) {
    this.outputDir = options.outputDir || './output';
  }

  render(
    values: Record<string, GSValue>,
    traces: Map<string, Trace>,
    options: RenderOptions = {}
  ): void {
    const outputDir = options.outputDir || this.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [name, value] of Object.entries(values)) {
      if (value && typeof value === 'object') {
        const decl = value as any;

        if (decl.type === 'FlowDeclaration') {
          this.renderFlow(name, decl as FlowDeclaration, outputDir);
        } else if (decl.type === 'ChartDeclaration') {
          this.renderChart(name, decl as ChartDeclaration, values, traces, outputDir);
        } else if (decl.type === 'TableDeclaration') {
          this.renderTable(name, decl as TableDeclaration, values, traces, outputDir);
        } else if (decl.type === 'Plot3dDeclaration') {
          this.renderPlot3d(name, decl as Plot3dDeclaration, values, traces, outputDir);
        }
      }
    }

    for (const [name, trace] of traces.entries()) {
      if (trace.rows.length > 0) {
        const chartDecl: ChartDeclaration = {
          type: 'ChartDeclaration',
          name,
          properties: {},
          location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } }
        };

        this.renderTraceChart(name, trace, chartDecl, outputDir);
      }
    }
  }

  private renderFlow(name: string, flow: FlowDeclaration, outputDir: string): void {
    const layout = layoutFlow(flow);
    const svg = renderFlow(layout, flow.name || name);

    const outputPath = path.join(outputDir, `${name}.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered flow: ${outputPath}`);
  }

  private renderChart(
    name: string,
    chart: ChartDeclaration,
    values: Record<string, GSValue>,
    traces: Map<string, Trace>,
    outputDir: string
  ): void {
    const config = extractChartConfig(chart, values);
    const series: { name: string; values: number[] }[] = [];

    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
        series.push({ name: key, values: value as number[] });
      }
    }

    if (series.length === 0) return;

    let svg: string;
    if (config.type === 'line') {
      svg = renderLineChart(config, series);
    } else {
      svg = renderBarChart(config, series);
    }

    const outputPath = path.join(outputDir, `${name}.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered chart: ${outputPath}`);
  }

  private renderTraceChart(
    name: string,
    trace: Trace,
    chart: ChartDeclaration,
    outputDir: string
  ): void {
    if (trace.rows.length === 0) return;

    const columns = trace.columns;
    const series: { name: string; values: number[] }[] = [];

    for (const col of columns) {
      const values: number[] = [];
      for (const row of trace.rows) {
        const val = row[col];
        if (typeof val === 'number') {
          values.push(val);
        }
      }
      if (values.length > 0) {
        series.push({ name: col, values });
      }
    }

    if (series.length === 0) return;

    const typeProp = chart.properties['type'] as any;
    const chartType = typeProp?.name || 'bar';

    const config = {
      width: 800,
      height: 400,
      type: chartType as 'bar' | 'line' | 'scatter' | 'pie'
    };

    let svg: string;
    if (chartType === 'line') {
      svg = renderLineChart(config, series);
    } else {
      svg = renderBarChart(config, series);
    }

    const outputPath = path.join(outputDir, `${name}-trace.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered trace chart: ${outputPath}`);
  }

  private renderTable(
    name: string,
    table: TableDeclaration,
    values: Record<string, GSValue>,
    traces: Map<string, Trace>,
    outputDir: string
  ): void {
    const tableData = buildTableData(table, values, traces);
    if (tableData.columns.length === 0 && tableData.rows.length === 0) return;

    const svg = renderTable(tableData);
    const outputPath = path.join(outputDir, `${name}.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered table: ${outputPath}`);
  }

  private renderPlot3d(
    name: string,
    plot3d: Plot3dDeclaration,
    values: Record<string, GSValue>,
    traces: Map<string, Trace>,
    outputDir: string
  ): void {
    const { config, series } = buildPlot3d(plot3d, values, traces);
    if (!series) return;

    const svg = renderPlot3d(config, series);
    const outputPath = path.join(outputDir, `${name}.svg`);
    fs.writeFileSync(outputPath, svg, 'utf-8');
    console.log(`Rendered plot3d: ${outputPath}`);
  }
}
