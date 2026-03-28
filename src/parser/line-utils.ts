import { Expression, Position, SourceLocation } from '../ast/types';
import { ExpressionParser } from './expressions';
import { LineInfo } from './line-types';
import { Tokenizer } from '../tokenizer';

/**
 * Shared helpers for line-based parser modules.
 * Keeps parsing modules focused on grammar decisions instead of utility logic.
 */
export class LineParserUtils {
  static nextChildIndent(lines: LineInfo[], index: number, parentIndent: number): number | null {
    let cursor = index;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (!line.text || line.text.startsWith('#')) {
        cursor += 1;
        continue;
      }
      if (line.indent <= parentIndent) return null;
      return line.indent;
    }
    return null;
  }

  static parseExpressionText(text: string, lineNumber: number): Expression {
    const tokenizer = new Tokenizer();
    const tokens = tokenizer.tokenize(text);
    let pos = 0;
    const parser = new ExpressionParser(
      tokens,
      pos,
      () => tokens[pos] ?? tokens[tokens.length - 1],
      () => tokens[pos++] ?? tokens[tokens.length - 1],
      (type, value) => {
        const token = tokens[pos] ?? tokens[tokens.length - 1];
        return token.type === type && (value === undefined || token.value === value);
      },
      () => (tokens[pos] ?? tokens[tokens.length - 1]).location.start,
    );

    try {
      return parser.parseExpression();
    } catch (error: any) {
      throw new Error(`Expression parse error on line ${lineNumber}: ${error.message}`);
    }
  }

  static parseInlineString(text: string): string {
    const trimmed = text.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  static splitCommaArgs(raw: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let quote: string | null = null;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (quote) {
        current += ch;
        if (ch === quote && raw[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
        continue;
      }
      if (['(', '[', '{'].includes(ch)) depth += 1;
      if ([')', ']', '}'].includes(ch)) depth -= 1;
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  static lineLoc(line: LineInfo): SourceLocation {
    return {
      start: this.makePos(line.line, line.indent + 1, 0),
      end: this.makePos(line.line, line.raw.length + 1, 0),
    };
  }

  static makePos(line: number, column: number, offset: number): Position {
    return { line, column, offset };
  }
}
