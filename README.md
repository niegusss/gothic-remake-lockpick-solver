# Gothic Remake Lock Solver

A self-contained web tool that finds the **shortest sequence of moves** to open
the rotating-plate lock puzzle from the **Gothic Remake** game. Recreate any lock
configuration, press **Solve**, and get the optimal solution computed with a
breadth-first search.

No build step, no dependencies — it's a single HTML file you open in a browser.

## What it is

The lock consists of several plates, each sitting at a numbered position. Turning
one plate may also turn others (mechanically linked inside the lock). Working out
the order of turns by hand is tedious, so this tool models the lock and searches
for the shortest valid sequence of turns that lines every plate up at the target
position.

## Lock rules

- **Plates:** 4 to 7.
- **Positions:** each plate sits at a position from **1 to 7**.
- **Goal:** the lock opens when **all plates are at position 4**.
- **Moves:** turning a plate shifts it by one step — **Left** (−1) or **Right** (+1).
- **Connections are directional.** A connection from plate *i* to plate *j* means
  *turning plate i* also affects plate *j*:
  - `With` — plate *j* turns in the **same** direction.
  - `Against` — plate *j* turns in the **opposite** direction.
  - `None` — no effect.

  Because connections are one-way, `i → j` does **not** imply `j → i`; set each
  direction independently.
- **Out-of-range cancels the whole move.** If a turn would push *any* plate below 1
  or above 7, the entire move is rejected (nothing changes).

## How to run

Open `index.html` in any modern browser — double-click the file or drag it into a
browser window. There is nothing to install and no server to start.

## How to use

1. **Number of plates** — choose how many plates the lock has (4–7).
2. **Plate positions** — for each plate, click the hole matching its current
   position. The target position (4) is highlighted.
3. **Connection matrix** — for each ordered pair of plates, pick `None`, `With`, or
   `Against`. The row is the plate you turn; the column is the plate that's affected.
   The diagonal is disabled (a plate can't connect to itself).
4. Press **Solve**. The result panel shows the shortest move list, or a message if
   the lock can't be opened from the given starting state.

Consecutive identical moves are collapsed in the output, e.g. `Plate 2 - Right ×3`.

## How the solver works

The solver treats the lock as a **graph search problem** and runs a
**breadth-first search (BFS)** to find the shortest solution. The relevant
functions live in `index.html`: `solveBFS`, `tryMove`, `isSolved`, `encodeState`,
and `compressMoves`.

### 1. State representation

A *state* is the full configuration of the lock: an array holding every plate's
current position, e.g. `[1, 2, 3, 4]` for a 4-plate lock. To track which states
have already been seen, each state is turned into a string key by `encodeState`,
which simply joins the positions with commas (`[1, 2, 3] → "1,2,3"`). The comma
delimiter avoids ambiguous collisions — without it, `[1, 2, 3]` and `[12, 3]`
could encode to the same string.

### 2. Goal test

The lock is open when **every plate is at position 4**. `isSolved` checks exactly
this (`state.every(p => p === 4)`). If the starting state is already solved, the
solver returns immediately with an empty move list.

### 3. Generating moves (`tryMove`)

From any state there are **2 × n candidate moves** — each of the *n* plates can be
turned **Left** (−1) or **Right** (+1). Applying a move works in two steps:

1. **Build a delta vector.** The turned plate gets ±1. Then, reading that plate's
   row in the connection matrix, every linked plate also gets a delta: `with`
   copies the same direction, `against` takes the opposite. Connections are
   directional, so only the *turned* plate's row matters.
2. **Validate and apply.** The new position of each plate is `position + delta`.
   If **any** plate would fall outside the 1–7 range, the move is illegal and
   `tryMove` returns `null` — the entire move is cancelled, not just the offending
   plate.

### 4. The BFS search (`solveBFS`)

BFS explores states layer by layer, in increasing order of move count:

- A **queue** holds the states still to be explored. Instead of removing items
  with `shift()` (which is O(n)), the code keeps a `head` index that simply
  advances through the array — an O(1) dequeue.
- A **`visited` map** records every state ever reached. For each entry it stores
  the state itself, a pointer to the **parent** state, and the **move** that led
  there. This serves double duty: it prevents revisiting states *and* stores
  enough information to reconstruct the solution later.

The main loop, in pseudocode:

```
enqueue(start); visited[start] = { parent: none, move: none }
while queue not empty:
    current = dequeue()
    for each plate, for each direction (Left, Right):
        next = tryMove(current, plate, direction)
        if next is null or next in visited: skip
        visited[next] = { parent: current, move: (plate, direction) }
        if isSolved(next): reconstruct and return the path
        enqueue(next)
return null   # no solution reachable
```

### 5. Why the result is the shortest

The state graph is **unweighted** — every move counts as one step. BFS visits all
states reachable in *k* moves before any state that needs *k + 1*. So the first
time it reaches a solved state, it has done so via a minimum-length sequence. That
makes the returned solution provably **optimal** (fewest moves).

### 6. Reconstructing the path

When a solved state is found, the solver walks **backwards** through the `parent`
pointers in `visited`, collecting the stored move at each step and prepending it
to the list (`unshift`). Following parents from the goal back to the start and
reversing the order yields the moves in the order you should perform them.

### 7. Complexity & diagnostics

Each plate has 7 possible positions, so the state space is bounded by **7ⁿ**
(at most 7⁷ ≈ 823,000 states for a 7-plate lock). BFS visits each reachable state
once. Because a large search can take a moment, the UI defers the computation so
the page stays responsive. The result panel reports diagnostics gathered during
the search: number of **visited states**, the peak **queue size**, and the
**execution time**.

### 8. Output compression (`compressMoves`)

The raw solution is a flat list of single-step turns. Before display,
`compressMoves` collapses consecutive identical moves into one entry with a count,
so `Plate 2 - Right`, `Plate 2 - Right`, `Plate 2 - Right` becomes
`Plate 2 - Right ×3`.

## Tests

Regression tests for the core algorithm live in `tests/solver.test.mjs`. Run them
with Node (no test framework required):

```bash
node tests/solver.test.mjs
```

The suite exits with a non-zero status on any failure. It covers:

- defensive input handling (invalid sizes, out-of-range positions, bad connections),
- `tryMove` mechanics including `With`/`Against` propagation and move cancellation,
- BFS correctness checked against an **independent reference BFS**,
- **exhaustive** shortest-path verification for small state spaces (1–3 plates, and
  all 2-plate connection combinations),
- move compression round-trips and state encoding,
- randomized fuzz testing across 4–7 plate locks.

## Project structure

```
.
├── index.html              # The entire app: UI, styles, and solver logic
└── tests/
    └── solver.test.mjs     # Node-based regression tests for the solver
```

## Tech stack

Plain **HTML, CSS, and vanilla JavaScript** — no frameworks, no dependencies, no
build tooling. The gothic stone-and-brass styling is hand-written CSS embedded in
`index.html`.

## About this project

This project was built as a test of the **Composer 2.5** model in **Cursor**.
