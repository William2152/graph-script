import { Expression, SourceLocation, TopLevelNode } from '../ast/types';
import { BasicDeclarationParser } from './declaration-parser-basic';
import { DomainDeclarationParser } from './declaration-parser-domain';
import { VisualDeclarationParser } from './declaration-parser-visual';
import { DeclarationParserOps } from './declaration-ops';
import { LineInfo } from './line-types';
import { LineParserUtils } from './line-utils';
import { StatementBlockParser } from './statement-parser';

type IndexRef = { value: number };

/**
 * High-level declaration parser orchestrator.
 * Delegates grammar-specific branches to dedicated declaration parser modules.
 */
export class DeclarationBlockParser implements DeclarationParserOps {
  private readonly statementParser: StatementBlockParser;
  private readonly basicParser: BasicDeclarationParser;
  private readonly visualParser: VisualDeclarationParser;
  private readonly domainParser: DomainDeclarationParser;

  constructor(
    private lines: LineInfo[],
    private indexRef: IndexRef,
  ) {
    this.statementParser = new StatementBlockParser(lines, indexRef);
    this.basicParser = new BasicDeclarationParser(this);
    this.visualParser = new VisualDeclarationParser(this);
    this.domainParser = new DomainDeclarationParser(this);
  }

  parseTopLevelBlock(indent: number): TopLevelNode[] {
    const nodes: TopLevelNode[] = [];
    while (!this.eof()) {
      const line = this.peekMeaningful();
      if (!line) break;
      if (line.indent < indent) break;
      if (line.indent > indent) {
        this.advanceLine();
        continue;
      }
      nodes.push(this.parseTopLevel(line));
    }
    return nodes;
  }

  parseStatementSuite(parentIndent: number) {
    return this.statementParser.parseStatementSuite(parentIndent);
  }

  peekMeaningful(): LineInfo | null {
    while (this.indexRef.value < this.lines.length) {
      const line = this.lines[this.indexRef.value];
      if (!line.text || line.text.startsWith('#')) {
        this.indexRef.value += 1;
        continue;
      }
      return line;
    }
    return null;
  }

  advanceLine(): void {
    this.indexRef.value += 1;
  }

  eof(): boolean {
    return this.indexRef.value >= this.lines.length;
  }

  nextChildIndent(parentIndent: number): number | null {
    return LineParserUtils.nextChildIndent(this.lines, this.indexRef.value, parentIndent);
  }

  parseExpressionText(text: string, lineNumber: number): Expression {
    return LineParserUtils.parseExpressionText(text, lineNumber);
  }

  parseInlineString(text: string): string {
    return LineParserUtils.parseInlineString(text);
  }

  splitCommaArgs(raw: string): string[] {
    return LineParserUtils.splitCommaArgs(raw);
  }

  lineLoc(line: LineInfo): SourceLocation {
    return LineParserUtils.lineLoc(line);
  }

  parsePropertyBlock(parentIndent: number): Record<string, Expression> {
    const childIndent = this.nextChildIndent(parentIndent);
    const props: Record<string, Expression> = {};
    if (childIndent === null) return props;

    while (!this.eof()) {
      const line = this.peekMeaningful();
      if (!line || line.indent < childIndent) break;
      if (line.indent > childIndent) {
        this.advanceLine();
        continue;
      }
      const match = line.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
      if (match) props[match[1]] = this.parseExpressionText(match[2], line.line);
      this.advanceLine();
    }

    return props;
  }

  isPropertyLine(text: string): boolean {
    return /^[A-Za-z_][\w]*\s*=\s*.+$/.test(text);
  }

  splitHeaderAndChildren(text: string): { header: string; hasChildren: boolean } {
    const trimmed = text.trim();
    if (trimmed.endsWith(':')) {
      return { header: trimmed.slice(0, -1).trim(), hasChildren: true };
    }
    return { header: trimmed, hasChildren: false };
  }

  parseAttributeExpressions(raw: string, lineNumber: number): Record<string, Expression> {
    const attrs: Record<string, Expression> = {};
    const regex = /([A-Za-z_][\w]*)\s*=\s*("[^"]*"|'[^']*'|\[[^\]]*\]|\{[^\}]*\}|\([^\)]*\)|[^\s]+)/g;
    for (const match of raw.matchAll(regex)) {
      attrs[match[1]] = this.parseExpressionText(match[2], lineNumber);
    }
    return attrs;
  }

  parseTitledBlockName(rest: string, lineNumber: number): string {
    const trimmed = rest.trim();
    if (!trimmed.endsWith(':')) throw new Error(`Expected ':' at line ${lineNumber}`);
    return this.parseInlineString(trimmed.slice(0, -1).trim());
  }

  parseSimpleAttributes(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = /([A-Za-z_][\w]*)\s*=\s*("[^"]*"|'[^']*'|[^\s]+)/g;
    for (const match of raw.matchAll(regex)) {
      attrs[match[1]] = this.parseInlineString(match[2]);
    }
    return attrs;
  }

  private parseTopLevel(line: LineInfo): TopLevelNode {
    const basicNode = this.basicParser.parseTopLevel(line);
    if (basicNode) return basicNode;

    const visualNode = this.visualParser.parseTopLevel(line);
    if (visualNode) return visualNode;

    const domainNode = this.domainParser.parseTopLevel(line);
    if (domainNode) return domainNode;

    throw new Error(`Unsupported top-level declaration at line ${line.line}: ${line.text}`);
  }
}
