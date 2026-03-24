# Renderer Composite, Image Import, LaTeX, and SVG Validity

## Status

Implemented

## Summary

Dokumen ini merangkum kemampuan renderer GraphScript yang ditambahkan untuk mendukung diagram akademik kompleks seperti `Gambar 4.16 - Pengukuran Hamiltonian VQE`, termasuk:

- diagram komposit dengan banyak sub-komponen dalam satu canvas
- import asset gambar lokal ke dalam diagram
- rendering formula dan inline math berbasis LaTeX
- output SVG self-contained yang valid secara XML

Fitur-fitur ini diimplementasikan di jalur renderer aktif pada folder `src/renderer`.

## Goals

- Memungkinkan satu file `.gs` menghasilkan satu diagram besar yang berisi beberapa panel, anotasi, konektor, dan sub-gambar.
- Memungkinkan pemakaian asset hasil ekspor eksternal seperti PNG/SVG Qiskit ke dalam layout GraphScript.
- Merender notasi ilmiah dan rumus kuantum secara native, bukan sekadar teks italic biasa.
- Menjaga readability sebagai prioritas utama: teks tidak overlap, formula tidak rusak, dan SVG bisa dibuka oleh viewer XML/SVG standar.

## Non-Goals

- Tidak membuat renderer baru terpisah di `packages/renderer-svg`.
- Tidak mengubah DSL `flow` menjadi full rich-layout engine.
- Tidak membuat obstacle-routing kompleks untuk connector.
- Tidak menambah dukungan semua format image; v1 fokus pada `.png` dan `.svg`.

## Implemented Capabilities

### 1. Diagram komposit akademik

Renderer `diagram` sekarang dipakai sebagai basis utama untuk gambar komposit akademik. Satu diagram bisa berisi:

- header bar penuh
- panel klasik dan kuantum
- card atau box bertingkat
- callout dashed
- divider vertikal atau horizontal
- connector lintas panel
- embed asset image
- formula LaTeX block dan inline

Use case yang menjadi target utama adalah `temp/fig-4-16-vqe-measurement.gs`.

### 2. Primitive `image(...)` untuk asset lokal

Runtime sekarang mendukung builtin:

```gs
const ansatz = image("assets/vqe/ansatz.png")
```

Builtin ini menghasilkan descriptor asset yang dapat dipakai oleh primitive `image` di `diagram`.

Contoh:

```gs
image ansatzPreview x=100 y=120 w=220 h=110 src=ansatz fit="contain"
```

Perilaku implementasi:

- asset path di-resolve relatif terhadap file `.gs`
- PNG dan SVG di-inline ke output SVG sebagai data URI
- output menjadi self-contained dan portable
- mode fit yang didukung:
  - `contain`
  - `cover`
  - `stretch`

### 3. LaTeX rendering native

Renderer sekarang mendukung LaTeX native menggunakan MathJax server-side.

Capability yang diimplementasikan:

- `formula` dirender sebagai SVG MathJax
- label, subtitle, dan text pada `diagram` mendukung inline math campuran
- mode parsing teks:
  - `latex=auto`
  - `latex=on`
  - `latex=off`

Contoh:

```gs
formula h value="H = c0 II + c1 ZI + c2 IZ + c3 ZZ + c4 XX + c5 YY"
text out value="Energi optimal ($E_{opt}$)"
```

Perilaku parsing:

- `formula` selalu diperlakukan sebagai formula
- `latex=auto` hanya aktif jika ada delimiter eksplisit seperti `$...$`, `$$...$$`, `\(...\)`, atau `\[...\]`
- inline math diperlakukan sebagai token atomik saat wrapping

### 4. SVG validity fixes

Selama integrasi MathJax, ditemukan dua sumber invalid XML:

1. root SVG belum mendeklarasikan namespace `xmlns:xlink`
2. body SVG MathJax membawa atribut `data-latex` dengan karakter seperti `<` yang belum di-escape

Perbaikan yang sudah diimplementasikan:

- root document sekarang memakai:

