# GraphScript How to Use (Developer Docs)

Dokumen ini fokus ke **cara pakai** GraphScript dari sudut pandang pengguna/developer.

Dokumen ini **tidak** membahas arsitektur internal repo.

---

## 1) Ringkasan singkat fitur/komponen

Dengan file `.gs`, Anda bisa membuat:

- chart 2D (`line`, `scatter`, `bar`, `area`, `pie`, `box`)
- flowchart proses/algoritma
- diagram bebas (shape, text, formula, graph, image, connector, embed)
- semantic diagram (header/lane/card/connector)
- tabel dari data array atau trace algoritma
- plot 3D (`scatter3d`, `line3d`)
- scene 3D objek (`sphere`, `cube`, `arrow3`)
- ERD database
- diagram infrastruktur
- layout halaman komposit (`page`)
- pseudocode block (`pseudo`)
- algoritma executable + trace (`algo` + `emit`)

Semua dijalankan lewat CLI: `graphscript check`, `graphscript run`, `graphscript render`.

---

## 2) Daftar command/method/API yang tersedia

> Catatan: repo ini **tidak menyediakan REST API endpoint**. Interface utama adalah CLI + syntax `.gs`.

### 2.1 CLI commands

| Command | Tujuan | Kapan dipakai |
|---|---|---|
| `graphscript check <file.gs>` | Parse + execute + validasi readability/overlap | QA sebelum render final |
| `graphscript run <file.gs>` | Execute script dan tampilkan trace algoritma | Debug logika `algo` |
| `graphscript render <file.gs> [options]` | Render declaration visual ke file output | Generate SVG/PNG/JPG |

#### Opsi `render`

| Opsi | Parameter | Default | Fungsi |
|---|---|---|---|
| `-o`, `--output` | `<dir>` | `./output` | Folder output |
| `--format` | `svg \| png \| jpg` | `svg` | Format file |
| `--scale` | `> 0` | `1` | Scale output PNG/JPG |
| `--quality` | `1..100` | `90` | Kualitas JPG |
| `--font-scale` | `> 0` | `1` | Scale font/formula (khusus semantic/diagram text pipeline) |
| `--image-scale` | `> 0` | `1` | Scale elemen image |
| `--fill-images` | flag | `false` | Image di semantic layout diisi lebih agresif |
| `--skip-validation` | flag | `false` | Lewati validator sebelum render |
| `--validation-report` | flag | `false` | Tulis report JSON validasi |

### 2.2 Top-level syntax `.gs` (keyword)

| Syntax | Tujuan |
|---|---|
| `use` | Deklarasi modul (metadata) |
| `import` | Deklarasi import path (metadata) |
| `const` | Konstanta |
| `data` | Binding data |
| `func` | Fungsi |
| `theme` | Theme token (metadata) |
| `style` | Style token (metadata) |
| `sub` | Submodule reusable (eksperimental) |
| `component` | Instansiasi module (eksperimental) |
| `algo` | Algoritma executable |
| `pseudo` | Blok pseudocode |
| `chart` | Chart 2D |
| `flow` | Flowchart |
| `diagram` | Diagram bebas + semantic |
| `table` | Tabel |
| `plot3d` | Plot 3D |
| `scene3d` | Scene 3D |
| `erd` | Entity relationship diagram |
| `infra` | Diagram infrastruktur |
| `page` | Layout halaman |
| `render` | Target output (saat ini metadata saja) |

### 2.3 Statement syntax (di `func` / `algo`)

| Syntax | Tujuan |
|---|---|
| `x = expr` | Assignment |
| `if ...:` / `else if ...:` / `else:` | Branching |
| `while ...:` | Loop |
| `for item in iterable:` | Loop per item |
| `return [expr]` | Return value |
| `break` | Keluar loop |
| `continue` | Lanjut iterasi loop |
| `emit:` + fields | Simpan trace row (biasanya di `algo`) |
| `namaFungsi(...)` | Call expression statement |

---

