# Handoff: Auto-Checking Validator untuk GraphScript

## Session Info
- **Date**: 2026-03-24
- **Task**: Membuat spec untuk fitur AUTO CHECKING sebelum render
- **Status**: Spec completed, ready for implementation

---

## Apa yang Dikerjakan

### 1. Research Codebase
- Membaca dan memahami struktur project GraphScript
- Memahami renderer modules: `diagram.ts`, `flow.ts`, `diagram-semantic.ts`
- Memahami auto-layout system yang sudah ada di `flow.ts`
- Memahami AST types dan element positioning

### 2. Clarification dengan User
User meminta:
- Overlap tolerance: 5 pixels
- Output format: JSON (tidak muncul di gambar)
- Re-layout strategy: Dynamic algorithm dengan max 5x retry
- Intended overlap detection: Kombinasi (parent-child, fillOpacity, allow_overlap property, element type)

### 3. Spec Document Created
File: `spec/001-auto-checking-validator.md`

Isi spec:
- Tujuan dan motivation
- Codebase context
- Perubahan yang akan diimplementasikan
- Pseudocode untuk semua komponen
- Test cases
- Manual testing plan

---

## Key Decisions

1. **Overlap Tolerance**: 5 pixels - cukup ketat untuk quality output
2. **Max Retry**: 5 attempts - balance antara automation dan performance
3. **Re-layout Strategies**: Progressive (spacing +10%, +20%, scale -5%, +30%, -10%)
4. **Intended Overlap Indicators**:
   - Parent-child relationship
   - `fillOpacity < 1`
   - `allow_overlap: true` property
   - Element types: `line`, `arrow`, `connector`

5. **Output Format**: JSON report dengan structure yang jelas

---

## File yang Akan Dibuat

### Baru
- `src/renderer/validator.ts` - Core validation logic
- `output/*-validation.json` - Validation reports

### Dimodifikasi
- `src/renderer/index.ts` - Integrate validator
- `src/cli.ts` - Add validation options

---

## Next Steps untuk Implementasi

1. **Phase 1: Core Validator** (est. 2-3 hours)
   - Create `validator.ts`
   - Implement `extractBoundingBoxes()`
   - Implement `detectOverlaps()`
   - Implement `isIntendedOverlap()`

2. **Phase 2: Readability & Re-layout** (est. 2-3 hours)
   - Implement `calculateReadability()`
   - Implement `attemptRelayout()`
   - Implement re-layout strategies

3. **Phase 3: Integration** (est. 1-2 hours)
   - Update `Renderer` class
   - Update CLI options
   - Add `--skip-validation` and `--validation-report` flags

4. **Phase 4: Testing** (est. 2 hours)
   - Write unit tests
   - Test dengan sample files
   - Performance testing

---

## Test Files untuk Manual Testing

Buat file-file ini di folder `tests/fixtures/`:

1. `no-overlap.gs` - Clean diagram, should pass
2. `obvious-overlap.gs` - Two boxes clearly overlapping
3. `parent-child.gs` - Panel with children inside
4. `transparent-overlap.gs` - Semi-transparent background
5. `allow-overlap.gs` - Explicit `allow_overlap: true`
6. `line-crossing.gs` - Arrow crossing boxes
7. `impossible-layout.gs` - Too many elements, should fail after 5 attempts

---

## Potential Issues & Solutions

### Issue 1: Flow Layout Sudah Bagus
**Solution**: Flow sudah punya auto-layout scoring. Validator untuk Flow hanya double-check. Jika overlap terjadi, bisa adjust `min_font_size` atau `target_width/height`.

### Issue 2: Performance untuk 100+ Elements
**Solution**: O(n^2) acceptable untuk < 200 elements. Jika > 200, bisa gunakan spatial indexing (R-tree) untuk optimization.

### Issue 3: False Positives
**Solution**: Comprehensive intended overlap detection. User bisa override dengan `allow_overlap: true`.

### Issue 4: Complex Connectors
**Solution**: Connectors by design cross elements. Skip overlap check untuk connector paths.

---

## Commands untuk Testing

```bash
# Basic check
graphscript check test.gs

# Render with validation
graphscript render test.gs

# Render with detailed report
graphscript render test.gs --validation-report

# Skip validation (for quick iterations)
graphscript render test.gs --skip-validation
```

---

## JSON Report Example

```json
{
  "timestamp": "2026-03-24T12:00:00.000Z",
  "file": "test.gs",
  "declaration": "my_diagram",
  "attempts": 3,
  "success": true,
  "readabilityScore": 92,
  "issues": [
    {
      "severity": "warning",
      "element1": "box1",
      "element2": "box2",
      "overlapArea": 120,
      "overlapPercentage": 8.5,
      "location": { "x": 100, "y": 80, "width": 50, "height": 40 }
    }
  ],
  "metrics": {
    "minFontSize": 14,
    "avgFontSize": 16.5,
    "minElementSize": 80
  },
  "suggestions": []
}
```

---

## Handoff Notes

1. Spec sudah lengkap dan detail dengan pseudocode
2. Test cases sudah didefinisikan
3. Manual testing plan sudah dibuat
4. Implementation checklist sudah ada
5. Ready untuk mulai implementation phase

Jika ada pertanyaan atau butuh clarification, refer to `spec/001-auto-checking-validator.md`.
