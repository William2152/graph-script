import {
  ErdDeclaration,
  ErdField,
  ErdRelationship,
  ErdTable,
  Expression,
  InfraConnection,
  InfraDeclaration,
  InfraElement,
  PageDeclaration,
  PagePlacement,
  RenderDeclaration,
  RenderTarget,
  TopLevelNode,
} from '../ast/types';
import { LineInfo } from './line-types';
import { DeclarationParserOps } from './declaration-ops';

/**
 * Domain declaration parsing for ERD, infra, page, and render blocks.
 */
export class DomainDeclarationParser {
  constructor(private ops: DeclarationParserOps) {}

  parseTopLevel(line: LineInfo): TopLevelNode | null {
    const text = line.text;
    if (text.startsWith('erd ')) return this.parseErd(line);
    if (text.startsWith('infra ')) return this.parseInfra(line);
    if (text.startsWith('page ')) return this.parsePage(line);
    if (text === 'render:') return this.parseRender(line);
    return null;
  }

  private parseErd(line: LineInfo): ErdDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('erd'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const tables: ErdTable[] = [];
    const relationships: ErdRelationship[] = [];

    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        if (current.indent > childIndent) {
          this.ops.advanceLine();
          continue;
        }

        if (current.text.startsWith('table ')) {
          const tableMatch = current.text.match(/^table\s+([A-Za-z_][\w]*)\s*:$/);
          if (!tableMatch) throw new Error(`Invalid ERD table at line ${current.line}`);
          this.ops.advanceLine();
          const fieldIndent = this.ops.nextChildIndent(current.indent);
          const fields: ErdField[] = [];
          if (fieldIndent !== null) {
            while (!this.ops.eof()) {
              const fieldLine = this.ops.peekMeaningful();
              if (!fieldLine || fieldLine.indent < fieldIndent) break;
              if (fieldLine.indent > fieldIndent) {
                this.ops.advanceLine();
                continue;
              }
              const fieldMatch = fieldLine.text.match(/^([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w\[\]]*)(.*)$/);
              if (!fieldMatch) throw new Error(`Invalid ERD field at line ${fieldLine.line}`);
              const constraints = fieldMatch[3].trim() ? fieldMatch[3].trim().split(/\s+/) : [];
              fields.push({ name: fieldMatch[1], fieldType: fieldMatch[2], constraints });
              this.ops.advanceLine();
            }
          }
          tables.push({ name: tableMatch[1], fields });
          continue;
        }

        const relMatch = current.text.match(/^([A-Za-z_][\w.]+)\s*->\s*([A-Za-z_][\w.]+)(?:\s+([A-Za-z_\-]+))?$/);
        if (relMatch) {
          relationships.push({ from: relMatch[1], to: relMatch[2], cardinality: relMatch[3] ?? 'related' });
        }
        this.ops.advanceLine();
      }
    }

    return { type: 'ErdDeclaration', name, tables, relationships, location: this.ops.lineLoc(line) };
  }

  private parseInfra(line: LineInfo): InfraDeclaration {
    this.ops.advanceLine();
    const header = line.text.match(/^infra\s+([A-Za-z_][\w.]*)\s+(.+)$/);
    if (!header) throw new Error(`Invalid infra declaration at line ${line.line}`);
    const provider = header[1];
    const name = this.ops.parseTitledBlockName(header[2].trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const properties: Record<string, Expression> = {};
    const elements: InfraElement[] = [];
    const connections: InfraConnection[] = [];

    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        if (current.indent > childIndent) {
          this.ops.advanceLine();
          continue;
        }

        if (this.ops.isPropertyLine(current.text)) {
          const match = current.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
          if (match) properties[match[1]] = this.ops.parseExpressionText(match[2], current.line);
          this.ops.advanceLine();
          continue;
        }

        if (current.text.includes('->')) {
          const edgeMatch = current.text.match(/^([A-Za-z_][\w-]*)\s*->\s*([A-Za-z_][\w-]*)(?:\s+label\s*=\s*(.+))?$/);
          if (!edgeMatch) throw new Error(`Invalid infra connection at line ${current.line}`);
          connections.push({
            from: edgeMatch[1],
            to: edgeMatch[2],
            label: edgeMatch[3] ? this.ops.parseInlineString(edgeMatch[3]) : undefined,
          });
          this.ops.advanceLine();
          continue;
        }

        const elemMatch = current.text.match(/^([A-Za-z_][\w]*)\s+([A-Za-z_][\w-]*|"[^"]+"|'[^']+')\s*(.*)$/);
        if (!elemMatch) throw new Error(`Invalid infra element at line ${current.line}`);
        elements.push({
          type: elemMatch[1],
          name: this.ops.parseInlineString(elemMatch[2]),
          properties: this.ops.parseAttributeExpressions(elemMatch[3], current.line),
        });
        this.ops.advanceLine();
      }
    }

    return { type: 'InfraDeclaration', provider, name, properties, elements, connections, location: this.ops.lineLoc(line) };
  }

  private parsePage(line: LineInfo): PageDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('page'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const properties: Record<string, Expression> = {};
    const placements: PagePlacement[] = [];

    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        if (current.indent > childIndent) {
          this.ops.advanceLine();
          continue;
        }

        const placeMatch = current.text.match(/^place\s+(.+?)\s+at\s+(.+)$/);
        if (placeMatch) {
          placements.push({
            target: this.ops.parseInlineString(placeMatch[1].trim()),
            position: placeMatch[2].trim(),
          });
          this.ops.advanceLine();
          continue;
        }

        const propMatch = current.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
        if (propMatch) {
          properties[propMatch[1]] = this.ops.parseExpressionText(propMatch[2], current.line);
        }
        this.ops.advanceLine();
      }
    }

    return {
      type: 'PageDeclaration',
      name,
      properties,
      placements,
      location: this.ops.lineLoc(line),
    };
  }

  private parseRender(line: LineInfo): RenderDeclaration {
    this.ops.advanceLine();
    const childIndent = this.ops.nextChildIndent(line.indent);
    const targets: RenderTarget[] = [];
    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        const match = current.text.match(/^target\s+([A-Za-z_][\w]*)\s+(.+?)\s+to\s+['"](.+?)['"]$/);
        if (match) {
          targets.push({ kind: match[1], name: this.ops.parseInlineString(match[2].trim()), output: match[3] });
        }
        this.ops.advanceLine();
      }
    }
    return { type: 'RenderDeclaration', targets, location: this.ops.lineLoc(line) };
  }
}