## 3) Penjelasan tiap item (tujuan, kapan, parameter, hasil, contoh)

## 3.1 CLI usage detail

### A) `graphscript check <file.gs>`

- **Tujuan**: cek parse/execution dan kualitas layout (overlap/readability) untuk declaration yang tervalidasi.
- **Kapan dipakai**: sebelum render final, atau saat tuning layout diagram.
- **Input**: path `.gs`.
- **Output**: ringkasan parse/execution + report validasi di terminal (opsional JSON report).

Contoh:

```bash
graphscript check examples/binary-search.gs
graphscript check examples/hello-chart.gs --validation-report -o output
```

### B) `graphscript run <file.gs>`

- **Tujuan**: jalankan script, tampilkan trace dari `algo`.
- **Kapan dipakai**: debug step-by-step algoritma.
- **Input**: path `.gs`.
- **Output**: tabel trace (`Trace: <AlgoName>` + kolom + baris).

Contoh:

```bash
graphscript run examples/binary-search.gs
```

### C) `graphscript render <file.gs> [options]`

- **Tujuan**: render declaration visual ke file.
- **Kapan dipakai**: generate artefak akhir (`svg/png/jpg`).
- **Output**: file per declaration di output dir.

Contoh:

```bash
graphscript render examples/hello-chart.gs
graphscript render examples/hello-chart.gs --format png --scale 2
graphscript render examples/hello-chart.gs --format jpg --quality 85
graphscript render examples/hello-chart.gs --skip-validation
```

## 3.2 Core syntax `.gs` (umum)

### A) Aturan dasar

- Gunakan indentation konsisten (disarankan 2 spasi).
- Header block selalu diakhiri `:`.
- Komentar: mulai dengan `#`.
- String: `'...'` atau `"..."`.

### B) Literal dan koleksi

```graphscript
const n = 10
const ok = true
const empty = null

data:
  arr = [1, 2, 3]
  obj = { key: "value", count: 2 }
```

### C) Operator dan expression

Didukung:

- aritmetika: `+ - * / % ^`
- perbandingan: `== != < <= > >=`
- boolean: `and or not` (juga `&& ||`)
- ternary: `cond ? a : b`
- member/index: `obj.key`, `arr[0]`
- function call: `nama(arg1, arg2)`

Contoh:

```graphscript
data:
  a = 2 ^ 3
  b = (a > 3) ? 1 : 0
  c = not false
  d = arr[1]
```

### D) Statement control flow

```graphscript
func classify(x):
  if x > 0:
    return "positive"
  else if x < 0:
    return "negative"
  else:
    return "zero"
```

```graphscript
algo Sum(arr):
  total = 0
  for v in arr:
    total = total + v
    emit:
      value = v
      running = total
  return total
```

## 3.3 Deklarasi top-level

### 1) `use <module>`

- **Tujuan**: deklarasi intent modul.
- **Kapan dipakai**: di awal file.
- **Parameter**: nama module (`chart`, `flow`, dst).
- **Hasil**: metadata.

```graphscript
use chart
```

### 2) `import "path.gs"`

- **Tujuan**: deklarasi import file.
- **Kapan dipakai**: saat ingin menandai dependensi script lain.
- **Parameter**: string path.
- **Hasil**: metadata import.

```graphscript
import "common/theme.gs"
```

### 3) `const`

- **Tujuan**: nilai konstan global.
- **Kapan dipakai**: nilai yang tidak berubah.
- **Return/hasil**: tersimpan di scope runtime.

```graphscript
const title = "Demo"
```

### 4) `data:`

- **Tujuan**: binding data awal/derived value.
- **Kapan dipakai**: setup dataset untuk chart/diagram.

```graphscript
data:
  xs = range(0, 10, 1)
  ys = [1, 4, 9, 16]
```

### 5) `func Name(params):`

- **Tujuan**: reusable function.
- **Kapan dipakai**: transformasi/perhitungan berulang.
- **Return**: `return value` (tanpa `return` -> `null`).

```graphscript
func square(x):
  return x * x
```

