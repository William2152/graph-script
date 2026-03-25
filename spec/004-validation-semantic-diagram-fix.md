# Spec: Validation Fix for Semantic Diagram Layout

## Prompt

User menjalankan `node dist/cli.js render temp/fig-4-16-vqe-measurement.gs` dan mendapatkan validation warnings/errors yang tidak pernah resolve. Diagram ini adalah acceptance criteria dari spec 002 (renderer composite image latex svg).

## Tujuan

Fix layout algorithm di `diagram-semantic.ts` agar:
1. Formula elements constrained to card inner width
2. Connector labels automatically repositioned to avoid overlapping with cards
3. Connector routing avoids reusing the same path (staggered corridors)
4. Validation passes with 100/100 score

## Mengapa Tujuan Ini Penting

1. **Acceptance Criteria**: Spec 002 states this diagram should render without issues
2. **Usability**: Users should be able to render complex diagrams without manual tweaking
3. **Quality**: The diagram should be readable without overlaps
4. **Readability**: Multiple connectors should be visually distinguishable

---

## Changes Made

### 1. `src/renderer/diagram.ts`

#### Image Border Fix (line ~270)
Added `stroke-linecap="round" stroke-linejoin="round"` to image border rect for better rendering.

### 2. `src/renderer/diagram-semantic.ts`

#### a. New Interfaces Added
- `ConnectorPath` - Extended with `labelSegmentStart` and `labelSegmentEnd`
- `BoxArea` - For bounding box calculations
- `ConnectorSegmentObstacle` - For tracking placed connector segments
- `ConnectorRoutingContext` - For sharing routing state between connectors

#### b. Formula Width Constraint (line ~669-691)
```typescript
// Before:
const width = Math.max(metrics.width, 48);

// After:
const constrainedWidth = Math.min(Math.max(metrics.width, 48), maxWidth);
```

#### c. Connector Routing with Context
- Added `ConnectorRoutingContext` to track placed segments and labels
- Added `estimateConnectorPriority()` to sort connectors by complexity
- Connectors now processed in priority order (longer spans first)

#### d. Smart Label Placement (line ~884+)
- Multiple candidate positions evaluated
- Scoring system considers:
  - Distance from preferred position
  - Collision with cards (+100000 penalty)
  - Collision with other labels (+80000 penalty)
  - Collision with connector segments (+25000 penalty)
- White background box added for readability

#### e. Staggered Connector Corridors
- Multiple candidate paths generated for each route type
- Corridor candidates avoid blocked areas
- `spreadConnectorPath()` spreads parallel connectors apart
- Enhanced scoring considers:
  - Connector-to-connector intersections
  - Clearance from cards
  - Label-to-connector collisions

#### f. New Helper Functions
- `placeConnectorLabel()` - Smart label positioning
- `chooseMidXCandidates()` / `chooseMidYCandidates()` - Multiple corridor options
- `corridorCandidates()` - Generate and rank candidate positions
- `spreadConnectorPath()` - Separate parallel segments
- `segmentHitsBox()` / `expandBox()` - Collision detection
- `scoreSegmentInteraction()` - Evaluate connector interactions

---

## Validation Results

### Before Fix
```
Readability Score: 0/100
Errors: 7, Warnings: 3
- eq ↔ ansatzCard: 21.7% overlap
- eq ↔ ansatzImg: 40% overlap
- ansatzCard ↔ measToEnergy-label: 75.1% overlap
- etc.
```

### After Fix
```
Readability Score: 100/100
✓ No overlap issues
✓ Validation: OK
```

---

## Manual Testing

```bash
# Test render
node dist/cli.js render temp/fig-4-16-vqe-measurement.gs

# Test check
node dist/cli.js check temp/fig-4-16-vqe-measurement.gs

# Result
Readability Score: 100/100
✓ No overlap issues
```

---

## Acceptance Criteria Met

- [x] `temp/fig-4-16-vqe-measurement.gs` renders without errors
- [x] Validation passes with 100/100 score
- [x] No overlaps between elements
- [x] Formulas constrained within card bounds
- [x] Connector labels don't overlap with cards
- [x] Connectors use staggered corridors when multiple connectors exist
