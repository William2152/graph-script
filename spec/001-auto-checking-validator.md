# Spec: Auto-Checking Validator untuk GraphScript

## Prompt
User ingin membuat fitur AUTO CHECKING yang memeriksa readability diagram sebelum render, terutama untuk mendeteksi overlapping antar elemen. Jika ada mistake overlapping, sistem akan mencoba re-layout secara otomatis (maksimal 5x iterasi) sampai tidak ada overlap. Jika masih gagal setelah 5x, tampilkan warning dalam format JSON.

## Tujuan
Mencegah output SVG yang memiliki elemen yang saling bertumpuk (overlapping) secara tidak sengaja, sehingga diagram yang dihasilkan selalu readable dan professional.

## Mengapa Tujuan Ini Penting
1. **User Experience**: Diagram yang overlapping sulit dibaca dan mengurangi nilai presentasi
2. **Automation**: User tidak perlu manual mengecek setiap output
3. **Quality Assurance**: Output yang dihasilkan selalu dalam kondisi optimal
4. **Feedback Loop**: Jika tidak bisa di-resolve otomatis, user mendapat informasi detail untuk perbaikan manual

---

## Codebase Context

### Struktur Project
```
src/
├── cli.ts              # Entry point CLI dengan command: check, run, render
├── parser/             # Parser untuk .gs files
├── ast/types.ts        # AST type definitions
├── runtime/            # Evaluator dan execution
└── renderer/
    ├── index.ts        # Main renderer orchestration
    ├── common.ts       # Utility functions
    ├── diagram.ts      # Diagram rendering
    ├── diagram-semantic.ts  # Semantic layout untuk cards/lanes
    ├── flow.ts         # Flow chart rendering dengan auto-layout
    ├── chart.ts        # Chart rendering
    └── ...             # Other renderers
```

### Flow Rendering Saat Ini
- `flow.ts` sudah memiliki auto-layout system dengan 3 mode: `single_row`, `snake`, `vertical`
- Sudah ada topological ordering untuk node placement
- Sudah ada scoring system untuk memilih layout terbaik
- Properties: `target_width`, `target_height`, `min_font_size`, `preferred_font_size`, `fit`, `layout_mode`

### Diagram Rendering Saat Ini
- `diagram.ts` dan `diagram-semantic.ts` menghandle element positioning
- Semantic types: `header`, `separator`, `lane`, `card`, `connector`, `loop_label`
- Cards di-layout berdasarkan `section`, `row`, `col`, `span`
- Connectors routing dengan berbagai mode: `auto`, `hv`, `vh`, `vhv`, `hvh`

---

## Perubahan yang Akan Diimplementasikan

### 1. Tambah Module Baru: `src/renderer/validator.ts`

```typescript
interface BoundingBox {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowOverlap: boolean;
}

interface OverlapIssue {
  element1: { id: string; type: string };
  element2: { id: string; type: string };
  overlapArea: number;
  overlapPercentage: number;
  severity: 'error' | 'warning' | 'info';
  location: { x: number; y: number; width: number; height: number };
}

interface ValidationResult {
  valid: boolean;
  issues: OverlapIssue[];
  readabilityScore: number;
}

interface ReadabilityMetrics {
  minFontSize: number;
  avgFontSize: number;
  minElementSize: number;
  density: number;
}

const OVERLAP_TOLERANCE = 5; // pixels
const MAX_RETRIES = 5;
const MIN_FONT_SIZE = 10;
const MIN_ELEMENT_SIZE = 20;
```

### 2. Intended vs Mistake Overlap Detection Logic

**Kombinasi indikator untuk menentukan intended overlap:**

```typescript
function isIntendedOverlap(element1: DiagramElement, element2: DiagramElement, values, traces): boolean {
  // 1. Parent-child relationship
  if (isParentChild(element1, element2)) return true;
  
  // 2. fillOpacity < 1 (transparansi menandakan intended layering)
  const opacity1 = getNumber(element1, values, traces, 'fillOpacity', 1);
  const opacity2 = getNumber(element2, values, traces, 'fillOpacity', 1);
  if (opacity1 < 1 || opacity2 < 1) return true;
  
  // 3. Explicit allow_overlap property
  if (getBoolean(element1, values, traces, 'allow_overlap', false)) return true;
  if (getBoolean(element2, values, traces, 'allow_overlap', false)) return true;
  
  // 4. Element type based rules
  // Line/arrow boleh overlap dengan apapun
  if (['line', 'arrow', 'connector'].includes(element1.type) || 
      ['line', 'arrow', 'connector'].includes(element2.type)) return true;
  
  // 5. connector elements are meant to cross other elements
  if (element1.type === 'connector' || element2.type === 'connector') return true;
  
  return false;
}
```

