import {
  ChartDeclaration,
  DiagramDeclaration,
  DiagramElement,
  Expression,
  FlowDeclaration,
  FlowEdge,
  FlowNode,
  Scene3dDeclaration,
  Scene3dElement,
  TableDeclaration,
  Plot3dDeclaration,
  TopLevelNode,
} from '../ast/types';
import { LineInfo } from './line-types';
import { DeclarationParserOps } from './declaration-ops';

/**
 * Visual declaration parsing for chart/flow/diagram/table/plot3d/scene3d.
 */
export class VisualDeclarationParser {
  constructor(private ops: DeclarationParserOps) {}

  parseTopLevel(line: LineInfo): TopLevelNode | null {
    const text = line.text;
    if (text.startsWith('chart ')) return this.parseChart(line);
    if (text.startsWith('flow ')) return this.parseFlow(line);
    if (text.startsWith('diagram ')) return this.parseDiagram(line);
    if (text.startsWith('table ')) return this.parseTable(line);
    if (text.startsWith('plot3d ')) return this.parsePlot3d(line);
    if (text.startsWith('scene3d ')) return this.parseScene3d(line);
    return null;
  }

  private parseChart(line: LineInfo): ChartDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('chart'.length).trim(), line.line);
    return {
      type: 'ChartDeclaration',
      name,
      properties: this.ops.parsePropertyBlock(line.indent),
      location: this.ops.lineLoc(line),
    };
  }

  private parseFlow(line: LineInfo): FlowDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('flow'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const properties: Record<string, Expression> = {};
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    if (childIndent !== null) {
      while (!this.ops.eof()) {
        const current = this.ops.peekMeaningful();
        if (!current || current.indent < childIndent) break;
        if (current.indent > childIndent) {
          this.ops.advanceLine();
          continue;
        }

        if (current.text.startsWith('node ')) {
          const match = current.text.match(/^node\s+([A-Za-z_][\w]*)\s*(.*)$/);
          if (!match) throw new Error(`Invalid flow node at line ${current.line}`);
          const attrs = this.ops.parseSimpleAttributes(match[2]);
          nodes.push({
            type: 'FlowNode',
            id: match[1],
            nodeType: attrs.type,
            label: attrs.label,
          });
          this.ops.advanceLine();
          continue;
        }

        if (current.text.includes('->')) {
          const match = current.text.match(/^([A-Za-z_][\w]*)\s*->\s*([A-Za-z_][\w]*)(?:\s+label\s*=\s*(.+))?$/);
          if (!match) throw new Error(`Invalid flow edge at line ${current.line}`);
          edges.push({
            type: 'FlowEdge',
            from: match[1],
            to: match[2],
            label: match[3] ? this.ops.parseInlineString(match[3].trim()) : undefined,
          });
          this.ops.advanceLine();
          continue;
        }

        const propertyMatch = current.text.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
        if (propertyMatch) {
          properties[propertyMatch[1]] = this.ops.parseExpressionText(propertyMatch[2], current.line);
        }
        this.ops.advanceLine();
      }
    }

    return { type: 'FlowDeclaration', name, properties, nodes, edges, location: this.ops.lineLoc(line) };
  }

  private parseDiagram(line: LineInfo): DiagramDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('diagram'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const properties: Record<string, Expression> = {};
    let elements: DiagramElement[] = [];

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

        elements = this.parseDiagramElements(childIndent);
        break;
      }
    }

    return { type: 'DiagramDeclaration', name, properties, elements, location: this.ops.lineLoc(line) };
  }

  private parseDiagramElements(indent: number): DiagramElement[] {
    const elements: DiagramElement[] = [];
    while (!this.ops.eof()) {
      const line = this.ops.peekMeaningful();
      if (!line || line.indent < indent) break;
      if (line.indent > indent) {
        this.ops.advanceLine();
        continue;
      }
      elements.push(this.parseDiagramElement(line, indent));
    }
    return elements;
  }

  private parseDiagramElement(line: LineInfo, indent: number): DiagramElement {
    const { header, hasChildren } = this.ops.splitHeaderAndChildren(line.text);
    const match = header.match(/^([A-Za-z_][\w]*)\s+([A-Za-z_][\w-]*|"[^"]+"|'[^']+')\s*(.*)$/);
    if (!match) throw new Error(`Invalid diagram element at line ${line.line}`);
    const [, type, rawName, rawAttrs] = match;
    const properties = this.ops.parseAttributeExpressions(rawAttrs, line.line);
    const element: DiagramElement = {
      type,
      name: this.ops.parseInlineString(rawName),
      properties,
    };
    this.ops.advanceLine();

    if (hasChildren) {
      const childIndent = this.ops.nextChildIndent(indent);
      if (childIndent !== null) element.children = this.parseDiagramElements(childIndent);
    }

    return element;
  }

  private parseTable(line: LineInfo): TableDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('table'.length).trim(), line.line);
    return { type: 'TableDeclaration', name, properties: this.ops.parsePropertyBlock(line.indent), location: this.ops.lineLoc(line) };
  }

  private parsePlot3d(line: LineInfo): Plot3dDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('plot3d'.length).trim(), line.line);
    return { type: 'Plot3dDeclaration', name, properties: this.ops.parsePropertyBlock(line.indent), location: this.ops.lineLoc(line) };
  }

  private parseScene3d(line: LineInfo): Scene3dDeclaration {
    this.ops.advanceLine();
    const name = this.ops.parseTitledBlockName(line.text.slice('scene3d'.length).trim(), line.line);
    const childIndent = this.ops.nextChildIndent(line.indent);
    const properties: Record<string, Expression> = {};
    const elements: Scene3dElement[] = [];

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

        const elementMatch = current.text.match(/^([A-Za-z_][\w]*)\s+([A-Za-z_][\w-]*|"[^"]+"|'[^']+')\s*(.*)$/);
        if (!elementMatch) throw new Error(`Invalid scene3d element at line ${current.line}`);
        elements.push({
          type: elementMatch[1],
          name: this.ops.parseInlineString(elementMatch[2]),
          properties: this.ops.parseAttributeExpressions(elementMatch[3], current.line),
        });
        this.ops.advanceLine();
      }
    }

    return { type: 'Scene3dDeclaration', name, properties, elements, location: this.ops.lineLoc(line) };
  }
}
