export type PieceType = "knight" | "rook" | "bishop" | "queen" | "king";

export type Sq = { r: number; c: number };

export const PIECE_GLYPH: Record<PieceType, string> = {
  knight: "♞",
  rook: "♜",
  bishop: "♝",
  queen: "♛",
  king: "♚",
};

export const PIECE_NAME: Record<PieceType, string> = {
  knight: "Knight",
  rook: "Rook",
  bishop: "Bishop",
  queen: "Queen",
  king: "King",
};

export const PIECE_HINT: Record<PieceType, string> = {
  knight: "Leaps in an L — and hops right over monsters!",
  rook: "Charges in straight lines.",
  bishop: "Slides on the diagonals.",
  queen: "Any straight or diagonal line.",
  king: "One careful step in any direction.",
};

export type RoomKind = "empty" | "monster" | "treasure" | "gate" | "throne";

export type Room = {
  kind: RoomKind;
  name: string;
  emoji: string;
  level: number;
  cleared: boolean;
  unlocks?: PieceType;
};

export const same = (a: Sq, b: Sq) => a.r === b.r && a.c === b.c;
export const key = (s: Sq) => `${s.r}-${s.c}`;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const MONSTERS: Array<{ name: string; emoji: string }> = [
  { name: "Slime Pawn", emoji: "🟢" },
  { name: "Cave Bat", emoji: "🦇" },
  { name: "Rock Golem", emoji: "🗿" },
  { name: "Grumpy Goblin", emoji: "👺" },
  { name: "Ghost Rook", emoji: "👻" },
  { name: "Spider Queen", emoji: "🕷️" },
  { name: "Ice Wolf", emoji: "🐺" },
  { name: "Fire Imp", emoji: "🔥" },
  { name: "Sneaky Rat", emoji: "🐀" },
  { name: "Snapping Croc", emoji: "🐊" },
];

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const START: Sq = { r: 7, c: 0 };
export const THRONE: Sq = { r: 0, c: 7 };

export function buildDungeon(seed = Math.floor(Math.random() * 100000)): Room[][] {
  const rnd = mulberry(seed);
  const grid: Room[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: Room[] = [];
    for (let c = 0; c < 8; c++) {
      const dist = Math.max(7 - r, c); // distance-ish from start corner
      let room: Room;
      if (r === START.r && c === START.c) {
        room = { kind: "empty", name: "Torchlit Landing", emoji: "🕯️", level: 0, cleared: true };
      } else if (r === THRONE.r && c === THRONE.c) {
        room = { kind: "throne", name: "Dragon Throne", emoji: "🐉", level: 4, cleared: false };
      } else {
        const roll = rnd();
        if (roll < 0.42) {
          const m = MONSTERS[Math.floor(rnd() * MONSTERS.length)]!;
          room = {
            kind: "monster",
            name: m.name,
            emoji: m.emoji,
            level: Math.min(3, 1 + Math.floor(dist / 3)),
            cleared: false,
          };
        } else if (roll < 0.58) {
          room = { kind: "treasure", name: "Gem Chest", emoji: "💎", level: 1, cleared: false };
        } else {
          room = { kind: "empty", name: "Quiet Hall", emoji: "", level: 0, cleared: true };
        }
      }
      row.push(room);
    }
    grid.push(row);
  }
  // Guaranteed piece-unlock gates
  const gates: Array<[Sq, PieceType, string, string]> = [
    [{ r: 5, c: 2 }, "rook", "Tower of Straight Paths", "🏰"],
    [{ r: 3, c: 3 }, "bishop", "Chapel of Diagonals", "⛪"],
    [{ r: 1, c: 5 }, "queen", "Crown Vault", "👑"],
  ];
  for (const [sq, unlocks, name, emoji] of gates) {
    grid[sq.r]![sq.c] = { kind: "gate", name, emoji, level: 2, cleared: false, unlocks };
  }
  return grid;
}

