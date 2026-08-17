import { useCallback, useEffect, useMemo, useState } from "react";

/* ================================================================
   СУДОКУ · ДЗЕН — вся игра в одном файле.
   Средний уровень · без проигрыша · без звука · бесконечные подсказки.
   Работает в любом браузере на Android и Windows.
   ================================================================ */

/* ---------------- движок судоку ---------------- */

const CELLS = 81;

const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function candidatesMask(grid: number[], i: number): number {
  let used = 0;
  const r = rowOf(i);
  const c = colOf(i);
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    used |= 1 << grid[r * 9 + k];
    used |= 1 << grid[k * 9 + c];
  }
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      used |= 1 << grid[(br + a) * 9 + (bc + b)];
    }
  }
  return ~used & 0b1111111110;
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

function fillGrid(grid: number[], pos: number): boolean {
  if (pos === CELLS) return true;
  if (grid[pos] !== 0) return fillGrid(grid, pos + 1);
  const mask = candidatesMask(grid, pos);
  const nums: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) nums.push(d);
  for (const d of shuffled(nums)) {
    grid[pos] = d;
    if (fillGrid(grid, pos + 1)) return true;
    grid[pos] = 0;
  }
  return false;
}

function countSolutions(grid: number[], limit: number): number {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0) {
      const m = candidatesMask(grid, i);
      const cnt = popcount(m);
      if (cnt === 0) return 0;
      if (cnt < bestCount) {
        bestCount = cnt;
        best = i;
        bestMask = m;
        if (cnt === 1) break;
      }
    }
  }
  if (best === -1) return 1;
  let count = 0;
  for (let d = 1; d <= 9 && count < limit; d++) {
    if (bestMask & (1 << d)) {
      grid[best] = d;
      count += countSolutions(grid, limit - count);
      grid[best] = 0;
    }
  }
  return count;
}

/** Полная сетка + симметричное выдалбливание до ~35 подсказок (средний уровень),
    с проверкой единственности решения на каждом шаге. */
function generatePuzzle(targetGivens: number): { puzzle: number[]; solution: number[] } {
  const full = new Array<number>(CELLS).fill(0);
  fillGrid(full, 0);
  const puzzle = full.slice();
  let givens = CELLS;
  const tried = new Set<number>();
  for (const i of shuffled(Array.from({ length: CELLS }, (_, k) => k))) {
    if (givens <= targetGivens) break;
    const j = CELLS - 1 - i;
    if (tried.has(i) || tried.has(j) || puzzle[i] === 0) continue;
    tried.add(i);
    tried.add(j);
    const a = puzzle[i];
    const b = puzzle[j];
    const same = i === j;
    puzzle[i] = 0;
    if (!same) puzzle[j] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) {
      puzzle[i] = a;
      if (!same) puzzle[j] = b;
    } else {
      givens -= same ? 1 : 2;
    }
  }
  return { puzzle, solution: full };
}

/* соседние клетки (строка / столбец / блок) — предвычисление */
const PEERS: number[][] = (() => {
  const res: number[][] = [];
  for (let i = 0; i < CELLS; i++) {
    const set = new Set<number>();
    const r = rowOf(i);
    const c = colOf(i);
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);
      set.add(k * 9 + c);
    }
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) set.add((br + a) * 9 + (bc + b));
    set.delete(i);
    res.push([...set]);
  }
  return res;
})();

function computeConflicts(board: number[]): Set<number> {
  const res = new Set<number>();
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const u: number[] = [];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) u.push((br * 3 + a) * 9 + bc * 3 + b);
      units.push(u);
    }
  }
  for (const u of units) {
    const seen = new Map<number, number[]>();
    for (const i of u) {
      const v = board[i];
      if (!v) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v)!.push(i);
    }
    for (const idxs of seen.values()) {
      if (idxs.length > 1) idxs.forEach((i) => res.add(i));
    }
  }
  return res;
}

/* ---------------- сохранение ---------------- */

