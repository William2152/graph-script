import {
  Token, TopLevelNode, Program, SourceLocation, Position,
  Expression, Statement, FlowNode, FlowEdge, DiagramElement, Scene3dElement,
  InfraElement, PagePlacement, RenderTarget
} from '../ast/types';
import { DECLARATION_KEYWORDS } from '../tokenizer/types';
import { ExpressionParser } from './expressions';

export class DeclarationParser {
  private exprParser: ExpressionParser;
  private pos: number;

  constructor(
    private tokens: Token[],
    private peek: () => Token,
    private advance: () => Token,
    private check: (type: string, value?: string) => boolean,
    private skipNewlines: () => void,
    private loc: () => Position,
    private isAtEnd: () => boolean,
    private error: (msg: string) => void,
    private parseStatement: () => Statement
  ) {
    this.pos = 0;
    this.exprParser = new ExpressionParser(
      tokens, 0, peek, advance, check, loc
    );
  }

  setPos(newPos: number): void {
    this.pos = newPos;
  }

  getPos(): number {
    return this.pos;
  }

  parseProgram(): Program {
    const body: TopLevelNode[] = [];
    const start = this.loc();

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      const node = this.parseTopLevel();
      if (node) body.push(node);
    }

    return {
      type: 'Program',
      body,
      location: { start, end: this.loc() }
    };
  }

  parseTopLevel(): TopLevelNode | null {
    const token = this.peek();

    if (token.type !== 'IDENTIFIER' && !DECLARATION_KEYWORDS.has(token.value)) {
      this.error(`Expected declaration, got ${token.type}`);
      this.advance();
      return null;
    }

    switch (token.value) {
      case 'use': return this.parseUseStatement();
      case 'import': return this.parseImportStatement();
      case 'const': return this.parseConstDeclaration();
      case 'data': return this.parseDataDeclaration();
      case 'func': return this.parseFuncDeclaration();
      case 'theme': return this.parseThemeDeclaration();
      case 'style': return this.parseStyleDeclaration();
      case 'sub': return this.parseSubDeclaration();
      case 'component': return this.parseComponentDeclaration();
      case 'algo': return this.parseAlgoDeclaration();
      case 'chart': return this.parseChartDeclaration();
      case 'flow': return this.parseFlowDeclaration();
      case 'diagram': return this.parseDiagramDeclaration();
      case 'table': return this.parseTableDeclaration();
      case 'plot3d': return this.parsePlot3dDeclaration();
      case 'scene3d': return this.parseScene3dDeclaration();
      case 'erd': return this.parseErdDeclaration();
      case 'infra': return this.parseInfraDeclaration();
      case 'page': return this.parsePageDeclaration();
      case 'render': return this.parseRenderDeclaration();
      default:
        this.error(`Unknown declaration: ${token.value}`);
        this.advance();
        return null;
    }
  }

  private parseUseStatement(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const module = this.expect('IDENTIFIER').value;
    this.skipNewlines();

    return {
      type: 'UseStatement',
      module,
      location: { start, end: this.loc() }
    };
  }

  private parseImportStatement(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const path = this.expect('STRING').value;
    this.skipNewlines();

    return {
      type: 'ImportStatement',
      path,
      location: { start, end: this.loc() }
    };
  }

  private parseConstDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('EQUALS');
    const value = this.exprParser.parseExpression();
    this.skipNewlines();

    return {
      type: 'ConstDeclaration',
      name,
      value,
      location: { start, end: this.loc() }
    };
  }

  private parseDataDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    this.expect('COLON');
    this.skipNewlines();

    const bindings: { name: string; value: Expression }[] = [];
    const dataKeywords = new Set(['chart', 'flow', 'algo', 'use', 'import', 'const', 'data', 'end', 'else', 'if', 'while', 'for', 'return', 'emit', 'func', 'theme', 'style', 'sub', 'component', 'diagram', 'table', 'plot3d', 'scene3d', 'erd', 'infra', 'page', 'render']);

    while (this.check('IDENTIFIER') && !dataKeywords.has(this.peek().value)) {
      const name = this.expect('IDENTIFIER').value;
      this.expect('EQUALS');
      const value = this.exprParser.parseExpression();
      bindings.push({ name, value });
      this.skipNewlines();
    }

    return {
      type: 'DataDeclaration',
      bindings,
      location: { start, end: this.loc() }
    };
  }

  private parseFuncDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('LPAREN');
    const params: string[] = [];

    while (!this.check('RPAREN')) {
      if (params.length > 0) this.expect('COMMA');
      params.push(this.expect('IDENTIFIER').value);
    }
    this.expect('RPAREN');
    this.expect('COLON');
    this.skipNewlines();

    const body = this.parseBlockStatements();

    return {
      type: 'FuncDeclaration',
      name,
      params,
      body,
      location: { start, end: this.loc() }
    };
  }

  private parseThemeDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('COLON');
    this.skipNewlines();
    const properties = this.parseBlockProperties();

    return {
      type: 'ThemeDeclaration',
      name,
      properties,
      location: { start, end: this.loc() }
    };
  }

  private parseStyleDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('COLON');
    this.skipNewlines();
    const properties = this.parseBlockProperties();

    return {
      type: 'StyleDeclaration',
      name,
      properties,
      location: { start, end: this.loc() }
    };
  }

  private parseSubDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('LPAREN');
    const params: string[] = [];

    while (!this.check('RPAREN')) {
      if (params.length > 0) this.expect('COMMA');
      params.push(this.expect('IDENTIFIER').value);
    }
    this.expect('RPAREN');
    this.expect('COLON');
    this.skipNewlines();

    const body: TopLevelNode[] = [];
    while (!this.check('IDENTIFIER', 'end') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('IDENTIFIER', 'end')) break;
      const node = this.parseTopLevel();
      if (node) body.push(node);
    }
    this.expect('IDENTIFIER', 'end');

    return {
      type: 'SubDeclaration',
      name,
      params,
      body,
      location: { start, end: this.loc() }
    };
  }

  private parseComponentDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('EQUALS');
    const module = this.expect('IDENTIFIER').value;
    this.expect('LPAREN');
    const args: Record<string, Expression> = {};

    while (!this.check('RPAREN')) {
      if (Object.keys(args).length > 0) this.expect('COMMA');
      const key = this.expect('IDENTIFIER').value;
      this.expect('EQUALS');
      args[key] = this.exprParser.parseExpression();
    }
    this.expect('RPAREN');
    this.skipNewlines();

    return {
      type: 'ComponentDeclaration',
      name,
      module,
      args,
      location: { start, end: this.loc() }
    };
  }

  private parseAlgoDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const name = this.expect('IDENTIFIER').value;
    this.expect('LPAREN');
    const params: string[] = [];

    while (!this.check('RPAREN')) {
      if (params.length > 0) this.expect('COMMA');
      params.push(this.expect('IDENTIFIER').value);
    }
    this.expect('RPAREN');
    this.expect('COLON');
    this.skipNewlines();

    const body = this.parseBlockStatements();

    return {
      type: 'AlgoDeclaration',
      name,
      params,
      body,
      location: { start, end: this.loc() }
    };
  }

  private parseChartDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();

    if (this.check('COLON')) {
      this.advance();
      this.skipNewlines();
    }

    const properties = this.parseBlockProperties();

    return {
      type: 'ChartDeclaration',
      name,
      properties,
      location: { start, end: this.loc() }
    };
  }

  private parseFlowDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();

    if (this.check('COLON')) {
      this.advance();
      this.skipNewlines();
    }

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const properties: Record<string, Expression> = {};

    while (!this.isAtEnd() && !this.check('IDENTIFIER', 'end')) {
      this.skipNewlines();
      if (this.isAtEnd() || this.check('IDENTIFIER', 'end')) break;

      if (this.check('IDENTIFIER', 'node')) {
        this.advance();
        const id = this.expect('IDENTIFIER').value;
        let nodeType: string | undefined;
        let label: string | undefined;

        if (this.check('IDENTIFIER', 'type')) {
          this.advance();
          this.expect('EQUALS');
          nodeType = this.expect('IDENTIFIER').value;
        }

        if (this.check('IDENTIFIER', 'label')) {
          this.advance();
          this.expect('EQUALS');
          label = this.peek().type === 'STRING' ? this.advance().value : this.expect('IDENTIFIER').value;
        }

        nodes.push({ type: 'FlowNode', id, nodeType, label });
        this.skipNewlines();
      } else if (this.check('IDENTIFIER')) {
        const from = this.expect('IDENTIFIER').value;

        if (this.check('ARROW')) {
          this.advance();
          const to = this.expect('IDENTIFIER').value;
          let label: string | undefined;

          if (this.check('IDENTIFIER') && !['node', 'end'].includes(this.peek().value)) {
            label = this.expect('IDENTIFIER').value;
          }

          edges.push({ type: 'FlowEdge', from, to, label });
        } else if (this.check('EQUALS')) {
          this.advance();
          this.exprParser.parseExpression();
        } else {
          this.advance();
        }
        this.skipNewlines();
      } else {
        this.advance();
        this.skipNewlines();
      }
    }

    if (this.check('IDENTIFIER', 'end')) this.advance();

    return {
      type: 'FlowDeclaration',
      name,
      properties,
      nodes,
      edges,
      location: { start, end: this.loc() }
    };
  }

  private parseDiagramDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();

    if (this.check('COLON')) {
      this.advance();
      this.skipNewlines();
    }

    const elements: DiagramElement[] = [];
    const diagramKeywords = new Set(['chart', 'flow', 'algo', 'end', 'table', 'plot3d', 'scene3d', 'erd', 'infra', 'page', 'render', 'use', 'import', 'const', 'data', 'func', 'theme', 'style', 'sub', 'component']);

    while (this.check('IDENTIFIER') && !diagramKeywords.has(this.peek().value)) {
      const type = this.expect('IDENTIFIER').value;
      const elemName = this.expect('IDENTIFIER').value;
      const properties: Record<string, Expression> = {};

      while (!this.check('NEWLINE') && !this.isAtEnd()) {
        if (this.check('IDENTIFIER')) {
          const key = this.peek().value;
          this.advance();
          if (this.check('EQUALS')) {
            this.advance();
            properties[key] = this.exprParser.parseExpression();
          } else {
            properties[key] = { type: 'Literal', value: true, location: { start: this.loc(), end: this.loc() } } as Expression;
          }
        } else {
          break;
        }
      }

      elements.push({ type, name: elemName, properties });
      this.skipNewlines();
    }

    return {
      type: 'DiagramDeclaration',
      name,
      elements,
      location: { start, end: this.loc() }
    };
  }

  private parseTableDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();
    const properties = this.parseBlockProperties();

    return {
      type: 'TableDeclaration',
      name,
      properties,
      location: { start, end: this.loc() }
    };
  }

  private parsePlot3dDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();
    if (this.check('COLON')) {
      this.advance();
      this.skipNewlines();
    }

    const properties = this.parseBlockProperties();

    return {
      type: 'Plot3dDeclaration',
      name,
      properties,
      location: { start, end: this.loc() }
    };
  }

  private parseScene3dDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();
    if (this.check('COLON')) {
      this.advance();
      this.skipNewlines();
    }

    const elements: Scene3dElement[] = [];

    while (this.check('IDENTIFIER') && !['end'].includes(this.peek().value)) {
      const type = this.expect('IDENTIFIER').value;
      const elemName = this.expect('IDENTIFIER').value;
      elements.push({ type, name: elemName });
      this.skipNewlines();
    }

    if (this.check('IDENTIFIER', 'end')) this.advance();

    return {
      type: 'Scene3dDeclaration',
      name,
      elements,
      location: { start, end: this.loc() }
    };
  }

  private parseErdDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    return {
      type: 'ErdDeclaration',
      name,
      tables: [],
      relationships: [],
      location: { start, end: this.loc() }
    };
  }

  private parseInfraDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const provider = this.expect('IDENTIFIER').value;
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    return {
      type: 'InfraDeclaration',
      provider,
      name,
      elements: [],
      location: { start, end: this.loc() }
    };
  }

  private parsePageDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    const nameToken = this.peek();
    const name = nameToken.type === 'STRING' ? nameToken.value : this.expect('IDENTIFIER').value;
    if (nameToken.type === 'STRING') this.advance();

    this.skipNewlines();
    const properties = this.parseBlockProperties();

    return {
      type: 'PageDeclaration',
      name,
      properties,
      placements: [],
      location: { start, end: this.loc() }
    };
  }

  private parseRenderDeclaration(): TopLevelNode {
    const start = this.loc();
    this.advance();
    this.expect('COLON');
    this.skipNewlines();

    const targets: RenderTarget[] = [];
    const renderKeywords = new Set(['end']);

    while (this.check('IDENTIFIER') && !renderKeywords.has(this.peek().value)) {
      const kind = this.expect('IDENTIFIER').value;
      const name = this.expect('IDENTIFIER').value;
      this.expect('IDENTIFIER', 'to');
      const output = this.expect('STRING').value;
      targets.push({ kind, name, output });
      this.skipNewlines();
    }

    return {
      type: 'RenderDeclaration',
      targets,
      location: { start, end: this.loc() }
    };
  }

  private parseBlockProperties(): Record<string, Expression> {
    const props: Record<string, Expression> = {};
    const blockKeywords = new Set(['chart', 'flow', 'end', 'algo', 'table', 'plot3d', 'scene3d', 'erd', 'infra', 'page', 'render', 'use', 'import', 'const', 'data', 'func', 'theme', 'style', 'sub', 'component', 'diagram']);

    while (this.check('IDENTIFIER') && !blockKeywords.has(this.peek().value)) {
      const key = this.expect('IDENTIFIER').value;
      this.expect('EQUALS');
      props[key] = this.exprParser.parseExpression();
      this.skipNewlines();
    }

    return props;
  }

  private parseBlockStatements(): Statement[] {
    const body: Statement[] = [];

    while (!this.check('IDENTIFIER', 'end') && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check('IDENTIFIER', 'end')) break;
      body.push(this.parseStatement());
    }

    if (this.check('IDENTIFIER', 'end')) this.advance();
    return body;
  }

  private expect(type: string, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      this.error(`Expected ${value ? `${type} '${value}'` : type}, got ${token.type} (${token.value})`);
    }
    return this.advance();
  }
}