### 3. Bounding Box Extraction

```typescript
function extractBoundingBoxes(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  offsetX = 0,
  offsetY = 0
): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  
  for (const element of elements) {
    const x = offsetX + getNumber(element, values, traces, 'x', 0);
    const y = offsetY + getNumber(element, values, traces, 'y', 0);
    const w = getNumber(element, values, traces, 'w', 200);
    const h = getNumber(element, values, traces, 'h', 120);
    
    // Skip elements without proper dimensions
    if (w <= 0 || h <= 0) continue;
    
    boxes.push({
      id: element.name,
      type: element.type,
      x,
      y,
      width: w,
      height: h,
      allowOverlap: isIntendedOverlap(element, null, values, traces),
    });
    
    // Recursive untuk children
    if (element.children?.length) {
      boxes.push(...extractBoundingBoxes(element.children, values, traces, x, y));
    }
  }
  
  return boxes;
}
```

### 4. Overlap Detection Algorithm

```typescript
function detectOverlaps(boxes: BoundingBox[], tolerance = OVERLAP_TOLERANCE): OverlapIssue[] {
  const issues: OverlapIssue[] = [];
  
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      
      // Skip jika salah satu intended untuk overlap
      if (a.allowOverlap || b.allowOverlap) continue;
      
      const overlap = calculateOverlap(a, b);
      
      if (overlap.area > tolerance * tolerance) {
        issues.push({
          element1: { id: a.id, type: a.type },
          element2: { id: b.id, type: b.type },
          overlapArea: overlap.area,
          overlapPercentage: overlap.percentage,
          severity: overlap.percentage > 30 ? 'error' : overlap.percentage > 10 ? 'warning' : 'info',
          location: overlap.bounds,
        });
      }
    }
  }
  
  return issues;
}

function calculateOverlap(a: BoundingBox, b: BoundingBox): { area: number; percentage: number; bounds: BoundingBox } {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const area = xOverlap * yOverlap;
  
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  const percentage = smallerArea > 0 ? (area / smallerArea) * 100 : 0;
  
  return {
    area,
    percentage,
    bounds: {
      id: 'overlap',
      type: 'overlap-region',
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      width: xOverlap,
      height: yOverlap,
      allowOverlap: false,
    },
  };
}
```

### 5. Readability Metrics

```typescript
function calculateReadability(
  elements: DiagramElement[],
  values: Record<string, GSValue>,
  traces: Map<string, Trace>
): ReadabilityMetrics {
  let minFontSize = Infinity;
  let totalFontSize = 0;
  let fontSizeCount = 0;
  let minElementSize = Infinity;
  let totalArea = 0;
  
  for (const element of elements) {
    // Font size analysis
    const fontSize = getNumber(element, values, traces, 'size', 16);
    if (element.type === 'text' || element.type === 'formula') {
      minFontSize = Math.min(minFontSize, fontSize);
      totalFontSize += fontSize;
      fontSizeCount++;
    }
    
    // Element size analysis
    const w = getNumber(element, values, traces, 'w', 0);
    const h = getNumber(element, values, traces, 'h', 0);
    const area = w * h;
    if (area > 0) {
      minElementSize = Math.min(minElementSize, Math.min(w, h));
      totalArea += area;
    }
    
    // Recursive untuk children
    if (element.children?.length) {
      const childMetrics = calculateReadability(element.children, values, traces);
      minFontSize = Math.min(minFontSize, childMetrics.minFontSize);
      minElementSize = Math.min(minElementSize, childMetrics.minElementSize);
    }
  }
  
  return {
    minFontSize: minFontSize === Infinity ? MIN_FONT_SIZE : minFontSize,
    avgFontSize: fontSizeCount > 0 ? totalFontSize / fontSizeCount : 16,
    minElementSize: minElementSize === Infinity ? MIN_ELEMENT_SIZE : minElementSize,
    density: totalArea, // bisa di-normalize dengan canvas area
  };
}
```

### 6. Dynamic Re-layout Algorithm

