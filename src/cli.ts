#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './parser';
import { Evaluator } from './runtime';
import { Renderer } from './renderer';

interface CliOptions {
  command: 'check' | 'run' | 'render';
  file: string;
  outputDir?: string;
}

function parseArgs(args: string[]): CliOptions | null {
  const [command, file, ...rest] = args;
  if (!command || !file) return null;
  if (!['check', 'run', 'render'].includes(command)) return null;

  let outputDir: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--output' || rest[i] === '-o') {
      outputDir = rest[i + 1];
      i += 1;
    }
  }

  return { command: command as CliOptions['command'], file, outputDir };
}

function printUsage(): void {
  console.log(`
GraphScript CLI - Composable Visual Scripting Language

Usage:
  graphscript <command> <file> [options]

Commands:
  check <file.gs>     Parse and validate the file
  run <file.gs>       Run algorithms and display traces
  render <file.gs>    Render charts and flows to SVG

Options:
  --output <dir>      Output directory for render command (default: ./output)
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
  const baseDir = path.dirname(path.resolve(options.file));
  try {
    const parser = new Parser();
    const program = parser.parse(source);
    console.log('✓ Parse: OK');

    if (options.command === 'check') {
      console.log('✓ Validation: OK');
      return;
    }

    const evaluator = new Evaluator();
    const values = evaluator.execute(program);
    console.log('✓ Execution: OK');

    if (options.command === 'run') {
      const traces = evaluator.getTraces();
      if (traces.size === 0) console.log('\nNo algorithm traces found.');
      for (const [name, trace] of traces.entries()) {
        if (!trace.rows.length) continue;
        console.log(`\nTrace: ${name}`);
        console.log(trace.columns.join('\t'));
        for (const row of trace.rows) {
          console.log(trace.columns.map((column) => String(row[column] ?? '')).join('\t'));
        }
      }
      return;
    }

    const renderer = new Renderer({ outputDir: options.outputDir || './output', baseDir });
    console.log('\nRendering...');
    renderer.render(values, evaluator.getTraces(), { outputDir: options.outputDir || './output', baseDir });
    console.log('✓ Render: Complete');
  } catch (error: any) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
}

main(process.argv.slice(2));
