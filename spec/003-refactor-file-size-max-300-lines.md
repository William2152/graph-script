# Spec: Refactor File Size to Max 300 Lines

## Prompt
User wants to refactor the GraphScript project to ensure each TypeScript file is no longer than 300 lines, while maintaining 100% behavioral equivalence (before and after refactoring must be functionally identical).

## Purpose
Split large files into smaller, more maintainable modules without changing any functionality.

## Why This Is Important
1. **Maintainability**: Smaller files are easier to read and understand
2. **Single Responsibility**: Each file focuses on one responsibility
3. **Testability**: Unit testing is easier for smaller modules
4. **Code Review**: Reviewers can more easily understand changes
5. **Navigation**: Easier to find specific code

---

## Current State Analysis

### Files Exceeding 300 Lines (Latest)

| File | Lines | Category | Status |
|------|-------|----------|--------|
| `src/renderer/diagram-semantic.ts` | 1077 | Renderer | Needs split |
| `src/parser/index.ts` | 874 | Parser | Needs split |
| `src/renderer/validator.ts` | ~1065 | Renderer | **CHANGED** - User already modified |
| `src/parser/declarations.ts` | 645 | Parser | Needs split |
| `src/renderer/flow.ts` | 617 | Renderer | Needs split |
| `src/renderer/latex.ts` | 554 | Renderer | **CHANGED** - User already modified |
| `src/renderer/chart.ts` | 517 | Renderer | Needs split |
| `src/ast/types.ts` | 460 | AST | Needs split |
| `src/renderer/diagram.ts` | 368 | Renderer | **CHANGED** - User already modified |
| `src/parser/statements.ts` | 349 | Parser | Needs split |

> **Note**: Beberapa file sudah dimodifikasi user (validator.ts, latex.ts, diagram.ts). Data di atas mencerminkan line count terbaru.

### Files Within Limit (Keep As Is)

| File | Lines | Status |
|------|-------|--------|
| `src/parser/expressions.ts` | 300 | ✅ At limit |
| `src/runtime/index.ts` | 292 | ✅ OK |
| `src/renderer/common.ts` | 217 | ✅ OK |
| `src/tokenizer/index.ts` | 202 | ✅ OK |
| `src/cli.ts` | 195 | ✅ OK |
| `src/renderer/plot3d.ts` | 165 | ✅ OK |
| `src/renderer/table.ts` | 144 | ✅ OK |
| `src/renderer/index.ts` | 137 | ✅ OK |
| `src/renderer/infra.ts` | 114 | ✅ OK |
| `src/runtime/builtins.ts` | 81 | ✅ OK |
| `src/runtime/values.ts` | 67 | ✅ OK |
| `src/runtime/scope.ts` | 64 | ✅ OK |
| `src/renderer/erd.ts` | 60 | ✅ OK |
| `src/renderer/page.ts` | 45 | ✅ OK |
| `src/renderer/pseudo.ts` | 20 | ✅ OK |
| `src/tokenizer/types.ts` | 19 | ✅ OK |

---

## Ensuring 100% Behavioral Equivalence

### Strategy

1. **No Logic Changes**: Only move code, never modify logic
2. **Preserve All Exports**: All public APIs remain identical
3. **Preserve Types**: All TypeScript types remain the same
4. **Barrel Export Pattern**: Use index.ts to re-export for backward compatibility

### Verification Commands

```bash
# Before refactor - save baseline
npm run build
npm test > baseline-output.txt
sha256sum src/**/*.ts > baseline-hashes.txt

# After each refactor step
npm run build
npm test

# Final verification
npm run build
npm test > final-output.txt
diff baseline-output.txt final-output.txt
# Must be identical!
```

---

## Detailed Refactoring Plan

### User Preferences (Clarified)
- **File Structure**: Subdirectories (e.g., `validator/types.ts`)
- **Export Style**: Barrel exports (import from parent, e.g., `from './validator'`)
- **Priority**: Types first (lowest risk)
- **Testing**: Add more tests before refactoring

---

## Phase 1: AST Types (Lowest Risk)

