# 006 - PNG/JPG Rendering Support

## Task Summary
Tambahkan fitur export/render ke format PNG dan JPG selain SVG yang sudah ada.

## Project Understanding

GraphScript adalah bahasa scripting visual untuk membuat:
- 2D charts dan scientific plots
- Flowcharts dan process diagrams
- Pseudocode dan executable algorithms
- Diagram kompleks (infra, ERD, 3D)
- Halaman layout multi-view

Saat ini renderer hanya menghasilkan output SVG. Task ini menambahkan kemampuan output ke PNG dan JPG.

## Requirement Analysis

### Fungsional
1. CLI menerima opsi `--format` dengan nilai: `svg`, `png`, `jpg`
2. Renderer menghasilkan file sesuai format yang diminta
3. Kualitas output PNG/JPG optimal untuk publikasi
4. Support resolusi tinggi untuk printing

### Non-Functional
- Performa render tidak boleh terlalu lambat
- Output valid dan dapat dibuka viewer standar
- Compatible dengan existing SVG rendering pipeline

## Implementation Plan

### Dependencies
- Tambahkan `sharp` sebagai dependency untuk konversi SVG ke PNG/JPG

### Files yang Diubah

1. **package.json** - Tambah dependency `sharp`

2. **src/cli.ts** - Tambah argumen CLI:
   ```
   --format <svg|png|jpg>   Output format (default: svg)
   --scale <number>         Scale factor untuk resolusi (default: 1)
   --quality <1-100>         JPEG quality (default: 90)
   ```

3. **src/renderer/index.ts** - Modifikasi:
   - Tambah `format` options: 'svg' | 'png' | 'jpg'
   - Tambah method konversi SVG ke PNG/JPG menggunakan sharp
   - Modify `writeSvg` menjadi lebih general `writeOutput`

### Logic / Pseudocode

```typescript
// Di renderer/index.ts
interface RenderOptions {
  outputDir?: string;
  format?: 'svg' | 'png' | 'jpg';  // TAMBAH
  scale?: number;                   // TAMBAH (default 1)
  quality?: number;                 // TAMBAH (default 90 for jpg)
  baseDir?: string;
  skipValidation?: boolean;
  validationReport?: boolean;
}

// Method konversi
async convertSvgToRaster(svg: string, format: 'png' | 'jpg', options: {
  scale: number,
  quality: number
}): Promise<Buffer> {
  // 1. Parse SVG dimensions
  // 2. Create sharp SVG buffer
  // 3. Resize dengan scale factor
  // 4. Convert ke format yang diminta
  // 5. Return buffer
}
```

### CLI Usage Example
```bash
# Render ke PNG
graphscript render input.gs -o output --format png

# Render ke JPG dengan kualitas 80
graphscript render input.gs -o output --format jpg --quality 80

# Render ke PNG dengan skala 2x (high resolution)
graphscript render input.gs -o output --format png --scale 2

# Default (SVG)
graphscript render input.gs -o output
```

## Validation / Testing Plan

1. **Build Test**: 
   - `npm run build` berhasil tanpa error

2. **Manual Test**:
   - `node dist/cli.js render examples/hello-chart.gs -o output --format png`
   - `node dist/cli.js render examples/hello-chart.gs -o output --format jpg`
   - Buka hasil di browser/image viewer
   - Cek apakah readable dan tidak corrupt

## Acceptance Criteria

- [x] `graphscript render demo.gs --format png` menghasilkan file .png valid
- [x] `graphscript render demo.gs --format jpg` menghasilkan file .jpg valid
- [x] Opsi `--scale` berfungsi dengan benar
- [x] Opsi `--quality` berfungsi untuk JPG
- [x] Default behavior tidak berubah (tetap SVG)
- [x] Build berhasil tanpa error
