/**
 * Regression tests for Gothic Remake Lock Solver core algorithm.
 * Run: node tests/solver.test.mjs
 */

const MIN_POS = 1;
const MAX_POS = 7;
const TARGET_POS = 4;

// ─── Production logic (mirrored from index.html) ───────────────────────────────

function encodeState(state) {
  return state.join(',');
}

function tryMove(state, plateIndex, direction, conn) {
  if (!Array.isArray(state) || !Array.isArray(conn)) return null;
  const n = state.length;
  if (n === 0 || conn.length !== n) return null;
  if (!Number.isInteger(plateIndex) || plateIndex < 0 || plateIndex >= n) return null;
  if (direction !== -1 && direction !== 1) return null;

  const deltas = new Array(n).fill(0);
  deltas[plateIndex] = direction;

  for (let j = 0; j < n; j++) {
    if (j === plateIndex) continue;
    const link = conn[plateIndex][j];
    if (link === 'with') deltas[j] = direction;
    else if (link === 'against') deltas[j] = -direction;
  }

  const next = new Array(n);
  for (let i = 0; i < n; i++) {
    next[i] = state[i] + deltas[i];
    if (next[i] < MIN_POS || next[i] > MAX_POS) return null;
  }
  return next;
}

function isSolved(state) {
  return state.every(p => p === TARGET_POS);
}

function validatePositions(pos) {
  if (!Array.isArray(pos) || pos.length === 0) return 'No plate positions defined.';
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i];
    if (!Number.isInteger(p) || p < MIN_POS || p > MAX_POS) {
      return `Plate ${i + 1}: position must be an integer between ${MIN_POS} and ${MAX_POS}.`;
    }
  }
  return null;
}

function validateConnections(conn, n) {
  if (!Array.isArray(conn) || conn.length !== n) return 'Connection matrix has an invalid size.';
  const allowed = new Set(['none', 'with', 'against']);
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(conn[i]) || conn[i].length !== n) return 'invalid row';
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (!allowed.has(conn[i][j])) return 'invalid link';
    }
  }
  return null;
}

function solveBFS(initialState, conn) {
  if (!Array.isArray(initialState) || !Array.isArray(conn)) return null;
  const n = initialState.length;
  if (n === 0 || conn.length !== n) return null;
  if (validatePositions(initialState) || validateConnections(conn, n)) return null;

  const startKey = encodeState(initialState);

  if (isSolved(initialState)) {
    return { moves: [], visited: 1, maxQueue: 1 };
  }

  const visited = new Map();
  visited.set(startKey, { state: initialState, parent: null, move: null });

  const queue = [startKey];
  let maxQueue = 1;
  let head = 0;

  while (head < queue.length) {
    const key = queue[head++];
    const { state } = visited.get(key);

    for (let plate = 0; plate < n; plate++) {
      for (const [dirVal, dirName] of [[-1, 'Left'], [1, 'Right']]) {
        const nextState = tryMove(state, plate, dirVal, conn);
        if (!nextState) continue;

        const nextKey = encodeState(nextState);
        if (visited.has(nextKey)) continue;

        visited.set(nextKey, {
          state: nextState,
          parent: key,
          move: { plate: plate + 1, direction: dirName },
        });
        queue.push(nextKey);
        maxQueue = Math.max(maxQueue, queue.length - head);

        if (isSolved(nextState)) {
          const moves = [];
          let cur = nextKey;
          while (visited.get(cur).move) {
            moves.unshift(visited.get(cur).move);
            cur = visited.get(cur).parent;
          }
          return { moves, visited: visited.size, maxQueue };
        }
      }
    }
  }

  return null;
}

function compressMoves(moves) {
  if (moves.length === 0) return [];
  const compressed = [];
  let cur = { ...moves[0], count: 1 };
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i];
    if (m.plate === cur.plate && m.direction === cur.direction) cur.count++;
    else {
      compressed.push(cur);
      cur = { ...m, count: 1 };
    }
  }
  compressed.push(cur);
  return compressed;
}

function applyMoves(state, moves, conn) {
  let s = state.slice();
  for (const m of moves) {
    const dir = m.direction === 'Left' ? -1 : 1;
    const next = tryMove(s, m.plate - 1, dir, conn);
    if (!next) throw new Error(`Invalid move in solution: ${JSON.stringify(m)} at state ${s}`);
    s = next;
  }
  return s;
}

function emptyConn(n) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => 'none'));
}

// ─── Independent reference BFS (different implementation) ────────────────────