### 6) `algo Name(params):`

- **Tujuan**: function executable + trace.
- **Kapan dipakai**: algoritma yang ingin divisualisasi langkahnya.
- **Parameter trace**: pakai `emit:` untuk kolom trace.
- **Return**: nilai hasil algoritma.

```graphscript
algo BinarySearch(arr, target):
  low = 0
  high = len(arr) - 1
  step = 0
  while low <= high:
    mid = floor((low + high) / 2)
    emit:
      step = step
      low = low
      high = high
      mid = mid
    if arr[mid] == target:
      return mid
    else if arr[mid] < target:
      low = mid + 1
    else:
      high = mid - 1
    step = step + 1
  return -1
```

### 7) `pseudo "Title":`

- **Tujuan**: render blok pseudocode statis.
- **Kapan dipakai**: dokumentasi langkah algoritma.
- **Isi**: baris bebas di dalam blok.

```graphscript
pseudo "Binary Search":
  low = 0
  high = n - 1
  while low <= high:
    ...
```

### 8) `chart "Name":`

- **Tujuan**: chart 2D.
- **Kapan dipakai**: visualisasi data numerik/trace.
- **Type tersedia**: `line`, `scatter`, `bar`, `area`, `pie`, `box`.
- **Properti utama**:
  - `type`
  - `x`, `y`
  - `source` (array, matrix, atau trace)
  - `labels`
  - `title`, `xlabel`, `ylabel`
  - `width`, `height`

Contoh dari trace:

```graphscript
chart "Search Trace":
  type = line
  source = BinarySearch.trace
  x = step
  y = mid
  xlabel = "Iteration"
  ylabel = "Mid Index"
```

Contoh pie/bar:

```graphscript
chart "Measurement Probabilities":
  type = pie
  source = [0.3, 0.2, 0.5]
  labels = ["Q0", "Q1", "Q2"]
```

### 9) `flow "Name":`

- **Tujuan**: flowchart.
- **Kapan dipakai**: decision/process path.
- **Node syntax**: `node <id> type=<...> label="..."`
- **Edge syntax**: `<from> -> <to> [label="..."]`
- **Node type umum**: `start`, `end`, `process`, `decision`, `data`
- **Properti layout penting**:
  - `direction = top_down | left_right`
  - `layout_mode = auto | single_row | snake | vertical`
  - `fit = readable | compact`
  - `target_width`, `target_height`
  - `preferred_font_size`, `min_font_size`

```graphscript
flow "Decision Process":
  direction = left_right
  layout_mode = auto
  fit = compact

  node start type=start label="Start"
  node check type=decision label="Valid?"
  node ok type=process label="Process"
  node end type=end label="End"

  start -> check
  check -> ok label="Yes"
  check -> end label="No"
  ok -> end
```

### 10) `diagram "Name":`

- **Tujuan**: diagram bebas (infographic/annotated figure).
- **Kapan dipakai**: layout visual custom, termasuk embed render target lain.
- **Properti global umum**:
  - `width`, `height`
  - `background`
  - `title`, `subtitle`
  - `font_family`
  - `fixed_canvas`

#### Elemen diagram (non-semantic)

| Elemen | Tujuan | Properti inti |
|---|---|---|
| `panel`, `box` | container | `x y w h label subtitle fill stroke radius` |
| `text` | teks | `x y value size anchor color weight` |
| `formula` | formula latex | `x y value size color` |
| `circle`, `ellipse` | shape | `x y w h label fill stroke` |
| `graph` | graf native dengan child `node` dan `edge` | `x y w h layout padding seed iterations` |
| `grid`, `checker` | pola grid | `x y w h rows cols` |
| `badge`, `callout` | anotasi | `x y w h label subtitle` |
| `image` | gambar | `x y w h src fit opacity` |
| `line`, `arrow` | konektor | `x y x2 y2 label stroke strokeWidth dash` |
| `embed` | sisipkan hasil render target lain | `x y w h target` |

Contoh:

