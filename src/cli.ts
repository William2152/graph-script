#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './parser';
import { Evaluator } from './runtime';
import { Renderer } from './renderer';

interface CliOptions {
  command: string;
  file: string;
  outputDir?: string;
}

function parseArgs(args: string[]): CliOptions | null {
  const command = args[0];
  const file = args[1];

  if (!command || !file) {
    return null;
  }

  if (!['check', 'run', 'render'].includes(command)) {
    return null;
  }

  return { command, file };
}

function printUsage(): void {
  console.log(`
GraphScript CLI - Composable Visual Scripting Language

Usage:
  graphscript <command> <file> [options]

Commands:
  check <file.gs>    Parse and validate the file
  run <file.gs>       Run algorithms and display traces
  render <file.gs>    Render charts and flows to SVG

Options:
  --output <dir>      Output directory for render command (default: ./output)

Examples:
  graphscript check examples/hello-chart.gs
  graphscript run examples/hello-chart.gs
  graphscript render examples/hello-chart.gs --output ./output
`);
}

function main(args: string[]): void {
  const options = parseArgs(args);

  if (!options) {
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(options.file)) {
    console.error(`Error: File not found: ${options.file}`);
    process.exit(1);
  }

  const source = fs.readFileSync(options.file, 'utf-8');

  try {
    const parser = new Parser();
    const program = parser.parse(source);
    console.log('✓ Parse: OK');

    if (options.command === 'check') {
      console.log('✓ Validation: OK');
      process.exit(0);
    }

    const evaluator = new Evaluator();
    const values = evaluator.execute(program);
    console.log('✓ Execution: OK');

    if (options.command === 'run') {
      const traces = evaluator.getTraces();

      if (traces.size === 0) {
        console.log('\nNo algorithm traces found.');
      }

      for (const [name, trace] of traces.entries()) {
        if (trace.rows.length > 0) {
          console.log(`\nTrace: ${name}`);
          console.log(trace.columns.join('\t'));
          for (const row of trace.rows) {
            console.log(Object.values(row).join('\t'));
          }
        }
      }
    }

    if (options.command === 'render') {
      const traces = evaluator.getTraces();
      const renderer = new Renderer({ outputDir: options.outputDir || './output' });

      console.log('\nRendering...');
      renderer.render(values, traces, { outputDir: options.outputDir || './output' });
      console.log('✓ Render: Complete');
    }

  } catch (error: any) {
    console.error(`\n✗ Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main(process.argv.slice(2));