function referenceBFS(initialState, conn) {
  const n = initialState.length;
  if (isSolved(initialState)) return [];

  const seen = new Set([encodeState(initialState)]);
  /** @type {Array<{ state: number[], moves: Array<{plate:number,direction:string}> }>} */
  const q = [{ state: initialState, moves: [] }];

  while (q.length) {
    const { state, moves } = q.shift();
    for (let plate = 0; plate < n; plate++) {
      for (const [dirVal, dirName] of [[-1, 'Left'], [1, 'Right']]) {
        const next = tryMove(state, plate, dirVal, conn);
        if (!next) continue;
        const key = encodeState(next);
        if (seen.has(key)) continue;
        seen.add(key);
        const nextMoves = [...moves, { plate: plate + 1, direction: dirName }];
        if (isSolved(next)) return nextMoves;
        q.push({ state: next, moves: nextMoves });
      }
    }
  }
  return null;
}

// ─── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

console.log('Running solver tests...\n');

// ─── Defensive input tests ───────────────────────────────────────────────────

assert(tryMove([], 0, 1, emptyConn(0)) === null, 'reject empty state');
assert(tryMove([4], -1, 1, emptyConn(1)) === null, 'reject negative plate index');
assert(tryMove([4], 2, 1, emptyConn(1)) === null, 'reject out-of-range plate index');
assert(tryMove([4], 0, 2, emptyConn(1)) === null, 'reject invalid direction');
assert(solveBFS([1, 2], emptyConn(3)) === null, 'reject state/conn size mismatch');
assert(solveBFS([0, 4], emptyConn(2)) === null, 'reject out-of-range position');
assert(solveBFS([4, 4], [['none', 'bad'], ['none', 'none']]) === null, 'reject invalid connection');

// ─── tryMove unit tests ──────────────────────────────────────────────────────

{
  const conn = emptyConn(1);

  assertEq(tryMove([4], 0, -1, conn), [3], 'single plate left');
  assertEq(tryMove([4], 0, 1, conn), [5], 'single plate right');
  assert(tryMove([1], 0, -1, conn) === null, 'reject left at position 1');
  assert(tryMove([7], 0, 1, conn) === null, 'reject right at position 7');
}

{
  const conn = emptyConn(3);
  conn[0][2] = 'with';
  conn[0][1] = 'against';

  assertEq(
    tryMove([3, 3, 3], 0, 1, conn),
    [4, 2, 4],
    'with + against from turned plate 1'
  );

  // Entire move cancelled if any plate out of bounds
  assert(
    tryMove([1, 7, 4], 0, -1, conn) === null,
    'cancel move when connected plate would leave range'
  );
}

{
  // Directional: turning plate 3 does NOT affect plate 1 unless conn[2][0] set
  const conn = emptyConn(3);
  conn[0][2] = 'with'; // P1 with P3
  assertEq(tryMove([2, 5, 2], 2, 1, conn), [2, 5, 3], 'turning P3 does not move P1');
  assertEq(tryMove([2, 5, 2], 0, 1, conn), [3, 5, 3], 'turning P1 moves P3 with');
}

// ─── BFS correctness ─────────────────────────────────────────────────────────

{
  const conn = emptyConn(1);
  const r = solveBFS([1], conn);
  assert(r !== null, 'single plate solvable from 1');
  assertEq(r.moves, [
    { plate: 1, direction: 'Right' },
    { plate: 1, direction: 'Right' },
    { plate: 1, direction: 'Right' },
  ], 'single plate shortest path 1→4');
  assert(isSolved(applyMoves([1], r.moves, conn)), 'solution reaches target');
}

{
  const conn = emptyConn(1);
  const r = solveBFS([4], conn);
  assertEq(r.moves, [], 'already solved returns empty moves');
  assertEq(r.visited, 1, 'already solved visited = 1');
}

{
  const conn = emptyConn(4);
  const start = [1, 1, 1, 1];
  const r = solveBFS(start, conn);
  const ref = referenceBFS(start, conn);
  assert(r !== null && ref !== null, '4 independent plates solvable');
  assertEq(r.moves.length, ref.length, 'BFS length matches reference BFS');
  assert(isSolved(applyMoves(start, r.moves, conn)), '4-plate solution valid');
}

// ─── Exhaustive shortest-path check (small state spaces) ───────────────────

for (let n = 1; n <= 3; n++) {
  const conn = emptyConn(n);
  const positions = Array(n).fill(MIN_POS);

  function enumerateStates(idx, current, fn) {
    if (idx === n) {
      fn(current.slice());
      return;
    }
    for (let p = MIN_POS; p <= MAX_POS; p++) {
      current[idx] = p;
      enumerateStates(idx + 1, current, fn);
    }
  }

  enumerateStates(0, positions, (start) => {
    const prod = solveBFS(start, conn);
    const ref = referenceBFS(start, conn);
    if (ref === null) {
      assert(prod === null, `n=${n} state ${start}: both should be unsolvable`);
    } else {
      assert(prod !== null, `n=${n} state ${start}: should be solvable`);
      assertEq(prod.moves.length, ref.length, `n=${n} state ${start}: shortest length`);
      assert(isSolved(applyMoves(start, prod.moves, conn)), `n=${n} state ${start}: valid path`);
    }
  });
}

