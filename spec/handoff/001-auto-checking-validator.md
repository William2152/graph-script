# Handoff: Auto-Checking Validator untuk GraphScript

## Session Info
- **Date**: 2026-03-24 (Started), 2026-03-25 (Completed)
- **Task**: Membuat spec dan implementasi fitur AUTO CHECKING sebelum render
- **Status**: ✅ **IMPLEMENTATION COMPLETED**

---

## Apa yang Dikerjakan

### Session 1: Research & Spec Creation
- Membaca dan memahami struktur project GraphScript
- Memahami renderer modules: `diagram.ts`, `flow.ts`, `diagram-semantic.ts`
- Memahami auto-layout system yang sudah ada di `flow.ts`
- Memahami AST types dan element positioning
- **Created**: `spec/001-auto-checking-validator.md` - Complete specification

### Session 2: Full Implementation
- **Created**: `src/renderer/validator.ts` (687 lines) - Core validation logic
- **Modified**: `src/renderer/index.ts` - Integrated validator into Renderer class
- **Modified**: `src/cli.ts` - Added `--skip-validation` and `--validation-report` options
- **Created**: `tests/renderer/validator.test.ts` - Comprehensive unit tests
- **Created**: `tests/fixtures/*.gs` - 6 test fixture files

---

## User Preferences (Clarified)

| Question | Answer |
|----------|--------|
| Re-layout strategy | Full auto-fix with 5x retry |
| Validation scope | All renderable declarations |
| Default behavior | Always on by default |
| Overlap tolerance | 5 pixels |
| Output format | JSON report |

---

## Implementation Summary

### Files Created

| File | Lines | Description |
|------|-------|-------------|
| `src/renderer/validator.ts` | 687 | Core validation logic with all functions |
| `tests/renderer/validator.test.ts` | 400+ | Comprehensive unit tests |
| `tests/fixtures/no-overlap.gs` | 23 | Clean diagram test case |
| `tests/fixtures/obvious-overlap.gs` | 21 | Overlapping boxes test case |
| `tests/fixtures/parent-child.gs` | 26 | Nested elements test case |
| `tests/fixtures/transparent-overlap.gs` | 21 | Semi-transparent test case |
| `tests/fixtures/allow-overlap.gs` | 22 | Explicit flag test case |
| `tests/fixtures/line-crossing.gs` | 26 | Arrow crossing boxes test case |

### Files Modified

| File | Changes |
|------|---------|
| `src/renderer/index.ts` | Added validator integration, validation runs before render |
| `src/cli.ts` | Added `--skip-validation` and `--validation-report` flags, enhanced `check` command |

---

## Key Implementation Details

### 1. Core Functions in `validator.ts`

```typescript
// Constants
export const OVERLAP_TOLERANCE = 5;     // pixels
export const MAX_RETRIES = 5;
export const MIN_FONT_SIZE = 10;
export const MIN_ELEMENT_SIZE = 20;

// Main exports
export function validateAndAdjust(decl, values, traces, maxRetries)
export function writeValidationReport(report, filePath, declarationName)
export function isValidatableDeclaration(declType)
export function needsRelayout(declType)

// Helper functions
function extractBoundingBoxes(elements, values, traces, offsetX, offsetY, parentId)
function isIntendedOverlap(element, values, traces, hasParent)
function detectOverlaps(boxes, tolerance)
function calculateOverlap(a, b)
function calculateReadability(elements, values, traces)
function calculateReadabilityScore(metrics)
function attemptRelayout(decl, values, traces, attempt)
function generateReport(attempts, issues, metrics, success, declName, declType)
```

### 2. Intended Overlap Detection

Elements are considered **intentionally overlapping** if:
1. **Parent-child relationship** - Children inside parent panels
2. **Transparency** - `fillOpacity < 1` or `strokeOpacity < 1`
3. **Explicit flag** - `allow_overlap: true` property
4. **Element type** - `line`, `arrow`, `connector`, `embed` types

### 3. Re-layout Strategies (5 attempts)

| Attempt | Strategy | Factor | Description |
|---------|----------|--------|-------------|
| 1 | spacing | 1.1 | +10% spacing from center |
| 2 | spacing | 1.2 | +20% spacing |
| 3 | scaling | 0.95 | -5% element size |
| 4 | spacing | 1.3 | +30% spacing |
| 5 | scaling | 0.9 | -10% element size |

### 4. Validation Scope

| Declaration Type | Validates | Re-layouts |
|-----------------|-----------|------------|
| DiagramDeclaration | ✅ | ✅ |
| FlowDeclaration | ✅ | ✅ (adjusts target dimensions) |
| ErdDeclaration | ✅ | ✅ |
| InfraDeclaration | ✅ | ✅ |
| PageDeclaration | ✅ | ✅ |
| ChartDeclaration | ✅ | ❌ (metrics only) |
| TableDeclaration | ✅ | ❌ (metrics only) |
| Plot3dDeclaration | ✅ | ❌ (metrics only) |
| Scene3dDeclaration | ✅ | ❌ (metrics only) |

### 5. Readability Score Calculation

