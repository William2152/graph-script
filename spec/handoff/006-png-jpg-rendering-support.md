# 006 - PNG/JPG Rendering Support

## Status

Implemented

## Summary

Fitur export/render ke format PNG dan JPG telah berhasil ditambahkan ke GraphScript. Sebelumnya renderer hanya menghasilkan output SVG, kini user dapat menghasilkan output raster format PNG dan JPG untuk kebutuhan publikasi dan dokumentasi.

## Goals

- Memungkinkan output ke format PNG untuk transparansi dan grafik web
- Memungkinkan output ke format JPG untuk dokumen dan print
- Support skala/resolusi tinggi untuk kebutuhan print quality
- Kualitas output JPG configurable melalui opsi quality

## Non-Goals

- Tidak menambahkan format output lain (PDF, WebP, dll) - bisa di-expand nanti
- Tidak mengubah pipeline rendering SVG yang sudah ada

## Implemented Capabilities

### 1. CLI Options Baru

```bash
--format <svg|png|jpg>   Output format (default: svg)
--scale <number>         Scale factor untuk resolusi (default: 1)
--quality <1-100>        JPEG quality (default: 90)
```

### 2. Contoh Penggunaan

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

### 3. Library

Menggunakan `sharp` v0.33.2 untuk konversi SVG ke PNG/JPG. Sharp dipilih karena:
- Performa tinggi untuk image processing
- Kompatibel dengan Node.js 18+
- Mendukung SVG sebagai input
- Kualitas output baik

## Main Files

- [package.json](/D:/Ivan/TA/graph-script/package.json) - Added sharp dependency
- [src/cli.ts](/D:/Ivan/TA/graph-script/src/cli.ts) - Added CLI options parsing
- [src/renderer/index.ts](/D:/Ivan/TA/graph-script/src/renderer/index.ts) - Added format conversion logic

## Implementation Details

### Konversi Pipeline

1. Generate SVG seperti biasa
2. Parse dimensi SVG (width, height)
3. Apply scale factor jika specified
4. Konversi ke format target menggunakan sharp:
   - PNG: `sharp.svg().png().toFile()`
   - JPG: `sharp.svg().jpeg({ quality }).toFile()`
5. Tulis ke file output

### Error Handling

Jika konversi gagal (misal: SVG tidak valid), fallback ke SVG:
```typescript
try {
  // conversion logic
} catch (error) {
  // fallback to SVG
}
```

## Testing Results

### Build Test
```
npm run build ✓
```

### Render Tests
```
# PNG
node dist/cli.js render examples/hello-chart.gs -o output_test --format png
✓ Rendered chart: output_test\Squares.png

# JPG with quality
node dist/cli.js render examples/hello-chart.gs -o output_test --format jpg --quality 80
✓ Rendered chart: output_test\Squares.jpg

# PNG with scale 2x
node dist/cli.js render examples/hello-chart.gs -o output_test --format png --scale 2
✓ Rendered chart: output_test\Squares.png

# Default SVG (no change)
node dist/cli.js render examples/hello-chart.gs -o output_test
✓ Rendered chart: output_test\Squares.svg

# Complex diagram
node dist/cli.js render temp/fig-4-16-vqe-measurement.gs -o output_vqe_test --format png
✓ Rendered diagram: output_vqe_test\Gambar 4.16 - Pengukuran Hamiltonian VQE.png
```

### Output File Sizes (hello-chart.gs)
- Squares.svg: 4,471 bytes
- Squares.png: 41,536 bytes
- Squares.jpg: 19,389 bytes (quality 80)

## Acceptance Criteria

- [x] `--format png` menghasilkan file .png valid
- [x] `--format jpg` menghasilkan file .jpg valid
- [x] `--scale` berfungsi dengan benar (tested with scale=2)
- [x] `--quality` berfungsi untuk JPG (tested with quality=80)
- [x] Default behavior tidak berubah (tetap SVG)
- [x] Build berhasil tanpa error
- [x] Complex diagram render works

## Known Constraints

- Scale factor diterapkan pada dimensi asli SVG - perlu SVG memiliki atribut width/height yang valid
- Untuk diagram sangat besar, memory usage bisa tinggi karena sharp memproses image di memory

## Future Work

- Tambahkan format lain: PDF, WebP
- Support background color options untuk PNG
- Tambahkan DPI option untuk print resolution
- Tambahkan unit test untuk konversi