// ─── Connected plates exhaustive (2 plates, all 49 connection combos) ───────

{
  const links = ['none', 'with', 'against'];
  for (const c01 of links) {
    for (const c10 of links) {
      const conn = emptyConn(2);
      conn[0][1] = c01;
      conn[1][0] = c10;

      for (let p0 = MIN_POS; p0 <= MAX_POS; p0++) {
        for (let p1 = MIN_POS; p1 <= MAX_POS; p1++) {
          const start = [p0, p1];
          const prod = solveBFS(start, conn);
          const ref = referenceBFS(start, conn);
          if (ref === null) {
            assert(prod === null, `2-plate conn ${c01}/${c10} start [${start}]: unsolvable`);
          } else {
            assert(prod !== null, `2-plate conn ${c01}/${c10} start [${start}]: solvable`);
            assertEq(prod.moves.length, ref.length, `2-plate shortest [${start}] ${c01}/${c10}`);
            assert(isSolved(applyMoves(start, prod.moves, conn)), `2-plate valid [${start}]`);
          }
        }
      }
    }
  }
}

// ─── Spec example connections ────────────────────────────────────────────────

{
  // Plate 1: With P3, Against P5, P6 (4 plates minimum for this - use 6 plates)
  const n = 6;
  const conn = emptyConn(n);
  conn[0][2] = 'with';   // P1 → P3 with
  conn[0][4] = 'against'; // P1 → P5 against
  conn[0][5] = 'against'; // P1 → P6 against

  const start = [1, 2, 3, 4, 5, 6];
  const after = tryMove(start, 0, 1, conn); // P1 right
  assertEq(after, [2, 2, 4, 4, 4, 5], 'spec example: P1 right affects P3,P5,P6');

  const r = solveBFS(start, conn);
  assert(r !== null, 'spec connection config solvable');
  assert(isSolved(applyMoves(start, r.moves, conn)), 'spec config solution valid');
}

// ─── compressMoves ───────────────────────────────────────────────────────────

assertEq(compressMoves([]), [], 'compress empty');
assertEq(
  compressMoves([
    { plate: 2, direction: 'Right' },
    { plate: 2, direction: 'Right' },
    { plate: 1, direction: 'Left' },
    { plate: 2, direction: 'Right' },
  ]),
  [
    { plate: 2, direction: 'Right', count: 2 },
    { plate: 1, direction: 'Left', count: 1 },
    { plate: 2, direction: 'Right', count: 1 },
  ],
  'compress groups consecutive moves'
);

// Decompress and verify count matches
{
  const moves = Array.from({ length: 4 }, () => ({ plate: 2, direction: 'Right' }));
  const c = compressMoves(moves);
  assert(c.length === 1 && c[0].count === 4, 'compress ×4');
  const expanded = [];
  for (const g of c) {
    for (let i = 0; i < g.count; i++) expanded.push({ plate: g.plate, direction: g.direction });
  }
  assertEq(expanded, moves, 'compress/decompress roundtrip');
}

// ─── encodeState uniqueness ──────────────────────────────────────────────────

{
  const a = encodeState([1, 2, 3]);
  const b = encodeState([12, 3, 4]); // would collide if naive join without delimiter issue
  // [1,2,3] -> "1,2,3" vs [12,3,4] -> "12,3,4" - comma delimiter is safe
  assert(a !== b, 'encodeState avoids ambiguous collisions');
  assertEq(encodeState([1, 2, 3]), '1,2,3', 'encodeState format');
}

// ─── Random fuzz (independent plates, 4-7 plates) ────────────────────────────

{
  let seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  }

  for (let trial = 0; trial < 200; trial++) {
    const n = 4 + Math.floor(rand() * 4);
    const conn = emptyConn(n);
    const start = Array.from({ length: n }, () => MIN_POS + Math.floor(rand() * MAX_POS));

    const prod = solveBFS(start, conn);
    const ref = referenceBFS(start, conn);

    if (ref === null) assert(prod === null, `fuzz trial ${trial}: unsolvable`);
    else {
      assert(prod !== null, `fuzz trial ${trial}: solvable`);
      assertEq(prod.moves.length, ref.length, `fuzz trial ${trial}: shortest`);
      assert(isSolved(applyMoves(start, prod.moves, conn)), `fuzz trial ${trial}: valid`);
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