```typescript
interface RelayoutStrategy {
  type: 'spacing' | 'scaling' | 'reposition';
  factor: number;
}

function attemptRelayout(
  decl: any,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  issues: OverlapIssue[],
  attempt: number
): { success: boolean; adjustedDecl: any; strategy: RelayoutStrategy } {
  
  const strategy = determineStrategy(issues, attempt);
  
  switch (strategy.type) {
    case 'spacing':
      // Increase gaps between elements
      return applySpacingAdjustment(decl, values, traces, strategy.factor);
    
    case 'scaling':
      // Scale down elements slightly
      return applyScalingAdjustment(decl, values, traces, strategy.factor);
    
    case 'reposition':
      // Try alternative positioning
      return applyRepositionAdjustment(decl, values, traces, issues);
  }
}

function determineStrategy(issues: OverlapIssue[], attempt: number): RelayoutStrategy {
  // Progressive strategy based on attempt number
  const strategies: RelayoutStrategy[] = [
    { type: 'spacing', factor: 1.1 },   // +10% spacing
    { type: 'spacing', factor: 1.2 },   // +20% spacing
    { type: 'scaling', factor: 0.95 },  // -5% scale
    { type: 'spacing', factor: 1.3 },   // +30% spacing
    { type: 'scaling', factor: 0.9 },   // -10% scale
  ];
  
  return strategies[Math.min(attempt, strategies.length - 1)];
}
```

### 7. Main Validation Function

```typescript
export function validateAndAdjust(
  decl: DiagramDeclaration | FlowDeclaration,
  values: Record<string, GSValue>,
  traces: Map<string, Trace>,
  maxRetries = MAX_RETRIES
): { 
  adjustedDecl: any; 
  validation: ValidationResult;
  report: ValidationReport;
} {
  let currentDecl = decl;
  let attempt = 0;
  let lastIssues: OverlapIssue[] = [];
  
  while (attempt < maxRetries) {
    // Extract bounding boxes
    const boxes = extractBoundingBoxes(
      currentDecl.elements || [],
      values,
      traces
    );
    
    // Detect overlaps
    const issues = detectOverlaps(boxes);
    lastIssues = issues;
    
    // Check readability
    const readability = calculateReadability(
      currentDecl.elements || [],
      values,
      traces
    );
    
    // If no issues or only info-level, we're good
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');
    
    if (!hasErrors && !hasWarnings) {
      return {
        adjustedDecl: currentDecl,
        validation: {
          valid: true,
          issues,
          readabilityScore: calculateReadabilityScore(readability),
        },
        report: generateReport(attempt, issues, readability, true),
      };
    }
    
    // Try to fix
    const { success, adjustedDecl } = attemptRelayout(
      currentDecl,
      values,
      traces,
      issues,
      attempt
    );
    
    if (!success) break;
    
    currentDecl = adjustedDecl;
    attempt++;
  }
  
  // Max retries reached, return last state with issues
  const readability = calculateReadability(
    currentDecl.elements || [],
    values,
    traces
  );
  
  return {
    adjustedDecl: currentDecl,
    validation: {
      valid: false,
      issues: lastIssues,
      readabilityScore: calculateReadabilityScore(readability),
    },
    report: generateReport(attempt, lastIssues, readability, false),
  };
}

function calculateReadabilityScore(metrics: ReadabilityMetrics): number {
  let score = 100;
  
  // Penalize small fonts
  if (metrics.minFontSize < MIN_FONT_SIZE) {
    score -= (MIN_FONT_SIZE - metrics.minFontSize) * 5;
  }
  
  // Penalize small elements
  if (metrics.minElementSize < MIN_ELEMENT_SIZE) {
    score -= (MIN_ELEMENT_SIZE - metrics.minElementSize) * 2;
  }
  
  return Math.max(0, score);
}
```

### 8. JSON Report Format

```typescript
interface ValidationReport {
  timestamp: string;
  file: string;
  declaration: string;
  attempts: number;
  success: boolean;
  readabilityScore: number;
  issues: {
    severity: 'error' | 'warning' | 'info';
    element1: string;
    element2: string;
    overlapArea: number;
    overlapPercentage: number;
    location: { x: number; y: number; width: number; height: number };
  }[];
  metrics: {
    minFontSize: number;
    avgFontSize: number;
    minElementSize: number;
  };
  suggestions: string[];
}

function generateReport(
  attempts: number,
  issues: OverlapIssue[],
  readability: ReadabilityMetrics,
  success: boolean
): ValidationReport {
  const suggestions: string[] = [];
  
  if (!success) {
    suggestions.push('Consider increasing canvas dimensions');
    suggestions.push('Reduce number of elements or simplify layout');
    suggestions.push('Use allow_overlap: true for intentional overlapping');
  }
  
  if (readability.minFontSize < MIN_FONT_SIZE) {
    suggestions.push(`Increase minimum font size to at least ${MIN_FONT_SIZE}px`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    file: '', // filled by caller
    declaration: '', // filled by caller
    attempts,
    success,
    readabilityScore: calculateReadabilityScore(readability),
    issues: issues.map(i => ({
      severity: i.severity,
      element1: i.element1.id,
      element2: i.element2.id,
      overlapArea: Math.round(i.overlapArea),
      overlapPercentage: Math.round(i.overlapPercentage * 10) / 10,
      location: {
        x: Math.round(i.location.x),
        y: Math.round(i.location.y),
        width: Math.round(i.location.width),
        height: Math.round(i.location.height),
      },
    })),
    metrics: {
      minFontSize: readability.minFontSize,
      avgFontSize: Math.round(readability.avgFontSize * 10) / 10,
      minElementSize: readability.minElementSize,
    },
    suggestions,
  };
}
```

