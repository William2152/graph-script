# Renderer Composite Spec

## Context

GraphScript now targets the VQE visual from `temp/fig-4-16-vqe-measurement.gs`, so the renderer must support multi-panel diagrams with embedded assets and formulae while producing XML-valid SVG output.

## Functional Requirements

1. **Composites**: A single `diagram` declaration may contain panels, connectors, grids, embedded flows/charts, and referenceable sub-components whose positions are manageable but whose spacing is automatically kept readable.
2. **Image import**: The DSL exposes `const <name> = image("path")`; the renderer must resolve asset paths relative to the `.gs` file, inline PNG/SVG data URIs in the output, and honor `fit`, `radius`, `opacity`, and positioning cues.
3. **LaTeX rendering**: All textual content in `diagram` (titles, subtitles, card labels, floating text) may include LaTeX. Inline fragments must keep tokens atomic during wrapping, and the MathJax SVG fragments must be inserted without breaking XML syntax. Modes `latex=auto|on|off` control parsing.
4. **SVG validity**: The root tag must declare both `xmlns` and `xmlns:xlink`, and every attribute derived from MathJax must be escaped so `<`/`>` characters never appear unescaped.
5. **Usability**: The renderer must produce readable layouts (no overlapping text, connectors avoid obscuring cards) and keep loops/alignment cues (e.g., dashed connectors for parameter updates) consistent with the reference image.

## Data & API

- **Runtime builtin**: `image(path: string): ImageAsset` returns `{ type: 'imageAsset', path, format }`.
- **Diagram primitive**: `image <id> src=<asset> x=<num> y=<num> w=<num> h=<num> [fit=contain|cover|stretch] [radius=<num>] [opacity=<0-1>]`.
- **Flow connectors**: Additional connector attributes enforce orthogonal routing (`route="hvh"`, `label_dx`, `label_dy`).
- **Textual content**: Every text-bearing declaration accepts `latex="auto|on|off"` plus `size`, `weight`, `color`, `align`.
- **Formula**: `formula` always uses LaTeX display mode and relies on MathJax to produce inline fragments.

## Layout & Rendering Notes

- Connectors use discrete anchors (`.top`, `.bottom`, `.left`, `.right`) to ensure consistent routing across panels.
- Image assets act as drop-in art for circuit sub-diagrams; they are placed inside cards with matching strokes/backgrounds to mimic the reference.
- MathJax fragments are cached (`mathCache`) keyed by `(display, fontSize, value)` to improve render speed.
- Root SVG generation (`svgDocument`) now includes the `xlink` namespace, and `renderMathFragment` sanitizes `data-latex` attribute values via `escapeXml`.

## Validation

- Build: `npm run build`.
- Rendering: `node dist/cli.js render temp/fig-4-16-vqe-measurement.gs --output output` and same for `output-viz`.
- XML parse check for each output (ensuring no `xlink` or `data-latex` issues).
- Visual inspection to confirm connectors, text, and assets align with the VQE diagram example.

## Next Steps (optional)

1. Expand DSL spec to describe new container/group layout helpers once they exist.
2. Add unit tests for `image(...)` resolution and MathJax sanitization.
3. Document usage patterns for embedding LaTeX-rich panels in future spec updates.