```typescript
function calculateReadabilityScore(metrics): number {
  let score = 100;
  
  // Penalize small fonts (< 10px)
  if (metrics.minFontSize < MIN_FONT_SIZE) {
    score -= (MIN_FONT_SIZE - metrics.minFontSize) * 5;
  }
  
  // Penalize small elements (< 20px)
  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    score -= (MIN_ELEMENT_SIZE - metrics.minElementSize) * 2;
  }
  
  // Penalize high element count (> 50)
  if (metrics.elementCount > 50) {
    score -= Math.min(10, (metrics.elementCount - 50) * 0.2);
  }
  
  return Math.max(0, Math.min(100, score));
}
```

---

## CLI Commands

```bash
# Check readability and validation
graphscript check demo.gs

# Check with detailed JSON report
graphscript check demo.gs --validation-report -o ./reports

# Render with auto-validation (default)
graphscript render demo.gs

# Render with detailed validation report
graphscript render demo.gs --validation-report

# Skip validation for quick iterations
graphscript render demo.gs --skip-validation
```

---

## JSON Report Format

```json
{
  "timestamp": "2026-03-25T10:30:00.000Z",
  "file": "",
  "declaration": "my_diagram",
  "declarationType": "DiagramDeclaration",
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
    "minElementSize": 80,
    "density": 25000,
    "elementCount": 12
  },
  "suggestions": []
}
```

---

## Unit Tests Coverage

### `tests/renderer/validator.test.ts`

| Test Suite | Tests |
|------------|-------|
| `isValidatableDeclaration` | 10 tests - all declaration types |
| `needsRelayout` | 7 tests - which types need re-layout |
| `extractBoundingBoxes` | 4 tests - extraction from elements |
| `detectOverlaps` | 5 tests - overlap detection algorithm |
| `calculateOverlap` | 2 tests - area and percentage |
| `calculateReadability` | 5 tests - metrics calculation |
| `calculateReadabilityScore` | 5 tests - score algorithm |
| `isIntendedOverlap` | 4 tests - intended overlap detection |
| `validateAndAdjust` | 5 tests - main validation flow |

**Total: 47 unit tests**

---

## Manual Testing Results

### Test Files in `tests/fixtures/`

| File | Expected Result | Status |
|------|-----------------|--------|
| `no-overlap.gs` | ✅ Pass - no issues | ✅ |
| `obvious-overlap.gs` | ⚠️ Detect overlap, attempt re-layout | ✅ |
| `parent-child.gs` | ✅ Pass - children inside parent = intended | ✅ |
| `transparent-overlap.gs` | ✅ Pass - fillOpacity < 1 = intended | ✅ |
| `allow-overlap.gs` | ✅ Pass - explicit flag | ✅ |
| `line-crossing.gs` | ✅ Pass - arrow can cross boxes | ✅ |

---

## Performance Considerations

- **O(n²)** overlap detection - acceptable for < 200 elements
- **Max 5 re-layout attempts** - prevents infinite loops
- **Skip validation flag** - for quick iterations during development
- **Metrics-only for some types** - Charts, Tables don't need overlap checks

---

## Known Limitations

1. **Flow Declaration re-layout** - Only adjusts `target_width`/`target_height`, not individual node positions
2. **Complex connectors** - May have edge cases with curved paths
3. **Very large diagrams** (> 200 elements) - May be slow, consider spatial indexing in future
4. **Text overflow** - Doesn't check if text fits inside its container

---

## Future Enhancements

1. **Spatial indexing** (R-tree) for large diagrams (> 200 elements)
2. **Text fit detection** - Check if text overflows its container
3. **Visual debugging mode** - Annotate overlap areas in SVG
4. **Machine learning** - Predict optimal layout based on diagram patterns
5. **Configurable rules** - User-defined overlap tolerance and rules

---

## How to Continue

1. **Run tests**: `npm test`
2. **Build**: `npm run build`
3. **Test CLI**: `node dist/cli.js check examples/hello-chart.gs`
4. **Test validation**: `node dist/cli.js render examples/hello-chart.gs --validation-report`
5. **Check output**: Look for `*-validation.json` files in output directory

---

## Session Summary

✅ **All phases completed:**
- [x] Phase 1: Core Validator (validator.ts with types and interfaces)
- [x] Phase 2: Readability & Re-layout (all functions implemented)
- [x] Phase 3: Integration (Renderer and CLI updated)
- [x] Phase 4: Testing (unit tests and fixtures created)

**Implementation time**: ~4 hours (as estimated)

**Files changed**: 8 files (2 modified, 6 created)

**Lines of code**: ~1,500 new lines

---

## Files Reference

```
graph-script/
├── src/
│   ├── cli.ts                    # MODIFIED - added validation options
│   └── renderer/
│       ├── index.ts              # MODIFIED - integrated validator
│       └── validator.ts          # NEW - 687 lines of validation logic
├── tests/
│   ├── fixtures/
│   │   ├── no-overlap.gs         # NEW - test case
│   │   ├── obvious-overlap.gs    # NEW - test case
│   │   ├── parent-child.gs       # NEW - test case
│   │   ├── transparent-overlap.gs # NEW - test case
│   │   ├── allow-overlap.gs      # NEW - test case
│   │   └── line-crossing.gs      # NEW - test case
│   └── renderer/
│       └── validator.test.ts     # NEW - 47 unit tests
└── spec/
    ├── 001-auto-checking-validator.md      # Spec document
    └── handoff/
        └── 001-auto-checking-validator.md  # This file
```

---

**End of Handoff Document**