---

## Perubahan pada File yang Ada

### 1. `src/renderer/index.ts`

Tambahkan validasi sebelum render:

```typescript
import { validateAndAdjust, writeValidationReport } from './validator';

export class Renderer {
  render(values: Record<string, GSValue>, traces: Map<string, Trace>, options: RenderOptions = {}): void {
    // ... existing code ...
    
    for (const [name, value] of Object.entries(values)) {
      if (!value || typeof value !== 'object') continue;
      const decl = value as any;
      
      // VALIDATION STEP - only for DiagramDeclaration and FlowDeclaration
      if (decl.type === 'DiagramDeclaration' || decl.type === 'FlowDeclaration') {
        const { adjustedDecl, validation, report } = validateAndAdjust(decl, values, traces);
        
        if (!validation.valid) {
          const reportPath = path.join(outputDir, `${sanitizeFileName(name)}-validation.json`);
          writeValidationReport(report, reportPath, name);
          console.warn(`Warning: Validation issues found for ${name}. See ${reportPath}`);
        }
        
        // Use adjusted declaration for rendering
        const svg = this.renderDeclaration(name, adjustedDecl, values, traces, baseDir);
        if (!svg) continue;
        this.writeSvg(decl.name || name, svg, outputDir, decl.type.replace('Declaration', '').toLowerCase());
      } else {
        // ... existing code for other types ...
      }
    }
  }
}
```

### 2. `src/cli.ts`

Update CLI untuk support validation output:

```typescript
Commands:
  check <file.gs>     Parse, validate, and check readability
  run <file.gs>       Run algorithms and display traces
  render <file.gs>    Render charts and flows to SVG (with auto-validation)

Options:
  --output <dir>      Output directory (default: ./output)
  --skip-validation   Skip overlap validation during render
  --validation-report Generate detailed validation JSON report
```

---

## Flow Diagram: Auto-Checking Process

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDER COMMAND                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Parse & Execute GraphScript                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Extract Bounding Boxes dari Elements               │
│  - Diagram: semua panel, box, text, circle, dll             │
│  - Flow: semua nodes dengan posisi hasil layout              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Detect Overlaps (tolerance: 5px)             │
│  - Skip jika: parent-child, fillOpacity<1, allow_overlap    │
│  - Skip jika: line/arrow/connector type                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              No Issues            Issues Found
                    │                   │
                    ▼                   ▼
        ┌───────────────┐    ┌─────────────────────┐
        │   RENDER SVG   │    │  Attempt < 5?       │
        └───────────────┘    └─────────────────────┘
                                      │
                              ┌───────┴───────┐
                              │               │
                           Yes              No
                              │               │
                              ▼               ▼
                ┌────────────────────┐  ┌──────────────────┐
                │ Apply Relayout     │  │ Write JSON       │
                │ Strategy (attempt) │  │ Validation Report│
                │ - spacing +10%     │  │ + Render Anyway  │
                │ - spacing +20%     │  └──────────────────┘
                │ - scale -5%        │
                │ - spacing +30%     │
                │ - scale -10%       │
                └────────────────────┘
                              │
                              ▼
                    (loop back to detect)
