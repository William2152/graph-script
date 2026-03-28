import { Position, Program } from '../ast/types';
import { DeclarationBlockParser } from './declaration-parser';
import { LineInfo } from './line-types';
import { LineParserUtils } from './line-utils';

/**
 * Main parser entrypoint for line-based GraphScript syntax.
 * Delegates declaration and statement internals to dedicated parser modules.
 */
export class Parser {
  private lines: LineInfo[] = [];
  private indexRef = { value: 0 };

  parse(source: string): Program {
    this.lines = source.replace(/\r\n/g, '\n').split('\n').map((raw, idx) => ({
      raw,
      text: raw.trim(),
      indent: raw.match(/^ */)?.[0].length ?? 0,
      line: idx + 1,
    }));
    this.indexRef.value = 0;

    const start = this.makePos(1, 1, 0);
    const declarationParser = new DeclarationBlockParser(this.lines, this.indexRef);
    const body = declarationParser.parseTopLevelBlock(0);
    const endLine = this.lines[this.lines.length - 1]?.line ?? 1;

    return {
      type: 'Program',
      body,
      location: {
        start,
        end: this.makePos(endLine, 1, 0),
      },
    };
  }

  private makePos(line: number, column: number, offset: number): Position {
    return LineParserUtils.makePos(line, column, offset);
  }
}
