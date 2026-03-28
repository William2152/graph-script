export interface RenderEmbed {
  (target: string): Promise<string | null>;
}