const SAVE_KEY = "sudoku-zen-save";
const THEME_KEY = "sudoku-zen-theme";

type SaveState = {
  v: 1;
  puzzle: number[];
  solution: number[];
  board: number[];
  given: boolean[];
  notes: number[];
  hints: number;
  elapsed: number;
  won: boolean;
};

function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    const ok =
      s &&
      Array.isArray(s.board) &&
      s.board.length === CELLS &&
      Array.isArray(s.puzzle) &&
      s.puzzle.length === CELLS &&
      Array.isArray(s.solution) &&
      s.solution.length === CELLS &&
      Array.isArray(s.given) &&
      Array.isArray(s.notes);
    return ok ? s : null;
  } catch {
    return null;
  }
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

/* ---------------- иконки (инлайн-SVG, без эмодзи) ---------------- */

type IconProps = { size?: number; className?: string };
const ic = (p: IconProps) => ({
  width: p.size ?? 18,
  height: p.size ?? 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: p.className,
});

const IconSun = (p: IconProps) => (
  <svg {...ic(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19" />
  </svg>
);
const IconMoon = (p: IconProps) => (
  <svg {...ic(p)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  </svg>
);
const IconPencil = (p: IconProps) => (
  <svg {...ic(p)}>
    <path d="M4 20l4.5-1L19.6 7.9a2.05 2.05 0 0 0-2.9-2.9L5.6 16.1 4 20z" />
    <path d="M13.8 6.2l3 3" />
  </svg>
);
const IconEraser = (p: IconProps) => (
  <svg {...ic(p)}>
    <path d="M6.5 20h11.5" />
    <path d="M5.2 14.6l7.4-7.4a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-1.4.6H9l-3.8-3.8a1.9 1.9 0 0 1 0-2.6z" />
    <path d="M9.5 10.3l4.6 4.6" />
  </svg>
);
const IconSpark = (p: IconProps) => (
  <svg {...ic(p)}>
    <path d="M12 3.5l1.9 5.4 5.4 1.9-5.4 1.9L12 18.1l-1.9-5.4-5.4-1.9 5.4-1.9L12 3.5z" />
    <path d="M19 3v3M20.5 4.5h-3" />
  </svg>
);
const IconInfinity = (p: IconProps) => (
  <svg {...ic(p)}>
    <circle cx="8" cy="12" r="4.1" />
    <circle cx="16" cy="12" r="4.1" />
  </svg>
);
const IconRefresh = (p: IconProps) => (
  <svg {...ic(p)}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 3.8v4.4h-4.4" />
  </svg>
);

/* ---------------- декоративные элементы ---------------- */

function Enso({
  size = 40,
  stroke = "var(--jade)",
  width = 9,
  className,
}: {
  size?: number;
  stroke?: string;
  width?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        r="46"
        pathLength={100}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray="85 15"
        transform="rotate(-112 60 60)"
      />
    </svg>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const C = 2 * Math.PI * 10.5;
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" className="-rotate-90" aria-hidden="true">
      <circle cx="13" cy="13" r="10.5" fill="none" stroke="var(--line)" strokeWidth="3.2" />
      <circle
        cx="13"
        cy="13"
        r="10.5"
        fill="none"
        stroke="var(--jade)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

function Motes() {
  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 6,
        dur: 7 + Math.random() * 8,
        delay: Math.random() * 6,
        gold: i % 3 === 0,
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {motes.map((m) => (
        <span
          key={m.id}
          className="mote"
          style={{
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            background: m.gold ? "var(--mote-2)" : "var(--mote-1)",
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- приложение ---------------- */

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [game, setGame] = useState<{ puzzle: number[]; solution: number[] } | null>(null);
  const [board, setBoard] = useState<number[]>([]);
  const [given, setGiven] = useState<boolean[]>([]);
  const [notes, setNotes] = useState<number[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [hints, setHints] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [confirmNew, setConfirmNew] = useState(false);
  const [lastHint, setLastHint] = useState<{ i: number; n: number } | null>(null);

  /* тема */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* приватный режим — не страшно */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0d1412" : "#edf1ea");
  }, [theme]);

  /* новая партия */
  const startNew = useCallback(() => {
    setGenerating(true);
    setWon(false);
    setShowWin(false);
    setConfirmNew(false);
    window.setTimeout(() => {
      const g = generatePuzzle(35);
      setGame(g);
      setBoard(g.puzzle.slice());
      setGiven(g.puzzle.map((v) => v !== 0));
      setNotes(new Array<number>(CELLS).fill(0));
      setSel(null);
      setHints(0);
      setElapsed(0);
      setNotesMode(false);
      setLastHint(null);
      setGenerating(false);
    }, 90);
  }, []);

  /* старт: восстанавливаем сохранённую партию или генерируем новую */
  useEffect(() => {
    const save = loadSave();
    if (save) {
      setGame({ puzzle: save.puzzle, solution: save.solution });
      setBoard(save.board);
      setGiven(save.given);
      setNotes(save.notes);
      setHints(save.hints);
      setElapsed(save.elapsed);
      setWon(save.won);
      setShowWin(save.won);
      setGenerating(false);
    } else {
      startNew();
    }
  }, [startNew]);

  /* автосохранение */
  useEffect(() => {
    if (!game || generating) return;
    try {
      const s: SaveState = {
        v: 1,
        puzzle: game.puzzle,
        solution: game.solution,
        board,
        given,
        notes,
        hints,
        elapsed,
        won,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [game, board, given, notes, hints, elapsed, won, generating]);

  /* мягкий отсчёт времени (ни на что не влияет — просто дыхание партии) */
  useEffect(() => {
    if (generating || won || !game) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [generating, won, game]);

  const conflicts = useMemo(() => (board.length ? computeConflicts(board) : new Set<number>()), [board]);

  const progress = useMemo(() => {
    if (!game || board.length !== CELLS) return 0;
    let n = 0;
    for (let i = 0; i < CELLS; i++) if (board[i] === game.solution[i]) n++;
    return n / CELLS;
  }, [board, game]);

  const isComplete = useCallback(
    (b: number[]) => {
      if (!game) return false;
      for (let i = 0; i < CELLS; i++) if (b[i] !== game.solution[i]) return false;
      return true;
    },
    [game]
  );

  const finishIfComplete = useCallback(
    (b: number[]) => {
      if (isComplete(b)) {
        setWon(true);
        window.setTimeout(() => setShowWin(true), 550);
      }
    },
    [isComplete]
  );

  /* поставить цифру (или заметку) */
  const placeDigit = useCallback(
    (d: number) => {
      if (!game || won || generating || sel == null || given[sel]) return;
      if (notesMode) {
        if (board[sel] !== 0) return;
        setNotes((prev) => {
          const n = prev.slice();
          n[sel] ^= 1 << d;
          return n;
        });
        return;
      }
      const b = board.slice();
      b[sel] = d;
      setBoard(b);
      setNotes((prev) => {
        const n = prev.slice();
        n[sel] = 0;
        for (const p of PEERS[sel]) n[p] &= ~(1 << d);
        return n;
      });
      setLastHint(null);
      finishIfComplete(b);
    },
    [game, won, generating, sel, given, notesMode, board, finishIfComplete]
  );

  /* стереть клетку */
  const eraseCell = useCallback(() => {
    if (sel == null || given[sel] || won || generating) return;
    if (board[sel] === 0 && notes[sel] === 0) return;
    const b = board.slice();
    b[sel] = 0;
    setBoard(b);
    setNotes((prev) => {
      const n = prev.slice();
      n[sel] = 0;
      return n;
    });
  }, [sel, given, won, generating, board, notes]);

  /* бесконечная подсказка */
  const giveHint = useCallback(() => {
    if (!game || won || generating) return;
    let target = sel != null && board[sel] !== game.solution[sel] ? sel : -1;
    if (target === -1) {
      const opts: number[] = [];
      for (let i = 0; i < CELLS; i++) if (board[i] !== game.solution[i]) opts.push(i);
      if (opts.length === 0) return;
      target = opts[Math.floor(Math.random() * opts.length)];
    }
    const d = game.solution[target];
    const b = board.slice();
    b[target] = d;
    setBoard(b);
    setGiven((prev) => {
      const g = prev.slice();
      g[target] = true;
      return g;
    });
    setNotes((prev) => {
      const n = prev.slice();
      n[target] = 0;
      for (const p of PEERS[target]) n[p] &= ~(1 << d);
      return n;
    });
    setSel(target);
    setHints((h) => h + 1);
    setLastHint({ i: target, n: Date.now() });
    finishIfComplete(b);
  }, [game, won, generating, sel, board, finishIfComplete]);

  /* клавиатура */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || generating) return;
      if (/^(Digit[1-9]|Numpad[1-9])$/.test(e.code)) {
        placeDigit(parseInt(e.code.slice(-1), 10));
        return;
      }
      switch (e.code) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          setSel((s) => {
            const cur = s ?? 40;
            let r = rowOf(cur);
            let c = colOf(cur);
            if (e.code === "ArrowUp") r = (r + 8) % 9;
            if (e.code === "ArrowDown") r = (r + 1) % 9;
            if (e.code === "ArrowLeft") c = (c + 8) % 9;
            if (e.code === "ArrowRight") c = (c + 1) % 9;
            return r * 9 + c;
          });
          break;
        }
        case "Backspace":
        case "Delete":
          eraseCell();
          break;
        case "KeyN":
          setNotesMode((m) => !m);
          break;
        case "KeyH":
          giveHint();
          break;
        case "Escape":
          setSel(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placeDigit, eraseCell, giveHint, generating]);

  const selValue = sel != null && board.length ? board[sel] : 0;
  const peerSet = useMemo(() => (sel != null ? new Set(PEERS[sel]) : null), [sel]);
  const dark = theme === "dark";

  const digitCounts = useMemo(() => {
    const c = new Array<number>(10).fill(0);
    for (const v of board) if (v) c[v]++;
    return c;
  }, [board]);

  const requestNew = () => {
    if (confirmNew) startNew();
    else {
      setConfirmNew(true);
      window.setTimeout(() => setConfirmNew(false), 2600);
    }
  };

  return (
    <div className={`themed zen-bg relative min-h-dvh overflow-x-hidden ${dark ? "dark" : ""}`}>
      {/* живой фон: дрейфующие энсо, иероглиф, зерно */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="drift-enso" style={{ top: "-8%", right: "-6%" }}>
          <Enso size={340} stroke="var(--jade)" width={5} />
        </div>
        <div className="drift-enso slow" style={{ bottom: "-12%", left: "-8%" }}>
          <Enso size={420} stroke="var(--amber)" width={4} />
        </div>
        <div className="drift-enso slower" style={{ top: "30%", left: "58%" }}>
          <Enso size={150} stroke="var(--ink)" width={6} />
        </div>
        <div
          className="drift-enso slower font-display"
          style={{ top: "8%", left: "4%", fontSize: "min(38vw, 300px)", lineHeight: 1, color: "var(--ink)", opacity: 0.045 }}
        >
          禅
        </div>
      </div>
      <div className="zen-grain" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col items-center px-4 pb-10 pt-6 sm:max-w-lg">
        {/* ======== шапка ======== */}
        <header className="mb-5 flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Enso size={44} stroke="var(--jade)" width={10} className="shrink-0" />
            <div>
              <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight" style={{ color: "var(--ink)" }}>
                Судоку
              </h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                дзен · средний уровень
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              title="Прогресс и время"
            >
              <ProgressRing pct={progress} />
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--ink-soft)" }}>
                {fmtTime(elapsed)}
              </span>
            </div>
            <button
              className="zbtn grid h-10 w-10 place-items-center rounded-full border"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }}
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
              title={dark ? "Светлая тема" : "Тёмная тема"}
            >
              <span key={theme} className="cell-value" style={{ display: "grid" }}>
                {dark ? <IconSun size={19} /> : <IconMoon size={19} />}
              </span>
            </button>
          </div>
        </header>

        {/* ======== доска ======== */}
        <div className="board-frame" role="grid" aria-label="Поле судоку">
          {generating || board.length !== CELLS
            ? Array.from({ length: CELLS }, (_, i) => (
                <div
                  key={`sk-${i}`}
                  className={`cell skeleton ${i % 9 === 2 && i % 9 !== 8 ? "col-strong" : ""} ${
                    Math.floor(i / 9) % 3 === 2 && i < 72 ? "row-strong" : ""
                  } ${i % 9 === 8 ? "last-col" : ""} ${i >= 72 ? "last-row" : ""}`}
                />
              ))
            : board.map((v, i) => {
                const r = rowOf(i);
                const c = colOf(i);
                const cls = [
                  "cell",
                  given[i] ? "given" : "",
                  sel === i ? "selected" : "",
                  sel !== i && peerSet?.has(i) ? "peer" : "",
                  v !== 0 && v === selValue && sel !== i ? "same" : "",
                  !given[i] && conflicts.has(i) ? "conflict" : "",
                  c % 3 === 2 && c !== 8 ? "col-strong" : "",
                  r % 3 === 2 && r !== 8 ? "row-strong" : "",
                  c === 8 ? "last-col" : "",
                  r === 8 ? "last-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={i} role="gridcell" className={cls} onClick={() => setSel(i)} aria-label={`Клетка ${r + 1}-${c + 1}`}>
                    {v !== 0 ? (
                      <span key={`${i}-${v}`} className="cell-value">
                        {v}
                      </span>
                    ) : notes[i] ? (
                      <span className="notes-grid">
                        {Array.from({ length: 9 }, (_, d) => (
                          <span key={d}>{notes[i] & (1 << (d + 1)) ? d + 1 : ""}</span>
                        ))}
                      </span>
                    ) : null}
                    {lastHint && lastHint.i === i && (
                      <span key={lastHint.n} className="hint-flash pointer-events-none absolute inset-0" />
                    )}
                  </div>
                );
              })}
        </div>

        {/* ======== цифры ======== */}
        <div className="mt-4 grid w-full grid-cols-9 gap-1.5" role="group" aria-label="Цифры">
          {Array.from({ length: 9 }, (_, k) => k + 1).map((d, k) => {
            const left = 9 - digitCounts[d];
            return (
              <button
                key={d}
                className="key-btn zbtn flex aspect-[4/5] flex-col items-center justify-center rounded-lg border sm:aspect-[5/4]"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--surface)",
                  color: left <= 0 ? "var(--muted)" : "var(--ink)",
                  opacity: left <= 0 ? 0.45 : 1,
                  animationDelay: `${k * 30}ms`,
                }}
                onClick={() => placeDigit(d)}
                aria-label={`Цифра ${d}`}
              >
                <span className="text-lg font-bold leading-none sm:text-xl">{d}</span>
                <span className="mt-0.5 text-[10px] font-semibold leading-none" style={{ color: "var(--muted)" }}>
                  {left > 0 ? left : "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* ======== действия ======== */}
        <div className="mt-3 grid w-full grid-cols-4 gap-2">
          <button
            className="zbtn flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5"
            style={{ borderColor: "rgba(169,127,38,0.35)", background: "var(--amber-soft)", color: "var(--amber)" }}
            onClick={giveHint}
            title="Подсказка — заполняет клетку правильным числом (клавиша H)"
          >
            <span className="flex items-center gap-1.5">
              <IconSpark size={17} />
              <IconInfinity size={17} />
            </span>
            <span className="text-[11px] font-semibold">Подсказка</span>
          </button>

          <button
            className="zbtn flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5"
            style={
              notesMode
                ? { borderColor: "var(--jade)", background: "var(--jade)", color: "var(--surface)" }
                : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }
            }
            onClick={() => setNotesMode((m) => !m)}
            aria-pressed={notesMode}
            title="Заметки карандашом (клавиша N)"
          >
            <IconPencil size={17} />
            <span className="text-[11px] font-semibold">Заметки {notesMode ? "· вкл" : ""}</span>
          </button>

          <button
            className="zbtn flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }}
            onClick={eraseCell}
            title="Стереть клетку (Backspace)"
          >
            <IconEraser size={17} />
            <span className="text-[11px] font-semibold">Стереть</span>
          </button>

          <button
            className="zbtn flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5"
            style={
              confirmNew
                ? { borderColor: "var(--rose)", background: "var(--rose-soft)", color: "var(--rose)" }
                : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }
            }
            onClick={requestNew}
            title="Начать новую партию"
          >
            <IconRefresh size={17} />
            <span className="text-[11px] font-semibold">{confirmNew ? "Точно?" : "Заново"}</span>
          </button>
        </div>

        {/* ======== спокойные подписи ======== */}
        <p className="mt-4 flex items-center gap-1.5 text-center text-xs font-medium" style={{ color: "var(--muted)" }}>
          <IconInfinity size={14} />
          подсказки бесконечны · здесь нельзя проиграть · без звука
        </p>
        <p className="mt-1 text-center text-[11px]" style={{ color: "var(--muted)", opacity: 0.75 }}>
          Подсказки использованы: <span className="font-semibold" style={{ color: "var(--amber)" }}>{hints}</span>
          {" · "}осталось: <span className="font-semibold" style={{ color: "var(--amber)" }}>∞</span>
        </p>

        <p className="desktop-hint mt-auto pt-6 text-center text-[11px] leading-relaxed" style={{ color: "var(--muted)", opacity: 0.7 }}>
          Клавиатура: 1–9 — цифра · N — заметки · H — подсказка · стрелки — движение · Backspace — стереть
        </p>
      </div>

      {/* ======== победа ======== */}
      {showWin && (
        <div className="overlay-in fixed inset-0 z-50 grid place-items-center px-5" style={{ background: "rgba(10, 15, 13, 0.55)" }}>
          <Motes />
          <div
            className="card-in relative w-full max-w-sm rounded-2xl border p-7 text-center sm:p-9"
            style={{ background: "var(--surface)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
            role="dialog"
            aria-label="Партия решена"
          >
            <div className="relative mx-auto mb-4 h-[120px] w-[120px]">
              <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
                <circle
                  className="enso-draw"
                  cx="60"
                  cy="60"
                  r="48"
                  pathLength={100}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  transform="rotate(-100 60 60)"
                />
              </svg>
              <span
                className="enso-seal font-display absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-md text-lg font-bold"
                style={{ background: "var(--amber)", color: "#fff8ec" }}
              >
                和
              </span>
            </div>

            <h2 className="font-display text-4xl font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
              Круг замкнут.
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Все 81 клетка на своих местах — спокойно и без единого поражения.
            </p>

            <div
              className="mt-6 grid grid-cols-2 gap-3 rounded-xl border p-4"
              style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
            >
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Время
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                  {fmtTime(elapsed)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Подсказок
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ color: "var(--amber)" }}>
                  {hints} <span className="text-base font-semibold">из ∞</span>
                </div>
              </div>
            </div>

            <button
              className="zbtn mt-6 w-full rounded-xl py-3.5 text-base font-bold"
              style={{ background: "var(--jade)", color: dark ? "#0c1712" : "#f4faf6" }}
              onClick={startNew}
            >
              Новая партия
            </button>
            <button
              className="zbtn mt-2 w-full rounded-xl py-2 text-sm font-semibold"
              style={{ color: "var(--muted)" }}
              onClick={() => setShowWin(false)}
            >
              Остаться и полюбоваться
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