### Target: `src/ast/types.ts` (460 → 2 files)

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/ast/types.ts` | ~60 | Re-exports all types |
| `src/ast/types-core.ts` | ~200 | Position, Token, Program, Statements, Expressions |
| `src/ast/types-declarations.ts` | ~250 | All declaration types (Chart, Flow, Diagram, etc.) |

**Functions to Move:**
- All interfaces and types
- No function changes

---

## Phase 2: Renderer - Validator

### Target: `src/renderer/validator.ts` (~1065 lines)

> **Note**: File ini sudah dimodifikasi user dengan penambahan fitur:
> - MIN_FONT_SIZE berubah dari 10 ke 14
> - Ditambah: MIN_LAYOUT_GAP, EXCESSIVE_GAP_MULTIPLIER
> - Ditambah: ValidationIssue interface dengan kind types
> - Ditambah: validation_ignore property
> - Ditambah: detectSiblingGapIssues, detectAwkwardSpacingIssues, detectConnectorCrossPanelIssues
> - Ditambah: connector/panel crossing validation
> - Import dari diagram-semantic dan flow

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/validator/index.ts` | ~80 | Barrel exports, validateAndAdjust |
| `src/renderer/validator/types.ts` | ~150 | All interfaces and constants |
| `src/renderer/validator/detection.ts` | ~250 | extractBoundingBoxes, detectOverlaps, gap detection |
| `src/renderer/validator/readability.ts` | ~150 | calculateReadability, calculateReadabilityScore |
| `src/renderer/validator/relayout.ts` | ~200 | attemptRelayout, re-layout strategies |
| `src/renderer/validator/report.ts` | ~150 | generateReport, writeValidationReport |

---

## Phase 3: Renderer - Diagram Semantic

### Target: `src/renderer/diagram-semantic.ts` (1077 → 4-5 files)

**Current Exports:**
```typescript
export interface SemanticCompileResult { ... }
export function compileSemanticDiagram(...)
export function isSemanticDiagramElement(...)
```

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/diagram-semantic/index.ts` | ~50 | Barrel exports |
| `src/renderer/diagram-semantic/types.ts` | ~100 | All interfaces |
| `src/renderer/diagram-semantic/layout.ts` | ~300 | compileSemanticDiagram, card layout |
| `src/renderer/diagram-semantic/connectors.ts` | ~200 | Connector routing |
| `src/renderer/diagram-semantic/helpers.ts` | ~200 | Anchor points, measurement helpers |

---

## Phase 4: Renderer - Latex

### Target: `src/renderer/latex.ts` (554 lines)

> **Note**: File ini sudah dimodifikasi user.

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/latex/index.ts` | ~50 | Barrel exports |
| `src/renderer/latex/normalize.ts` | ~250 | Normalization functions |
| `src/renderer/latex/render.ts` | ~300 | Main render functions |

---

## Phase 5: Renderer - Chart

### Target: `src/renderer/chart.ts` (517 → 3 files)

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/chart/index.ts` | ~50 | Barrel exports |
| `src/renderer/chart/config.ts` | ~150 | extractChartConfig, buildChartSeries |
| `src/renderer/chart/render.ts` | ~350 | All render functions |

---

## Phase 6: Renderer - Flow

### Target: `src/renderer/flow.ts` (617 → 3 files)

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/flow/index.ts` | ~50 | Barrel exports |
| `src/renderer/flow/layout.ts` | ~350 | Layout algorithms |
| `src/renderer/flow/render.ts` | ~250 | Render functions |

---

## Phase 7: Renderer - Diagram

### Target: `src/renderer/diagram.ts` (368 lines)

> **Note**: File ini sudah dimodifikasi user.

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/renderer/diagram/index.ts` | ~50 | Barrel exports |
| `src/renderer/diagram/render.ts` | ~350 | Main render functions |

---

## Phase 8: Parser - Main

### Target: `src/parser/index.ts` (874 → 4 files)

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/parser/index.ts` | ~100 | Parser class, parse() |
| `src/parser/declarations-basic.ts` | ~250 | use, import, const, data, func |
| `src/parser/declarations-visual.ts` | ~300 | chart, flow, diagram, table |
| `src/parser/helpers.ts` | ~150 | LineInfo, utilities |

---

## Phase 9: Parser - Statements

### Target: `src/parser/statements.ts` (349 → 2 files)

**Proposed Split:**

| New File | Lines | Content |
|----------|-------|---------|
| `src/parser/statements/index.ts` | ~50 | Re-exports |
| `src/parser/statements/parser.ts` | ~300 | StatementParser class |

---

## Implementation Order

1. **Phase 1**: AST types (types.ts)
2. **Phase 2**: Renderer - validator
3. **Phase 3**: Renderer - diagram-semantic
4. **Phase 4**: Renderer - latex
5. **Phase 5**: Renderer - chart
6. **Phase 6**: Renderer - flow
7. **Phase 7**: Renderer - diagram
8. **Phase 8**: Parser - main
9. **Phase 9**: Parser - statements

---

## Testing Strategy

### Before Refactoring (Baseline)
```bash
npm run build
npm test > baseline-output.txt
```

### After Each Phase
```bash
npm run build
npm test
# Verify all tests pass
```

### Final Verification
```bash
npm run build
npm test > final-output.txt
diff baseline-output.txt final-output.txt
# Must be empty (no differences)
```

---

## File Structure After Refactoring