type Dir = [number, number];
const STRAIGHT: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: Dir[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const KNIGHT: Dir[] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

/** A room blocks sliding pieces while a live monster/dragon guards it. */
function blocks(room: Room) {
  return (room.kind === "monster" || room.kind === "throne") && !room.cleared;
}

export function legalMoves(from: Sq, piece: PieceType, grid: Room[][]): Sq[] {
  const out: Sq[] = [];
  if (piece === "knight" || piece === "king") {
    const offs = piece === "knight" ? KNIGHT : [...STRAIGHT, ...DIAGONAL];
    for (const [dr, dc] of offs) {
      const r = from.r + dr;
      const c = from.c + dc;
      if (inside(r, c)) out.push({ r, c });
    }
    return out;
  }
  const dirs =
    piece === "rook" ? STRAIGHT : piece === "bishop" ? DIAGONAL : [...STRAIGHT, ...DIAGONAL];
  for (const [dr, dc] of dirs) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (inside(r, c)) {
      out.push({ r, c });
      if (blocks(grid[r]![c]!)) break; // can capture it, but not slide past
      r += dr;
      c += dc;
    }
  }
  return out;
}

export type Challenge = {
  prompt: string;
  options: string[];
  answer: number;
  flavor: string;
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const shuffleAnswer = (correct: string, wrong: string[]) => {
  const opts = [correct, ...wrong];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j]!, opts[i]!];
  }
  return { options: opts, answer: opts.indexOf(correct) };
};

function mathChallenge(level: number): Challenge {
  const max = level <= 1 ? 10 : level === 2 ? 20 : 12;
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * max);
  let prompt: string;
  let value: number;
  if (level >= 3 && Math.random() < 0.5) {
    const x = 2 + Math.floor(Math.random() * 5);
    const y = 2 + Math.floor(Math.random() * 5);
    prompt = `${x} × ${y} = ?`;
    value = x * y;
  } else if (Math.random() < 0.5) {
    prompt = `${a} + ${b} = ?`;
    value = a + b;
  } else {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    prompt = `${hi} − ${lo} = ?`;
    value = hi - lo;
  }
  const wrongs = new Set<number>();
  while (wrongs.size < 3) {
    const d = value + (Math.floor(Math.random() * 9) - 4);
    if (d !== value && d >= 0) wrongs.add(d);
  }
  const { options, answer } = shuffleAnswer(String(value), [...wrongs].map(String));
  return { prompt, options, answer, flavor: "Solve the rune-math to break the ward!" };
}

const CHESS_QUIZ: Array<{ q: string; a: string; w: string[] }> = [
  { q: "Which piece jumps in an L shape?", a: "Knight", w: ["Rook", "Bishop", "Queen"] },
  { q: "Which piece only moves on diagonals?", a: "Bishop", w: ["Rook", "Knight", "King"] },
  { q: "Which piece moves in straight lines only?", a: "Rook", w: ["Bishop", "Knight", "Queen"] },
  { q: "Which piece is the most powerful?", a: "Queen", w: ["Pawn", "Rook", "Bishop"] },
  { q: "How many squares does a chessboard have?", a: "64", w: ["32", "100", "48"] },
  { q: "How many squares does a king step?", a: "1", w: ["2", "3", "8"] },
  { q: "Which piece can hop over other pieces?", a: "Knight", w: ["Rook", "Queen", "King"] },
  { q: "How many rooks does each army start with?", a: "2", w: ["1", "4", "8"] },
];

const RIDDLES: Array<{ q: string; a: string; w: string[] }> = [
  {
    q: "I have a face and hands but no arms. What am I?",
    a: "A clock",
    w: ["A ghost", "A door", "A bat"],
  },
  { q: "What has keys but opens no doors?", a: "A piano", w: ["A map", "A crown", "A torch"] },
  {
    q: "The more you take, the more you leave behind. What?",
    a: "Footsteps",
    w: ["Gold", "Bats", "Stones"],
  },
  { q: "What goes up but never comes down?", a: "Your age", w: ["A rock", "Rain", "A sword"] },
  { q: "What has a tail and a head but no body?", a: "A coin", w: ["A dragon", "A key", "A rope"] },
];

export function makeChallenge(room: Room): Challenge {
  if (room.kind === "treasure") {
    const q = pick(RIDDLES);
    const { options, answer } = shuffleAnswer(q.a, q.w);
    return { prompt: q.q, options, answer, flavor: "The chest whispers a riddle..." };
  }
  if (room.kind === "gate" || Math.random() < 0.4) {
    const q = pick(CHESS_QUIZ);
    const { options, answer } = shuffleAnswer(q.a, q.w);
    return { prompt: q.q, options, answer, flavor: "Answer the guardian's chess trial!" };
  }
  return mathChallenge(room.level);
}
