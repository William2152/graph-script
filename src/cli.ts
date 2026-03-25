#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Parser } from './parser';
import { Evaluator } from './runtime';
import { Renderer } from './renderer';
import { isValidatableDeclaration, validateAndAdjust, writeValidationReport } from './renderer/validator';

interface CliOptions {
  command: 'check' | 'run' | 'render';
  file: string;
  outputDir?: string;
  skipValidation?: boolean;
  validationReport?: boolean;
  format?: 'svg' | 'png' | 'jpg';
  scale?: number;
  quality?: number;
}

function parseArgs(args: string[]): CliOptions | null {
  const [command, file, ...rest] = args;
  if (!command || !file) return null;
  if (!['check', 'run', 'render'].includes(command)) return null;

  let outputDir: string | undefined;
  let skipValidation = false;
  let validationReport = false;
  let format: 'svg' | 'png' | 'jpg' | undefined;
  let scale: number | undefined;
  let quality: number | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--output' || rest[i] === '-o') {
      outputDir = rest[i + 1];
      i += 1;
    } else if (rest[i] === '--skip-validation') {
      skipValidation = true;
    } else if (rest[i] === '--validation-report') {
      validationReport = true;
    } else if (rest[i] === '--format') {
      const fmt = rest[i + 1];
      if (['svg', 'png', 'jpg'].includes(fmt)) {
        format = fmt as 'svg' | 'png' | 'jpg';
      }
      i += 1;
    } else if (rest[i] === '--scale') {
      const s = parseFloat(rest[i + 1]);
      if (!isNaN(s) && s > 0) {
        scale = s;
      }
      i += 1;
    } else if (rest[i] === '--quality') {
      const q = parseInt(rest[i + 1], 10);
      if (!isNaN(q) && q >= 1 && q <= 100) {
        quality = q;
      }
      i += 1;
    }
  }

  return { command: command as CliOptions['command'], file, outputDir, skipValidation, validationReport, format, scale, quality };
}

function printUsage(): void {
  console.log(`
GraphScript CLI - Composable Visual Scripting Language

Usage:
  graphscript <command> <file> [options]

Commands:
  check <file.gs>     Parse, validate, and check readability
  run <file.gs>       Run algorithms and display traces
  render <file.gs>    Render charts and flows (with auto-validation)

Options:
  --output <dir>           Output directory for render command (default: ./output)
  --skip-validation        Skip overlap validation during render
  --validation-report      Generate detailed validation JSON report
  --format <svg|png|jpg>  Output format (default: svg)
  --scale <number>         Scale factor for PNG/JPG (default: 1)
  --quality <1-100>        JPEG quality (default: 90)

Examples:
  graphscript check demo.gs
  graphscript run demo.gs
  graphscript render demo.gs -o ./dist
  graphscript render demo.gs --format png
  graphscript render demo.gs --format jpg --quality 80
  graphscript render demo.gs --format png --scale 2
  graphscript render demo.gs --validation-report
  graphscript render demo.gs --skip-validation
`);
}

async function main(args: string[]): Promise<void> {
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
  const outputDir = options.outputDir || './output';

  try {
    const parser = new Parser();
    const program = parser.parse(source);
    console.log('✓ Parse: OK');

    const evaluator = new Evaluator();
    const values = evaluator.execute(program);
    console.log('✓ Execution: OK');

    if (options.command === 'check') {
      console.log('\n--- Validation Report ---');

      let hasIssues = false;
      const traces = evaluator.getTraces();

      for (const [name, value] of Object.entries(values)) {
        if (!value || typeof value !== 'object') continue;
        const decl = value as any;

        if (isValidatableDeclaration(decl.type)) {
          const elements = decl.elements || [];
          if (elements.length > 0) {
            const result = await validateAndAdjust(decl, values, traces, 0);
            const validation = result.validation;
            const report = result.report;

            console.log(`\n${decl.name || name} (${decl.type}):`);
            console.log(`  Readability Score: ${validation.readabilityScore}/100`);
            console.log(`  Elements: ${report.metrics.elementCount}`);
            console.log(`  Min Font Size: ${report.metrics.minFontSize}px`);
            console.log(`  Min Element Size: ${report.metrics.minElementSize}px`);

            if (validation.issues.length > 0) {
              const errors = validation.issues.filter(i => i.severity === 'error');
              const warnings = validation.issues.filter(i => i.severity === 'warning');
              const infos = validation.issues.filter(i => i.severity === 'info');

              if (errors.length > 0) hasIssues = true;

              if (errors.length > 0) console.log(`  Errors: ${errors.length}`);
              if (warnings.length > 0) console.log(`  Warnings: ${warnings.length}`);
              if (infos.length > 0) console.log(`  Info: ${infos.length}`);

              validation.issues.slice(0, 5).forEach(issue => {
                console.log(`    - ${issue.element1.id} ↔ ${issue.element2.id}: ${issue.overlapPercentage}% overlap`);
              });

              if (validation.issues.length > 5) {
                console.log(`    ... and ${validation.issues.length - 5} more issues`);
              }
            } else {
              console.log(`  ✓ No overlap issues`);
            }

            if (options.validationReport) {
              fs.mkdirSync(outputDir, { recursive: true });
              const reportPath = path.join(outputDir, `${sanitizeFileName(decl.name || name)}-validation.json`);
              writeValidationReport(report, reportPath, decl.name || name);
              console.log(`  Report: ${reportPath}`);
            }
          }
        }
      }

      if (!hasIssues) {
        console.log('\n✓ Validation: OK - No issues found');
      } else {
        console.log('\n⚠ Validation: Issues detected (see above)');
      }
      return;
    }

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

    const renderer = new Renderer({
      outputDir,
      baseDir,
      skipValidation: options.skipValidation,
      validationReport: options.validationReport,
      format: options.format,
      scale: options.scale,
      quality: options.quality,
    });
    console.log('\nRendering...');
    await renderer.render(values, evaluator.getTraces(), {
      outputDir,
      baseDir,
      skipValidation: options.skipValidation,
      validationReport: options.validationReport,
      format: options.format,
      scale: options.scale,
      quality: options.quality,
    });
    console.log('✓ Render: Complete');
  } catch (error: any) {
    console.error(`\n✗ Error: ${error.message}`);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'output';
}

main(process.argv.slice(2));
