/**
 * Normalized source line metadata consumed by parser phases.
 */
export interface LineInfo {
  raw: string;
  text: string;
  indent: number;
  line: number;
}
