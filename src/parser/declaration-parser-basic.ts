import {
  AlgoDeclaration,
  Binding,
  ComponentDeclaration,
  ConstDeclaration,
  DataDeclaration,
  Expression,
  FuncDeclaration,
  ImportStatement,
  PseudoDeclaration,
  SubDeclaration,
  StyleDeclaration,
  ThemeDeclaration,
  TopLevelNode,
  UseStatement,
} from '../ast/types';
import { LineInfo } from './line-types';
import { DeclarationParserOps } from './declaration-ops';

/**
 * Core declaration parsing (`use`, `import`, `const`, `data`, `func`, `algo`, etc.).
 */
export class BasicDeclarationParser {
  constructor(private ops: DeclarationParserOps) {}

  parseTopLevel(line: LineInfo): TopLevelNode | null {
    const text = line.text;
    if (text.startsWith('use ')) return this.parseUse(line);
    if (text.startsWith('import ')) return this.parseImport(line);
    if (text.startsWith('const ')) return this.parseConst(line);
    if (text === 'data:') return this.parseData(line);
    if (text.startsWith('func ')) return this.parseFunc(line);
    if (text.startsWith('theme ')) return this.parseTheme(line);
    if (text.startsWith('style ')) return this.parseStyle(line);
    if (text.startsWith('sub ')) return this.parseSub(line);
    if (text.startsWith('component ')) return this.parseComponent(line);
    if (text.startsWith('algo ')) return this.parseAlgo(line);
    if (text.startsWith('pseudo ')) return this.parsePseudo(line);
    return null;
  }

  private parseUse(line: LineInfo): UseStatement {
    this.ops.advanceLine();
    return { type: 'UseStatement', module: line.text.slice(4).trim(), location: this.ops.lineLoc(line) };
  }

  private parseImport(line: LineInfo): ImportStatement {
    this.ops.advanceLine();
    const match = line.text.match(/^import\s+['"](.+?)['"]$/);
    if (!match) throw new Error(`Invalid import at line ${line.line}`);
    return { type: 'ImportStatement', path: match[1], location: this.ops.lineLoc(line) };
  }

  private parseConst(line: LineInfo): ConstDeclaration {
    this.ops.advanceLine();
    const match = line.text.match(/^const\s+([A-Za-z_][\w]*)\s*=\s*(.+)$/);
    if (!match) throw new Error(`Invalid const declaration at line ${line.line}`);
    return {
      type: 'ConstDeclaration',
      name: match[1],
      value: this.ops.parseExpressionText(match[2], line.line),
      location: this.ops.lineLoc(line),
    };
  }

  private parseData(line: LineInfo): DataDeclaration {
    this.ops.advanceLine();
    const childIndent = this.ops.nextChildIndent(line.indent);
    const bindings: Binding[] = [];
    if (childIndent === null) {
      return { type: 'DataDeclaration', bindings, location: this.ops.lineLoc(line) };
    }

    while (!this.ops.eof()) {
      const current = this.ops.peekMeaningful();
      if (!current || current.indent < childIndent) break;
      if (current.indent > childIndent) {
        this.ops.advanceLine();
        continue;
      }
      const match = current.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
      if (!match) throw new Error(`Invalid data binding at line ${current.line}`);
      bindings.push({ name: match[1], value: this.ops.parseExpressionText(match[2], current.line) });
      this.ops.advanceLine();
    }

    return { type: 'DataDeclaration', bindings, location: this.ops.lineLoc(line) };
  }

  private parseFunc(line: LineInfo): FuncDeclaration {
    const { name, params } = this.parseHeaderWithParams(line, 'func');
    this.ops.advanceLine();
    const body = this.ops.parseStatementSuite(line.indent);
    return { type: 'FuncDeclaration', name, params, body, location: this.ops.lineLoc(line) };
  }

  private parseAlgo(line: LineInfo): AlgoDeclaration {
    const { name, params } = this.parseHeaderWithParams(line, 'algo');
    this.ops.advanceLine();
    const body = this.ops.parseStatementSuite(line.indent);
    return { type: 'AlgoDeclaration', name, params, body, location: this.ops.lineLoc(line) };
  }

  private parseTheme(line: LineInfo): ThemeDeclaration {
    this.ops.advanceLine();
    const name = line.text.slice(6, -1).trim();
    return {
      type: 'ThemeDeclaration',
      name,
      properties: this.ops.parsePropertyBlock(line.indent),
      location: this.ops.lineLoc(line),
    };
  }

  private parseStyle(line: LineInfo): StyleDeclaration {
    this.ops.advanceLine();
    const name = line.text.slice(6, -1).trim();
    return {
      type: 'StyleDeclaration',
      name,
      properties: this.ops.parsePropertyBlock(line.indent),
      location: this.ops.lineLoc(line),
    };
  }

  private parseSub(line: LineInfo): SubDeclaration {
    const { name, params } = this.parseHeaderWithParams(line, 'sub');
    this.ops.advanceLine();
    const childIndent = this.ops.nextChildIndent(line.indent);
    const body = childIndent === null ? [] : this.ops.parseTopLevelBlock(childIndent);
    return { type: 'SubDeclaration', name, params, body, location: this.ops.lineLoc(line) };
  }

  private parseComponent(line: LineInfo): ComponentDeclaration {
    this.ops.advanceLine();
    const match = line.text.match(/^component\s+([A-Za-z_][\w]*)\s*=\s*([A-Za-z_][\w]*)\((.*)\)$/);
    if (!match) throw new Error(`Invalid component declaration at line ${line.line}`);
    const [, name, module, rawArgs] = match;
    const args: Record<string, Expression> = {};
    for (const part of this.ops.splitCommaArgs(rawArgs)) {
      if (!part.trim()) continue;
      const argMatch = part.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
      if (!argMatch) continue;
      args[argMatch[1]] = this.ops.parseExpressionText(argMatch[2], line.line);
    }
    return { type: 'ComponentDeclaration', name, module, args, location: this.ops.lineLoc(line) };
  }

  private parsePseudo(line: LineInfo): PseudoDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('pseudo'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const lines: string[] = [];
    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        lines.push(current.raw.slice(childIndent));
        this.ops.advanceLine();
      }
    }
    return { type: 'PseudoDeclaration', name, lines, location: this.ops.lineLoc(line) };
  }

  private parseHeaderWithParams(line: LineInfo, keyword: string): { name: string; params: string[] } {
    const regex = new RegExp(`^${keyword}\\s+([A-Za-z_][\\w]*)\\((.*)\\):$`);
    const match = line.text.match(regex);
    if (!match) throw new Error(`Invalid ${keyword} declaration at line ${line.line}`);
    return { name: match[1], params: this.ops.splitCommaArgs(match[2]).map((param) => param.trim()).filter(Boolean) };
  }
}