```graphscript
diagram "Oracle":
  width = 1000
  height = 620
  title = "Deutsch-Jozsa Oracle"

  panel left x=60 y=120 w=360 h=220 label="Constant" fill="#dbeafe"
  panel right x=560 y=120 w=360 h=220 label="Balanced" fill="#fef3c7"
  arrow link x=420 y=230 x2=560 y2=230 label="f(x)"
```

#### Elemen `graph` (native graph drawing)

- `graph` dipakai untuk menggambar graf secara native tanpa menyusun `circle` + `line` manual.
- `graph` sendiri tidak menggambar background. Jika butuh panel/card, bungkus dengan `box`, `panel`, atau semantic `card`.
- Child yang valid di dalam `graph` hanya:
  - `node`
  - `edge`

Properti utama `graph`:

- `x y w h`
- `layout="manual|circle|force"`
- `padding`
- `seed`
- `iterations`
- default style graph-level:
  - `node_radius`, `node_fill`, `node_stroke`, `node_color`, `node_size`
  - `edge_stroke`, `edge_strokeWidth`, `edge_dash`

Aturan:

- `layout="manual"`: tiap `node` harus punya `x` dan `y` sebagai koordinat pusat node relatif ke box `graph`.
- `layout="circle"`: posisi node dihitung otomatis dari urutan deklarasi node.
- `layout="force"`: posisi node dihitung otomatis dengan force-like layout deterministik memakai `seed` dan `iterations`.
- `edge from="..." to="..."` harus menunjuk ke `node` di graph yang sama.
- `connector` semantic berbeda dari edge graph:
  - `connector` untuk routing antar `card`
  - `edge` untuk sisi pada graf

Contoh `graph` di dalam `panel`:

```graphscript
diagram "K3 Example":
  width = 900
  height = 520

  panel left x=60 y=80 w=320 h=320 label="Graf K3" fill="#f8fafc":
    graph k3 x=36 y=74 w=248 h=210 layout="circle" padding=30 node_radius=22 node_size=18 edge_strokeWidth=4:
      node n1 label="1" fill="#2563eb" stroke="#2563eb" color="#ffffff"
      node n0 label="0" fill="#2563eb" stroke="#2563eb" color="#ffffff"
      node n2 label="2" fill="#f97316" stroke="#f97316" color="#ffffff"
      edge e10 from="n1" to="n0" stroke="#cbd5e1"
      edge e12 from="n1" to="n2" stroke="#f97316" dash="10 6"
      edge e02 from="n0" to="n2" stroke="#f97316" dash="10 6"
```

Contoh `graph` di dalam semantic `card`:

```graphscript
diagram "Semantic Graph":
  width = 1200
  height = 800
  header top title="Graph Inside Card"
  lane main section="main" order=1 columns=1

  card graphCard section="main" row=1 label="Graph":
    graph sample w=340 h=240 layout="force" seed=7 iterations=90:
      node a label="a"
      node b label="b"
      node c label="c"
      node d label="d"
      edge ab from="a" to="b"
      edge ac from="a" to="c"
      edge bd from="b" to="d"
      edge cd from="c" to="d"
```

#### Semantic diagram (opsi lanjutan)

Elemen semantic:

- `header`
- `separator`
- `lane`
- `card`
- `connector`
- `loop_label`

Container child semantic:

- `group` (`layout=stack|row|columns`)
- `divider`
- `spacer`

Contoh semantic minimal:

```graphscript
diagram "Semantic":
  width = 1400
  height = 900
  header top title="Pipeline"
  separator split labels=["Classical", "Quantum"]
  lane classical section="classical" order=1 ratio=0.45 columns=1
  lane quantum section="quantum" order=2 ratio=0.55 columns=2

  card energy section="classical" row=1 label="Energy":
    formula eq value="<H> = Sum_i c_i <P_i>"

  card ansatz section="quantum" row=1 col=1 label="Ansatz":
    text prep value="State Preparation"

  card measure section="quantum" row=1 col=2 label="Measurement":
    text m value="Pauli strings"

  connector c1 from="energy.right" to="ansatz.left" label="params"
  connector c2 from="ansatz.right" to="measure.left" route="hvh"
```

