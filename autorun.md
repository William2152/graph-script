# graphscript-autodev

This is an experiment to have the LLM autonomously implement and evolve the GraphScript language.

## Setup

To set up a new development session, work with the user to:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `dev-mar5`). The branch `autodev/<tag>` must not already exist — this is a fresh development sprint.
2. **Create the branch**: `git checkout -b autodev/<tag>` from current master.
3. **Read the in-scope files**: The repo defines the language identity. Read these files for full context:
   - `SPEC.md` — The language specification (syntax, semantics, blocks). This is the contract.
   - `program.md` — The build plan, roadmap, and milestones (MVP -> ERD -> 3D). This is the guide.
   - `packages/` — The implementation source (parser, runtime, IR, renderers).
4. **Verify environment**: Check that `package.json` exists and dependencies are installed. If not, tell the human to run `npm install` or `pnpm install`.
5. **Initialize results.tsv**: Create `results.tsv` with just the header row. The baseline build status will be recorded after the first run.
6. **Confirm and go**: Confirm setup looks good.

Once you get confirmation, kick off the autonomous development.

## Development Loop

Each experiment runs in a local development environment. The development script runs for a **fixed time budget per iteration** (e.g., 10 minutes for build + test + render). You launch it simply as: `npm run build && npm run test`.

**What you CAN do:**
- Modify `packages/` — this is the only code you edit. Everything is fair game: parser logic, IR structure, layout engine, renderer implementations, CLI commands.
- Create new example files in `examples/` to test specific features.
- Update `program.md` progress tracking (but do not change the core goals without justification).

**What you CANNOT do:**
- Modify `SPEC.md` arbitrarily. The syntax and semantics defined there are the ground truth. If you find a spec contradiction, note it in the log, but prioritize compliance unless the spec is clearly broken.
- Install new packages or add dependencies without strong justification. Stick to the stack recommended in `program.md` (TypeScript monorepo).
- Break backward compatibility without a version bump strategy.

**The goal is simple: Maximize Feature Completion & Stability.** Since the roadmap is fixed (`program.md`), you don't need to worry about *what* to build next — follow the phases (MVP -> ERD -> Infra -> 3D). Everything is fair game: refactor the parser, optimize the layout engine, fix rendering bugs. The only constraint is that the code builds, tests pass, and examples render correctly.

**Complexity criterion**: All else being equal, simpler is better. A small feature that adds ugly complexity is not worth it. Conversely, removing code and keeping tests passing is a great outcome. When evaluating whether to keep a change, weigh the complexity cost against the feature value. A feature that adds 100 lines of hacky code for a minor visual tweak? Probably not worth it. A refactor that deletes 50 lines and keeps functionality? Definitely keep.

**The first run**: Your very first run should always be to establish the baseline, so you will run the build/test script as is.

## Output format

Once the script finishes it prints a summary like this:

```
---
build_status:     SUCCESS
test_pass_rate:   98.5%
examples_rendered: 5/5
total_seconds:    450.2
errors:           0
warnings:         3
```

Note that the script should fail fast if compilation errors occur. You can extract the key metric from the log file:

```
grep "^build_status:\|^test_pass_rate:" run.log
```

## Logging results

When an experiment is done, log it to `results.tsv` (tab-separated, NOT comma-separated — commas break in descriptions).

The TSV has a header row and 5 columns:

```
commit	build_status	test_pass_rate	status	description
```

1. git commit hash (short, 7 chars)
2. build_status (SUCCESS/FAIL) — use FAIL for crashes
3. test_pass_rate (e.g. 98.50) — use 0.00 for crashes
4. status: `keep`, `discard`, or `crash`
5. short text description of what this experiment tried (e.g., "implemented flow orthogonal routing")

Example:

```
commit	build_status	test_pass_rate	status	description
a1b2c3d	SUCCESS	95.00	keep	baseline MVP parser
b2c3d4e	SUCCESS	96.50	keep	added chart line renderer
c3d4e5f	FAIL	0.00	discard	broken IR transformation for flow
d4e5f6g	SUCCESS	96.50	keep	refactored layout engine for speed
```

## The experiment loop

The experiment runs on a dedicated branch (e.g. `autodev/mar5` or `autodev/mar5-gpu0`).

LOOP FOREVER:

1. Look at the git state: the current branch/commit we're on.
2. Check `program.md` for the next milestone or pending feature.
3. Tune the implementation (`packages/`) with an experimental idea by directly hacking the code to implement the feature.
4. git commit.
5. Run the experiment: `npm run build && npm run test > run.log 2>&1` (redirect everything — do NOT use tee or let output flood your context).
6. Read out the results: `grep "^build_status:\|^test_pass_rate:" run.log`.
7. If the grep output is empty or build_status is FAIL, the run crashed. Run `tail -n 50 run.log` to read the error log and attempt a fix. If you can't get things to work after more than a few attempts, give up on that specific approach.
8. Record the results in the tsv (NOTE: do not commit the results.tsv file, leave it untracked by git).
9. If build_status is SUCCESS and test_pass_rate improved or stayed stable while adding features, you "advance" the branch, keeping the git commit.
10. If build_status is FAIL or test_pass_rate dropped significantly, you git reset back to where you started.

The idea is that you are a completely autonomous developer trying things out. If they work, keep. If they don't, discard. And you're advancing the branch so that you can iterate. If you feel like you're getting stuck in some way, you can rewind but you should probably do this very very sparingly (if ever).

**Timeout**: Each experiment should take ~10 minutes total (build + test + render examples). If a run exceeds 20 minutes, kill it and treat it as a failure (discard and revert).

**Crashes**: If a run crashes (compile error, runtime exception), use your judgment: If it's something dumb and easy to fix (e.g. a typo, a missing import), fix it and re-run. If the idea itself is fundamentally broken (e.g. architectural mismatch with SPEC.md), just skip it, log "crash" as the status in the tsv, and move on.

**NEVER STOP**: Once the experiment loop has begun (after the initial setup), do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep, or gone from a computer and expects you to continue working *indefinitely* until you are manually stopped. You are autonomous. If you run out of ideas, think harder — read `SPEC.md` for unimplemented blocks, re-read `program.md` for next milestones, try combining previous near-misses, try more radical architectural refactors. The loop runs until the human interrupts you, period.

**Roadmap Progression**:
- Start with **MVP** (Parser, Data, Func, Algo, Chart, Flow, Table, SVG).
- Once MVP is stable (tests passing, examples rendering), move to **ERD & Infra**.
- Once ERD/Infra is stable, move to **3D (plot3d, scene3d)**.
- Finally, work on **Tooling Polish** (LSP, Formatter).

As an example use case, a user might leave you running while they sleep. If each experiment takes you ~10 minutes then you can run approx 6/hour, for a total of about 50 over the duration of the average human sleep. The user then wakes up to a more complete implementation of GraphScript, all completed by you while they slept!