```
src/
├── ast/
│   ├── types.ts              (~60 lines - re-exports)
│   ├── types-core.ts         (~200 lines)
│   └── types-declarations.ts (~250 lines)
├── parser/
│   ├── index.ts             (~100 lines)
│   ├── declarations-basic.ts(~250 lines)
│   ├── declarations-visual.ts(~300 lines)
│   ├── helpers.ts           (~150 lines)
│   ├── expressions.ts       (~300 lines - unchanged)
│   ├── statements/
│   │   ├── index.ts         (~50 lines)
│   │   └── parser.ts        (~300 lines)
│   └── declarations.ts       (DELETE after refactor)
├── renderer/
│   ├── index.ts             (~137 lines - unchanged)
│   ├── common.ts            (~217 lines - unchanged)
│   ├── validator/
│   │   ├── index.ts         (~60 lines)
│   │   ├── types.ts         (~120 lines)
│   │   ├── detection.ts     (~200 lines)
│   │   ├── readability.ts  (~120 lines)
│   │   ├── relayout.ts     (~150 lines)
│   │   └── report.ts       (~120 lines)
│   ├── diagram-semantic/
│   │   ├── index.ts         (~50 lines)
│   │   ├── types.ts         (~100 lines)
│   │   ├── layout.ts       (~300 lines)
│   │   ├── connectors.ts   (~200 lines)
│   │   └── helpers.ts      (~200 lines)
│   ├── latex/
│   │   ├── index.ts         (~50 lines)
│   │   ├── normalize.ts    (~250 lines)
│   │   └── render.ts       (~300 lines)
│   ├── chart/
│   │   ├── index.ts         (~50 lines)
│   │   ├── config.ts        (~150 lines)
│   │   └── render.ts       (~350 lines)
│   ├── flow/
│   │   ├── index.ts         (~50 lines)
│   │   ├── layout.ts        (~350 lines)
│   │   └── render.ts        (~250 lines)
│   ├── diagram/
│   │   ├── index.ts         (~50 lines)
│   │   └── render.ts        (~350 lines)
│   ├── erd.ts              (~60 lines - unchanged)
│   ├── infra.ts            (~114 lines - unchanged)
│   ├── page.ts             (~45 lines - unchanged)
│   ├── plot3d.ts          (~165 lines - unchanged)
│   ├── pseudo.ts            (~20 lines - unchanged)
│   └── scene3d.ts          (~81 lines - unchanged)
├── runtime/
│   ├── index.ts            (~292 lines - unchanged)
│   ├── builtins.ts         (~81 lines - unchanged)
│   ├── values.ts           (~67 lines - unchanged)
│   └── scope.ts            (~64 lines - unchanged)
├── tokenizer/
│   ├── index.ts            (~202 lines - unchanged)
│   └── types.ts            (~19 lines - unchanged)
└── cli.ts                  (~195 lines - unchanged)
```

---

## Rollback Plan

If any refactor breaks functionality:

1. **Git Revert**: Each phase is a separate commit
   ```bash
   git revert <commit-hash>
   ```

2. **Keep Backup**: Copy dist/ before each phase

3. **Incremental**: One phase at a time, easy to identify issues

---

## Verification Checklist (Per Phase)

- [ ] TypeScript compiles without errors
- [ ] All existing tests pass
- [ ] Exports are identical (check with Object.keys)
- [ ] No new dependencies added
- [ ] File is under 300 lines
- [ ] No logic changes (only code movement)
- [ ] Comments preserved
- [ ] Source maps still work

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | AST types | 20 min |
| 2 | validator | 30 min |
| 3 | diagram-semantic | 40 min |
| 4 | latex | 20 min |
| 5 | chart | 20 min |
| 6 | flow | 20 min |
| 7 | diagram | 15 min |
| 8 | parser/index | 30 min |
| 9 | parser/statements | 15 min |
| 10 | Final verification | 30 min |
| **Total** | | **~4 hours** |

---

## Current Issues

### TypeScript Errors in validator.ts

File `src/renderer/validator.ts` saat ini memiliki error TypeScript:
- `absoluteBox` - undefined
- `boxGap` - undefined  
- `verticalGap` - undefined (seharusnya `vertical`)
- `collectConnectorSegments` - undefined
- `segmentIntersectsPanel` - undefined

Ini perlu diperbaiki sebelum melakukan refactoring lebih lanjut.

---

## Handoff Notes

This spec is ready for implementation. Each refactor should:
1. Create new subdirectory with smaller files
2. Create barrel export (index.ts)
3. Update imports in dependent files
4. Run tests to verify
5. Delete old large file

**Important Notes:**
- Beberapa file sudah dimodifikasi user (validator.ts, latex.ts, diagram.ts)
- Perlu fix TypeScript errors di validator.ts terlebih dahulu
- Verifikasi build berhasil sebelum refactoring

All public APIs must remain identical for 100% backward compatibility.