### 11) `table "Name":`

- **Tujuan**: render tabel.
- **Kapan dipakai**: tampilkan data tabular atau trace algo.
- **Properti utama**:
  - `source` (trace atau dataset)
  - `columns` (opsional)
  - `rows` (opsional)

Contoh dari trace:

```graphscript
table "Trace Table":
  source = BinarySearch.trace
```

Contoh explicit rows:

```graphscript
table "Scores":
  columns = ["name", "score"]
  rows = [["A", 90], ["B", 82]]
```

### 12) `plot3d "Name":`

- **Tujuan**: plot 3D data point.
- **Kapan dipakai**: data 3D sederhana.
- **Type**: `scatter3d` atau `line3d`
- **Properti**: `x`, `y`, `z`, `type`, `title`, `width`, `height`

```graphscript
plot3d "Qubit trajectory":
  type = scatter3d
  x = [0, 0.2, 0.4]
  y = [0, 0.1, 0.3]
  z = [1, 0.8, 0.5]
```

### 13) `scene3d "Name":`

- **Tujuan**: scene 3D objek.
- **Kapan dipakai**: visual state/vektor di ruang 3D.
- **Properti global**: `width`, `height`, `title`, `scale`
- **Elemen didukung**:
  - `sphere ... x y z radius color label`
  - `cube ... x y z size color label`
  - `arrow3 ... x y z dx dy dz color label` (alias `vector`)

```graphscript
scene3d "Qubit State":
  sphere state x=0.5 y=0.5 z=0.707 radius=0.12 color="#2563eb" label="|psi>"
  arrow3 v x=0 y=0 z=0 dx=0.5 dy=0.5 dz=0.707 color="#ef4444" label="Bloch vector"
```

### 14) `erd "Name":`

- **Tujuan**: diagram schema database.
- **Kapan dipakai**: dokumentasi relasi tabel.
- **Syntax field**: `field: type [constraint...]`
- **Syntax relasi**: `tableA.id -> tableB.fk one-to-many`

```graphscript
erd "App DB":
  table users:
    id: int pk
    name: string
  table posts:
    id: int pk
    user_id: int fk
    title: string
  users.id -> posts.user_id one-to-many
```

### 15) `infra <provider> "Name":`

- **Tujuan**: diagram infrastruktur.
- **Kapan dipakai**: komunikasi arsitektur platform.
- **Syntax elemen**: `<type> <name> [attr=val ...]`
- **Syntax koneksi**: `<from> -> <to> [label="..."]`
- **Properti global**: `width`, `height` (provider juga ditampilkan sebagai label)

```graphscript
infra aws "Platform":
  user client label="Researcher"
  gateway edge label="API Gateway"
  service api label="Orchestrator"
  database db label="Results DB"
  client -> edge
  edge -> api
  api -> db label="write"
```

### 16) `page "Name":`

- **Tujuan**: gabungkan beberapa render target dalam satu halaman.
- **Kapan dipakai**: report/dashboard ringkas.
- **Properti**:
  - `width`, `height`
  - `columns`, `rows`
  - `gap`, `margin`
  - `title`, `subtitle`
- **Placement syntax**: `place "<TargetName>" at cell(r, c)`

```graphscript
page "Report":
  columns = 2
  rows = 2
  place "Search Trace" at cell(1, 1)
  place "Trace Table" at cell(1, 2)
```

### 17) `theme`, `style`, `sub`, `component`, `render`

#### `theme <name>:`

- **Tujuan**: menyimpan token tema (warna/dll) sebagai deklarasi.
- **Kapan dipakai**: saat ingin menyiapkan style token terpusat.
- **Status saat ini**: diparse dan disimpan, belum otomatis dipakai renderer.

```graphscript
theme dark:
  primary = "#2563eb"
  background = "#0f172a"
```

#### `style <name>:`