```xml
xmlns="http://www.w3.org/2000/svg"
xmlns:xlink="http://www.w3.org/1999/xlink"
```

- fragment SVG hasil MathJax disanitasi agar nilai atribut XML valid

Hasil akhir:

- output SVG dengan formula LaTeX dapat diparse sebagai XML
- viewer SVG yang ketat tidak lagi gagal karena `xlink:href` atau atribut `<` mentah

## DSL Surface

### Builtin runtime

```gs
image(path: string)
```

Menghasilkan object asset dengan tipe internal `imageAsset`.

### Primitive diagram

```gs
image <name> src=<expr> x=<num> y=<num> w=<num> h=<num>
```

Properti yang dipakai saat ini:

- `src`
- `x`
- `y`
- `w`
- `h`
- `fit`
- `radius`
- `opacity`

### Properti teks LaTeX-aware

Elemen teks-bearing di `diagram` dapat memakai:

```gs
latex="auto"
latex="on"
latex="off"
```

## Main Files

Perubahan terpusat pada file-file berikut:

- [src/renderer/common.ts](/D:/Ivan/TA/graph-script/src/renderer/common.ts)
- [src/renderer/diagram.ts](/D:/Ivan/TA/graph-script/src/renderer/diagram.ts)
- [src/renderer/latex.ts](/D:/Ivan/TA/graph-script/src/renderer/latex.ts)
- [src/renderer/index.ts](/D:/Ivan/TA/graph-script/src/renderer/index.ts)
- [src/cli.ts](/D:/Ivan/TA/graph-script/src/cli.ts)

Use case utama:

- [temp/fig-4-16-vqe-measurement.gs](/D:/Ivan/TA/graph-script/temp/fig-4-16-vqe-measurement.gs)

## Rendering Pipeline

### Image asset pipeline

1. `.gs` dievaluasi
2. `image("...")` menghasilkan descriptor asset
3. renderer `diagram` me-resolve path relatif ke file sumber
4. asset dibaca dari disk
5. asset di-inline ke output SVG sebagai data URI

### LaTeX pipeline

1. field teks diperiksa apakah perlu mode LaTeX
2. formula dikonversi ke SVG via MathJax
3. fragment SVG diekstrak
4. atribut sensitif XML disanitasi
5. fragment ditempatkan ke layout diagram sebagai nested SVG

## Acceptance Criteria

Fitur dianggap selesai bila:

- `temp/fig-4-16-vqe-measurement.gs` dapat di-render tanpa error
- output memakai asset image lokal hasil ekspor
- formula Hamiltonian, ekspektasi, dan state vector dapat tampil
- SVG hasil render valid sebagai XML
- diagram tetap readable dan tidak rusak karena formula atau image embed

## Known Constraints

- `flow` belum mendapat engine rich text/LaTeX penuh seperti `diagram`
- auto-layout komposit masih semi-manual; posisi elemen besar tetap diarahkan lewat DSL
- image cropping otomatis terhadap whitespace asset belum disediakan
- obstacle avoidance connector belum otomatis

## Recommended Usage

- Gunakan `diagram` untuk gambar akademik kompleks multi-panel.
- Gunakan `image(...)` jika komponen asli memang lebih tepat diambil dari output eksternal.
- Gunakan `formula` untuk rumus block.
- Gunakan inline math hanya pada teks yang memang membutuhkan notasi ilmiah.
- Validasi file akhir sebagai XML bila diagram mengandung LaTeX atau nested asset SVG.

## Validation Notes

Validasi yang sudah dilakukan selama implementasi:

- `npm run build`
- render `temp/fig-4-16-vqe-measurement.gs` ke folder output
- parse hasil SVG sebagai XML
- verifikasi namespace `xlink`
- verifikasi sanitasi atribut MathJax

## Future Work

- Menambah layout container yang lebih declarative untuk diagram komposit
- Memperluas dukungan LaTeX ke `flow`
- Menambah test snapshot SVG untuk kasus image + latex + connector
- Menambah normalisasi asset image untuk border putih dan sizing otomatis
