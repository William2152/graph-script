#!/usr/bin/env ts-node

import { readdirSync, readFileSync, statSync } from 'fs';
import * as path from 'path';

type ViolationKind = 'new-over-limit' | 'missing-allowlist';

interface Violation {
  file: string;
  lines: number;
  kind: ViolationKind;
}

/**
 * Guardrail anti-regression untuk memastikan file TypeScript tidak tumbuh tak terkendali.
 *
 * Rule permanen:
 * - file sumber `.ts` wajib <= MAX_LINES
 * - file lama yang belum direfactor masuk ALLOWLIST sementara
 * - file baru yang melampaui batas akan gagal
 */
const MAX_LINES = 300;
const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['src', 'packages'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);

/**
 * Temporary allowlist:
 * daftar ini harus terus mengecil seiring refactor berlangsung.
 * Jangan menambahkan file baru tanpa justifikasi teknis.
 */
const ALLOWLIST = new Set<string>([
]);

function toRepoRelative(absolutePath: string): string {
  return path.relative(ROOT, absolutePath);
}

function normalizeWindowsPath(relPath: string): string {
  return relPath.split('/').join('\\');
}

function isTsSourceFile(filePath: string): boolean {
  return filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
}

function countLines(filePath: string): number {
  const text = readFileSync(filePath, 'utf8');
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function walkTsFiles(dirPath: string, output: string[]): void {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      walkTsFiles(fullPath, output);
      continue;
    }
    if (stat.isFile() && isTsSourceFile(fullPath)) {
      output.push(fullPath);
    }
  }
}

function main(): void {
  const files: string[] = [];
  for (const targetDir of TARGET_DIRS) {
    const absolute = path.join(ROOT, targetDir);
    walkTsFiles(absolute, files);
  }

  const violations: Violation[] = [];
  const resolvedAllowlistEntries: string[] = [];

  for (const file of files) {
    const rel = normalizeWindowsPath(toRepoRelative(file));
    const lines = countLines(file);
    const inAllowlist = ALLOWLIST.has(rel);

    if (lines > MAX_LINES && !inAllowlist) {
      violations.push({ file: rel, lines, kind: 'new-over-limit' });
    }

    if (lines <= MAX_LINES && inAllowlist) {
      resolvedAllowlistEntries.push(rel);
    }
  }

  for (const allowlistedPath of ALLOWLIST) {
    const abs = path.join(ROOT, allowlistedPath);
    let exists = false;
    try {
      exists = statSync(abs).isFile();
    } catch {
      exists = false;
    }
    if (!exists) {
      violations.push({ file: allowlistedPath, lines: 0, kind: 'missing-allowlist' });
    }
  }

  if (resolvedAllowlistEntries.length) {
    console.log('Resolved allowlist entries (safe to remove):');
    for (const rel of resolvedAllowlistEntries.sort()) {
      console.log(`  - ${rel}`);
    }
    console.log('');
  }

  if (!violations.length) {
    console.log(`PASS: max-lines guard OK (limit=${MAX_LINES}).`);
    return;
  }

  console.error(`FAIL: max-lines guard found ${violations.length} issue(s):`);
  for (const issue of violations) {
    if (issue.kind === 'new-over-limit') {
      console.error(`  - [OVER] ${issue.file} (${issue.lines} lines > ${MAX_LINES})`);
    } else {
      console.error(`  - [MISSING] ${issue.file} exists in allowlist but file not found`);
    }
  }
  process.exit(1);
}

main();