- **Tujuan**: deklarasi style reusable.
- **Kapan dipakai**: menyiapkan style naming convention di script.
- **Status saat ini**: diparse dan disimpan, belum auto-apply ke elemen.

```graphscript
style cardPrimary:
  fill = "#dbeafe"
  stroke = "#2563eb"
```

#### `sub Name(params):`

- **Tujuan**: deklarasi modul/subprogram.
- **Kapan dipakai**: saat ingin struktur script modular.
- **Status saat ini**: syntax tersedia, namun runtime masih terbatas untuk pipeline penuh reusable-component.

```graphscript
sub DemoModule(a, b):
  const title = "Demo"
```

#### `component Name = Module(args...)`

- **Tujuan**: instantiate module/function dengan named args.
- **Kapan dipakai**: mencoba pola komposisi berbasis module.
- **Status saat ini**: syntax tersedia, interoperabilitas bergantung bentuk module runtime.

```graphscript
component inst = DemoModule(a = 1, b = 2)
```

#### `render:`

- **Tujuan**: deklarasi target output (metadata).
- **Kapan dipakai**: mendokumentasikan target artefak per declaration.
- **Status saat ini**: block diparse, tetapi belum menjadi filter utama output pada CLI `render`.

```graphscript
render:
  target chart "Search Trace" to "output/search.svg"
```

---

Semua keyword di atas bisa diparse, tetapi untuk versi implementasi saat ini:

- `theme` / `style`: tersimpan sebagai declaration, **tidak otomatis diaplikasikan renderer**.
- `sub`: bisa dideklarasikan, namun perilaku runtime masih terbatas.
- `component`: syntax tersedia, tetapi interop module-function belum untuk semua skenario.
- `render:` + `target ... to "..."`
  - syntax diparse
  - **CLI `render` saat ini tetap merender semua declaration renderable**, tidak difilter oleh block `render`.

## 3.4 Built-in function

| Fungsi | Signature | Return | Kapan dipakai |
|---|---|---|---|
| `range` | `range(start, end, step=1)` | `number[]` | bikin range |
| `linspace` | `linspace(start, end, count)` | `number[]` | sampling merata |
| `len` | `len(value)` | `number` | panjang array/string/object |
| fungsi math | `sin/cos/tan/exp/log/sqrt/abs/floor/ceil/round/pow/min/max` | `number` | operasi math umum |
| `clamp` | `clamp(value, lo, hi)` | number | batasi nilai |
| `sigmoid` | `sigmoid(x)` | number | aktivasi sigmoid |
| `tanh` | `tanh(x)` | number | aktivasi tanh |
| `map` | `map(arr, fn)` | `array` | transform elemen array |
| `filter` | `filter(arr, fn)` | `array` | saring elemen array |
| `reduce` | `reduce(arr, fn, init?)` | `any` | agregasi array |
| `zip` | `zip(arr1, arr2, ...)` | `array[]` | gabung beberapa array per index |
| `str` | `str(value)` | string | konversi string |
| `print` | `print(...args)` | `null` | debug output |
| `image` | `image("path.png")` | imageAsset object | source image untuk diagram |
| konstanta | `PI`, `E`, `true`, `false`, `null` | literal | konstanta |

Catatan:

- Runtime juga mengekspos banyak fungsi lain dari JavaScript `Math` (`...Math`).
- Untuk `reduce`, lebih aman selalu kirim `init`.
- `map/filter/reduce` menerima callback function, tetapi callback dari DSL (`func`) saat ini masih punya batasan kompatibilitas tertentu.

Contoh:

```graphscript
data:
  xs = range(0, 10, 1)
  count = len(xs)
  title = str(count)
  logo = image("assets/logo.svg")
```

## 3.5 Perbedaan opsi/metode yang sering bingung

### `check` vs `run` vs `render`

- **check**: fokus validasi/layout quality.
- **run**: fokus hasil eksekusi + trace algoritma.
- **render**: fokus output file visual.

### `chart` vs `plot3d` vs `scene3d`