```

---

## Test Cases

### Test Case 1: No Overlap - Should Pass
```graphscript
diagram test_no_overlap {
  width: 800
  height: 600
  
  box element1 {
    x: 50
    y: 50
    w: 200
    h: 100
    label: "Element 1"
  }
  
  box element2 {
    x: 300
    y: 50
    w: 200
    h: 100
    label: "Element 2"
  }
}
```
**Expected**: `valid: true`, no issues

### Test Case 2: Obvious Overlap - Should Detect and Fix
```graphscript
diagram test_overlap {
  width: 800
  height: 600
  
  box element1 {
    x: 50
    y: 50
    w: 200
    h: 100
    label: "Element 1"
  }
  
  box element2 {
    x: 100
    y: 80
    w: 200
    h: 100
    label: "Element 2"
  }
}
```
**Expected**: 
- Attempt 1: Detect overlap
- Apply spacing +10%
- Attempt 2: Re-check
- If still overlap, continue up to 5 attempts
- Output: JSON report with resolution status

### Test Case 3: Intended Overlap (Parent-Child) - Should Pass
```graphscript
diagram test_intended {
  width: 800
  height: 600
  
  panel container {
    x: 50
    y: 50
    w: 400
    h: 300
    label: "Container"
    
    box child1 {
      x: 20
      y: 40
      w: 150
      h: 80
      label: "Child 1"
    }
    
    box child2 {
      x: 200
      y: 40
      w: 150
      h: 80
      label: "Child 2"
    }
  }
}
```
**Expected**: `valid: true`, children inside parent = intended overlap

### Test Case 4: Transparent Overlap - Should Pass
```graphscript
diagram test_transparent {
  width: 800
  height: 600
  
  box background {
    x: 50
    y: 50
    w: 400
    h: 300
    fillOpacity: 0.3
    label: "Background"
  }
  
  box foreground {
    x: 100
    y: 100
    w: 200
    h: 150
    label: "Foreground"
  }
}
```
**Expected**: `valid: true`, fillOpacity < 1 = intended overlap

### Test Case 5: Explicit Allow Overlap - Should Pass
```graphscript
diagram test_allow {
  width: 800
  height: 600
  
  box element1 {
    x: 50
    y: 50
    w: 200
    h: 100
    label: "Element 1"
  }
  
  badge element2 {
    x: 200
    y: 120
    w: 80
    h: 40
    label: "Badge"
    allow_overlap: true
  }
}
```
**Expected**: `valid: true`, explicit allow_overlap property

### Test Case 6: Line Crossing - Should Pass
```graphscript
diagram test_line {
  width: 800
  height: 600
  
  box element1 {
    x: 50
    y: 50
    w: 200
    h: 100
    label: "Element 1"
  }
  
  box element2 {
    x: 300
    y: 200
    w: 200
    h: 100
    label: "Element 2"
  }
  
  arrow connector {
    x: 150
    y: 150
    x2: 400
    y2: 200
    stroke: "#64748b"
  }
}
```
**Expected**: `valid: true`, lines/arrows can overlap with boxes

---

## Manual Testing Plan

1. **Basic Validation Test**
   - Run: `graphscript render test.gs --validation-report`
   - Check: `output/test-validation.json` exists and contains proper structure
   - Verify: Issues are detected and reported correctly

2. **Auto-Fix Test**
   - Create file with obvious overlaps
   - Run: `graphscript render test.gs`
   - Check: SVG output shows elements are now properly spaced
   - Verify: No overlap visible in SVG

3. **Max Retry Test**
   - Create file with impossible layout (too many elements for canvas)
   - Run: `graphscript render test.gs`
   - Check: JSON report shows 5 attempts
   - Verify: Suggestions are provided for manual fix

4. **Readability Test**
   - Create file with very small font (< 10px)
   - Run: `graphscript check test.gs`
   - Check: Validation warns about readability issues

5. **Performance Test**
   - Create file with 50+ elements
   - Run: `graphscript render test.gs`
   - Measure: Time to complete validation
   - Expected: < 5 seconds for 100 elements

---

## Implementation Checklist

- [ ] Create `src/renderer/validator.ts` with core validation logic
- [ ] Implement `BoundingBox` extraction
- [ ] Implement overlap detection algorithm
- [ ] Implement intended overlap detection
- [ ] Implement readability metrics calculation
- [ ] Implement re-layout strategies
- [ ] Update `src/renderer/index.ts` to call validator
- [ ] Update `src/cli.ts` for new options
- [ ] Add `--skip-validation` flag
- [ ] Add `--validation-report` flag
- [ ] Write unit tests for validator
- [ ] Write integration tests for full flow
- [ ] Update documentation

---

## Notes

1. **Flow vs Diagram**: Flow sudah memiliki auto-layout yang bagus, jadi validator untuk Flow lebih ke double-check hasil layout. Diagram perlu lebih aggressive re-layout.

2. **Performance**: O(n^2) untuk overlap detection. Untuk 100 elements = 4950 comparisons. Masih acceptable.

3. **Future Enhancement**: 
   - Visual debugging mode (annotate overlap areas in SVG)
   - Machine learning untuk predict optimal layout
   - User-defined overlap rules via config file
