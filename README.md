# GraphScript

<div align="center">

**Composable Visual Scripting for Charts, Diagrams, Algorithms, and 3D**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

*A unified DSL for computation, explanation, and rendering*

[Getting Started](#getting-started) • [Examples](#examples) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Language Basics](#language-basics)
- [Core Concepts](#core-concepts)
- [Declarations](#declarations)
- [CLI Usage](#cli-usage)
- [Examples](#examples)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Validation & Auto-Checking](#validation--auto-checking)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

GraphScript is a **composable visual scripting language** that enables you to create:

- 📊 **2D Charts & Scientific Plots** - Line, scatter, bar, area, histogram, pie, heatmap, contour, spectrum
- 🔄 **Flowcharts & Process Diagrams** - Start, end, process, decision, data nodes with auto-layout
- 📝 **Pseudocode & Executable Algorithms** - Write once, execute and visualize
- 🎨 **Infographic-Style Diagrams** - Panels, boxes, circles, grids, badges, callouts
- 📋 **Tables & State Snapshots** - Tabular data visualization
- 🌐 **3D Plots & Scenes** - Surface, wireframe, scatter3D, Bloch spheres
- 🗄️ **Database Diagrams (ERD)** - Tables, fields, relationships
- ☁️ **Infrastructure Diagrams** - AWS, GCP, Azure, Kubernetes architectures
- 🧩 **Reusable Visual Modules** - Compose and embed visuals inside each other

### The Core Idea

> **Write one script, generate many views, and reuse one view inside another.**

```graphscript
# An algorithm can emit trace data
algo BinarySearch(arr, target):
  # ... algorithm logic ...
  emit: step = step, mid = mid

# A chart can render that trace
chart "Search Trace":
  type = line
  x = step
  y = mid

# A flow can embed the chart
flow "Explanation":
  node process label="Run Search"
  embed process.right = "Search Trace"
```

---

## Features

### 🎯 Primary Goals

| Feature | Description |
|---------|-------------|
| **Easy to Write** | Simple indentation-based syntax, readable like Python/YAML |
| **Composable** | Every renderable object can become a reusable component |
| **Multi-Domain** | Charts, flowcharts, ERD, infra, 3D, algorithm traces, tables |
| **Scriptable** | Variables, functions, loops, expressions, imports |
| **Deterministic** | Same input produces the same output |
| **Extensible** | Domain modules can be added without breaking core syntax |
| **Explainable** | Ideal for teaching, documentation, reports, architecture |

### 🚀 Unique Capabilities

- **Algorithm Tracing**: Execute algorithms and automatically capture step-by-step traces
- **Auto-Layout**: Intelligent layout engine for flowcharts and diagrams
- **Semantic Composition**: Embed charts inside flowcharts, algorithms inside explanations
- **Multi-Format Export**: SVG, PNG, PDF, HTML, JSON
- **Auto-Validation**: Detect overlapping elements and readability issues before render

---

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### From Source

```bash
# Clone the repository
git clone https://github.com/mcpe500/graph-script.git
cd graph-script

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Verify Installation

```bash
graphscript --help
```

---

## Getting Started

### Your First Chart

Create a file named `hello.gs`:

```graphscript
use chart

data:
  xs = range(0, 10, 1)
  ys = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]

chart "Squares":
  type = line
  x = xs
  y = ys
  xlabel = "x"
  ylabel = "x²"
```

Render it:

```bash
graphscript render hello.gs
```

Output: `output/Squares.svg`

### Your First Flowchart

Create `flow.gs`:

```graphscript
use flow

flow "Decision Process":
  node start type=start label="Begin"
  node check type=decision label="Is Valid?"
  node process type=process label="Process Data"
  node end type=end label="Complete"

  start -> check
  check -> process label="yes"
  check -> end label="no"
  process -> end
```

### Your First Algorithm with Trace

Create `search.gs`:

```graphscript
use chart

algo BinarySearch(arr, target):
  low = 0
  high = len(arr) - 1

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

  return -1

data:
  sorted = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  result = BinarySearch(sorted, 11)

chart "Search Trace":
  type = line
  x = step
  y = mid
  xlabel = "iteration"
  ylabel = "mid index"
```

Run and visualize:

```bash
graphscript run search.gs    # See trace output
graphscript render search.gs # Generate chart
```

---

## Language Basics

### Syntax Rules

| Rule | Description |
|------|-------------|
| **Indentation** | Use 2 spaces (tabs not allowed) |
| **Blocks** | End header with `:` and indent content |
| **Comments** | Start with `#` |
| **Strings** | Single or double quotes |

### Data Types

```graphscript
# Primitives
const name = "GraphScript"
const version = 0.1
const active = true
const empty = null

# Collections
numbers = [1, 2, 3, 4, 5]
config = { key: "value", count: 10 }
```

### Operators

```graphscript
# Arithmetic
a = 10 + 5   # Addition
b = 10 - 5   # Subtraction
c = 10 * 5   # Multiplication
d = 10 / 5   # Division
e = 10 % 3   # Modulo
f = 2 ^ 8    # Power

# Comparison
x = a == b   # Equal
y = a != b   # Not equal
z = a < b    # Less than

# Boolean
result = true and false
result = true or false
result = not true
```

### Control Flow

```graphscript
# If-Else
if condition:
  # ...
else if other:
  # ...
else:
  # ...

# While Loop
while condition:
  # ...

# For Loop
for item in collection:
  # ...
```

---

## Core Concepts

### Three Layers

```
┌─────────────────────────────────────────────────────────┐
│                  COMPOSITION SYSTEM                      │
│     sub / component / embed / export / slot             │
├─────────────────────────────────────────────────────────┤
│                   DOMAIN MODULES                         │
│  chart / flow / diagram / table / plot3d / scene3d /    │
│  erd / infra / pseudo / algo                            │
├─────────────────────────────────────────────────────────┤
│                    CORE LANGUAGE                         │
│   variables / expressions / functions / imports /       │
│   themes / styles / layout primitives                   │
└─────────────────────────────────────────────────────────┘
```

### Render Pipeline

```
Source (.gs) → Parser → AST → Evaluator → IR → Layout → Renderer → Output (SVG/PNG/HTML)
```

---

## Declarations

### Top-Level Blocks

| Block | Purpose |
|-------|---------|
| `use` | Enable language modules |
| `import` | Import symbols or files |
| `const` | Define immutable constants |
| `data` | Define datasets and derived values |
| `func` | Define pure functions |
| `theme` | Define design tokens |
| `style` | Define visual rules |
| `sub` | Define reusable modules |
| `algo` | Define executable algorithms |
| `pseudo` | Define pseudocode blocks |
| `chart` | Define 2D charts |
| `flow` | Define flowcharts |
| `diagram` | Define infographics |
| `table` | Define tables |
| `plot3d` | Define 3D plots |
| `scene3d` | Define 3D scenes |
| `erd` | Define database diagrams |
| `infra` | Define infrastructure diagrams |
| `page` | Define multi-view layouts |
| `render` | Define output targets |

### Chart Types

| Type | Description |
|------|-------------|
| `line` | Line chart |
| `scatter` | Scatter plot |
| `bar` | Bar chart |
| `area` | Area chart |
| `histogram` | Histogram |
| `pie` | Pie chart |
| `heatmap` | Heatmap |
| `contour` | Contour plot |
| `spectrum` | Frequency spectrum |

### Flow Node Types

| Type | Shape | Usage |
|------|-------|-------|
| `start` | Rounded rectangle | Process start |
| `end` | Rounded rectangle | Process end |
| `process` | Rectangle | Action/operation |
| `decision` | Diamond | Conditional branch |
| `data` | Parallelogram | Input/output data |
| `subprocess` | Double rectangle | Nested process |

### Diagram Primitives

| Primitive | Description |
|-----------|-------------|
| `panel` | Container with title |
| `box` | Simple rectangle |
| `circle` | Circle shape |
| `ellipse` | Ellipse shape |
| `line` | Line connector |
| `arrow` | Arrow connector |
| `grid` | Grid pattern |
| `checker` | Checkerboard pattern |
| `text` | Text label |
| `formula` | Mathematical formula |
| `image` | Embedded image |
| `badge` | Small label/badge |
| `callout` | Annotation callout |

---

## CLI Usage

### Commands

```bash
# Parse and validate a file
graphscript check <file.gs>

# Run algorithms and display traces
graphscript run <file.gs>

# Render charts and flows to SVG
graphscript render <file.gs> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-o, --output <dir>` | Output directory (default: `./output`) |
| `--skip-validation` | Skip overlap validation during render |
| `--validation-report` | Generate detailed validation JSON report |

### Examples

```bash
# Basic validation
graphscript check examples/binary-search.gs

# Run algorithm and see traces
graphscript run examples/binary-search.gs

# Render to default output folder
graphscript render examples/hello-chart.gs

# Render to custom folder
graphscript render examples/hello-chart.gs -o ./dist

# Generate with validation report
graphscript render examples/hello-chart.gs --validation-report

# Quick render without validation
graphscript render examples/hello-chart.gs --skip-validation
```

---

## Examples

### Binary Search Visualization

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

chart "Search Convergence":
  type = line
  x = step
  y = mid
  xlabel = "Iteration"
  ylabel = "Mid Index"
```

### Multi-Series Chart

```graphscript
use chart

data:
  xs = range(-5, 5, 0.1)
  sigmoid_ys = 1 / (1 + exp(-xs))
  tanh_ys = (exp(xs) - exp(-xs)) / (exp(xs) + exp(-xs))

chart "Activation Functions":
  type = line
  series:
    - label = "sigmoid"
      x = xs
      y = sigmoid_ys
    - label = "tanh"
      x = xs
      y = tanh_ys
  xlabel = "x"
  ylabel = "f(x)"
  grid = true
```

### Infographic Diagram

```graphscript
diagram "Quantum Oracle":
  width = 800
  height = 600
  title = "Deutsch-Jozsa Oracle"
  
  panel constant:
    x = 50
    y = 100
    w = 300
    h = 200
    label = "Constant Oracle"
    fill = "#dbeafe"
    
  panel balanced:
    x = 450
    y = 100
    w = 300
    h = 200
    label = "Balanced Oracle"
    fill = "#fef3c7"
    
  arrow connection:
    x = 350
    y = 200
    x2 = 450
    y2 = 200
    label = "f(x)"
```

### 3D Surface Plot

```graphscript
plot3d "Wave Surface":
  type = surface
  x = range(-5, 5, 0.2)
  y = range(-5, 5, 0.2)
  z = sin(sqrt(x^2 + y^2))
  axes = true
  colormap = "viridis"
```

### Infrastructure Diagram

```graphscript
infra aws "Web Platform":
  region = "ap-southeast-1"
  
  vpc main:
    cidr = "10.0.0.0/16"
  
  subnet public in main:
    type = public
  
  alb edge in public
  ecs api in public
  rds postgres in main
  
  edge -> api
  api -> postgres
```

More examples in the [`examples/`](examples/) directory.

---

## Architecture

### Project Structure

```
graph-script/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── ast/
│   │   └── types.ts           # AST type definitions
│   ├── parser/
│   │   ├── index.ts           # Parser main
│   │   ├── declarations.ts    # Declaration parsing
│   │   ├── expressions.ts     # Expression parsing
│   │   └── statements.ts      # Statement parsing
│   ├── runtime/
│   │   ├── index.ts           # Evaluator
│   │   ├── scope.ts           # Variable scope
│   │   ├── values.ts          # Runtime values
│   │   └── builtins.ts        # Built-in functions
│   ├── renderer/
│   │   ├── index.ts           # Main renderer
│   │   ├── common.ts          # Shared utilities
│   │   ├── chart.ts           # Chart renderer
│   │   ├── flow.ts            # Flowchart renderer
│   │   ├── diagram.ts         # Diagram renderer
│   │   ├── diagram-semantic.ts # Semantic layout
│   │   ├── table.ts           # Table renderer
│   │   ├── plot3d.ts          # 3D plot renderer
│   │   ├── scene3d.ts         # 3D scene renderer
│   │   ├── erd.ts             # ERD renderer
│   │   ├── infra.ts           # Infra renderer
│   │   ├── page.ts            # Page renderer
│   │   ├── pseudo.ts          # Pseudocode renderer
│   │   └── validator.ts       # Auto-checking validator (planned)
│   └── tokenizer/
│       ├── index.ts           # Tokenizer
│       └── types.ts           # Token types
├── examples/                  # Example .gs files
├── spec/                      # Specifications
│   ├── INSTRUCTIONS.md        # Spec instructions
│   └── handoff/               # Session handoffs
├── tests/                     # Test files
├── SPEC.md                    # Language specification
├── package.json
├── tsconfig.json
└── README.md
```

### Data Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │───▶│   Parser    │───▶│     AST     │
│   (.gs)     │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Output    │◀───│   Renderer  │◀───│  Evaluator  │
│ (SVG/PNG)   │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## API Reference

### Renderer Class

```typescript
import { Renderer } from './renderer';

const renderer = new Renderer({
  outputDir: './output',
  baseDir: process.cwd(),
  format: 'svg'
});

renderer.render(values, traces, options);
```

### Parser Class

```typescript
import { Parser } from './parser';

const parser = new Parser();
const ast = parser.parse(sourceCode);
```

### Evaluator Class

```typescript
import { Evaluator } from './runtime';

const evaluator = new Evaluator();
const values = evaluator.execute(ast);
const traces = evaluator.getTraces();
```

---

## Validation & Auto-Checking

GraphScript includes an **auto-checking validator** that ensures diagram readability before rendering.

### Features

- **Overlap Detection**: Identifies elements that overlap unintentionally
- **Readability Metrics**: Checks font sizes, element sizes, density
- **Auto-Fix**: Attempts to re-layout diagrams automatically (up to 5 iterations)
- **JSON Reports**: Detailed validation reports for debugging

### How It Works

```
┌─────────────────┐
│ Extract Bounding│
│     Boxes       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Detect Overlap │────▶│  Has Issues?    │
│  (5px tolerance)│     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                   Yes                       No
                    │                         │
                    ▼                         ▼
         ┌─────────────────┐        ┌─────────────────┐
         │ Apply Re-layout │        │   Render SVG    │
         │ (max 5 retries) │        │                 │
         └────────┬────────┘        └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Still Failing?  │
         │ Write JSON Report│
         └─────────────────┘
```

### Intended Overlap Detection

The validator recognizes these as **intentional overlaps**:

| Condition | Example |
|-----------|---------|
| Parent-child relationship | Children inside a `panel` |
| Transparency | `fillOpacity < 1` |
| Explicit property | `allow_overlap: true` |
| Element type | `line`, `arrow`, `connector` |

### Validation Report Format

```json
{
  "timestamp": "2026-03-24T12:00:00.000Z",
  "file": "diagram.gs",
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

See [spec/001-auto-checking-validator.md](spec/001-auto-checking-validator.md) for full details.

---

## Development

### Scripts

```bash
# Build TypeScript
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Type checking
npm run check

# Linting
npm run lint

# Development mode
npm run dev -- render examples/hello-chart.gs
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/parser/parser.test.ts

# Watch mode
npm test -- --watch
```

### Adding a New Renderer

1. Create `src/renderer/newtype.ts`
2. Export render function
3. Add case to `src/renderer/index.ts`
4. Add type to `src/ast/types.ts`
5. Update parser in `src/parser/declarations.ts`
6. Add tests in `tests/renderer/`

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use 2-space indentation
- Follow TypeScript best practices
- Add JSDoc comments for public APIs
- Write tests for new features

### Areas for Contribution

- [ ] Additional chart types (box plot, violin, etc.)
- [ ] More infrastructure providers (GCP, Azure)
- [ ] Interactive HTML renderer
- [ ] VS Code extension
- [ ] Language Server Protocol (LSP)
- [ ] Additional export formats (PDF, GLB)
- [ ] Performance optimizations

---

## Roadmap

### v0.1 (Current)

- [x] Core syntax and parser
- [x] Data and functions
- [x] Chart renderer
- [x] Flow renderer with auto-layout
- [x] Pseudocode blocks
- [x] Algorithm execution with traces
- [x] Table renderer
- [x] Diagram renderer
- [x] Page composition
- [x] SVG export
- [ ] Auto-checking validator (in progress)

### v0.2 (Planned)

- [ ] ERD renderer
- [ ] Infrastructure diagrams (AWS)
- [ ] Improved layout engine
- [ ] Code formatter
- [ ] LSP support

### v0.3 (Future)

- [ ] 3D plot renderer
- [ ] 3D scene renderer
- [ ] GLB/JSON export
- [ ] Animation primitives

### v0.4 (Future)

- [ ] Plugin SDK
- [ ] Interactive HTML renderer
- [ ] Richer domain packs

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Inspired by domain-specific languages for visualization
- Built with TypeScript and Node.js
- Math rendering powered by MathJax

---

<div align="center">

**[GraphScript](https://github.com/mcpe500/graph-script)** - *Composable Visual Scripting for Charts, Diagrams, Algorithms, and 3D*

Made with ❤️ by the GraphScript Team

</div>