- `chart`: 2D chart statistik.
- `plot3d`: point/line data 3D.
- `scene3d`: object scene (sphere/cube/vector) 3D.

### `diagram` biasa vs semantic diagram

- Diagram biasa: posisi manual (`x,y,w,h`) lebih bebas.
- Semantic: pakai `lane/card/connector` untuk auto layout dengan struktur presentasi.
- Edge graf native dipakai di dalam `graph`; semantic `connector` tetap dipakai antar-card, bukan antar-node graf.

### Route connector semantic

- `auto`: engine pilih jalur terbaik.
- `hv`, `vh`, `hvh`, `vhv`: paksa pola routing ortogonal tertentu.

---

## 4) Catatan penting, limitation, dan error umum

## A) Limitasi penting saat ini

- `import` hanya diparse sebagai metadata; file import belum dieksekusi otomatis.
- `use` tidak mempengaruhi eksekusi/runtime secara langsung.
- `render:` block belum mengontrol daftar output render CLI.
- `theme` dan `style` belum menjadi sistem styling otomatis global.
- `plot3d` saat ini hanya `scatter3d` / `line3d`.
- `chart` type yang benar-benar tersedia: `line`, `scatter`, `bar`, `area`, `pie`, `box`.
- `image` diagram hanya mendukung asset `png` dan `svg`.
- `for ... in` berjalan untuk iterable array; non-array akan di-skip.
- Untuk trace, algoritma harus **dipanggil dulu** sebelum `AlgoName.trace` dipakai.
- `map/filter/reduce` ada di runtime, tetapi passing function dari DSL saat ini terbatas; gunakan dengan hati-hati.

## B) Error umum (yang sering muncul)

- `Error: File not found: ...`
- `Unsupported top-level declaration at line ...`
- `Invalid <declaration> at line ...`
- `Expression parse error on line ...`
- `Image asset not found: ...`
- `Unsupported image asset format: ...`
- `Missing embed: <target>`
- `No algorithm traces found.`

## C) Best practice cepat

- Simpan label yang mengandung spasi dalam quote (`label="My Label"`).
- Untuk flow, selalu pakai `label="..."` di edge jika butuh teks.
- Untuk diagram, letakkan properti global (`width`, `height`, `title`) **sebelum** elemen diagram.
- Jalankan `check` dulu sebelum `render` pada diagram kompleks.
- Gunakan `--validation-report` untuk audit layout.

---

## 5) Contoh use case end-to-end

Berikut contoh script yang:

1. Menjalankan algoritma
2. Menghasilkan trace
3. Menampilkan trace jadi chart + table
4. Menyusun ringkasan flow
5. Menggabungkan ke page

```graphscript
use chart

algo BinarySearch(arr, target):
  low = 0
  high = len(arr) - 1
  step = 0

  while low <= high:
    mid = floor((low + high) / 2)
    emit:
      step = step
      low = low
      high = high
      mid = mid
      value = arr[mid]

    if arr[mid] == target:
      return mid
    else if arr[mid] < target:
      low = mid + 1
    else:
      high = mid - 1
    step = step + 1

  return -1

data:
  sorted = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  result = BinarySearch(sorted, 11)

chart "Search Trace":
  type = line
  source = BinarySearch.trace
  x = step
  y = mid
  xlabel = "Iteration"
  ylabel = "Mid Index"

table "Trace Table":
  source = BinarySearch.trace

flow "Summary":
  node start type=start label="Start"
  node run type=process label="Run BinarySearch"
  node ok type=decision label="Found target?"
  node end type=end label="Done"

  start -> run
  run -> ok
  ok -> end label="yes/no"

page "Search Report":
  columns = 2
  rows = 2
  title = "Binary Search Report"
  place "Search Trace" at cell(1, 1)
  place "Trace Table" at cell(1, 2)
  place "Summary" at cell(2, 1)
```

Jalankan:

```bash
graphscript run demo.gs
graphscript check demo.gs --validation-report
graphscript render demo.gs -o output --format svg
```
