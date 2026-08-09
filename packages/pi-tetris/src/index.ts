/**
 * Tetris game extension - play Tetris with /tetris command
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, matchesKey, visibleWidth } from "@earendil-works/pi-tui";

// =============================================================================
// Constants
// =============================================================================

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const HIDDEN_ROWS = 4;
export const TOTAL_HEIGHT = BOARD_HEIGHT + HIDDEN_ROWS;

export const LEVEL_SPEEDS: number[] = [
	800, 720, 630, 550, 470, 380, 300, 220, 150, 100,
	90, 80, 70, 60, 50, 50, 50, 50, 50, 50,
];

export const LINES_PER_LEVEL = 10;

// The more lines cleaned,the more scores got (non-linear)
export const LINE_SCORES: Record<number, number> = {
	1: 100, 2: 300, 3: 500, 4: 800,
};

// =============================================================================
// Types
// =============================================================================

export type Shape = readonly (readonly number[])[];		// 2d matrix
export interface Position { x: number; y: number; }
export interface PieceDef { 
	name: string; 
	color: string; 
	rotations: readonly Shape[]; // a list of shape(2d matrix)
}
export interface Piece { 
	def: PieceDef; 
	rotation: number;	// Here the rotation means the turning mode:0,1,2,3 
	pos: Position; }
export interface GameState {
	board: number[][]; current: Piece | null; next: PieceDef;
	score: number; lines: number; level: number; gameOver: boolean; highScore: number;
}

// =============================================================================
// Piece definitions (7 standard tetrominoes)
// =============================================================================

function makeRotations3x3(cells: readonly [number, number][]): Shape[] {
	const base = Array.from({ length: 3 }, () => Array(3).fill(0));
	for (const [r, c] of cells) base[r][c] = 1;
	const out: Shape[] = [base];
	let cur = base;
	for (let i = 1; i < 4; i++) {
		const next = Array.from({ length: 3 }, () => Array(3).fill(0));
		for (let y = 0; y < 3; y++)
			for (let x = 0; x < 3; x++)
				// 90 degree clockwise turning 
				next[x][2 - y] = cur[y][x];
		out.push(next);
		cur = next;
	}
	return out;
}

function makeRotations4x4(cells: readonly [number, number][]): Shape[] {
	const base = Array.from({ length: 4 }, () => Array(4).fill(0));
	for (const [r, c] of cells) base[r][c] = 1;
	const out: Shape[] = [base];
	let cur = base;
	for (let i = 1; i < 4; i++) {
		const next = Array.from({ length: 4 }, () => Array(4).fill(0));
		for (let y = 0; y < 4; y++)
			for (let x = 0; x < 4; x++)
				next[x][3 - y] = cur[y][x];
		out.push(next);
		cur = next;
	}
	return out;
}

export const PIECE_DEFS: readonly PieceDef[] = [
	{ name: "I", color: "\x1b[36m", rotations: makeRotations4x4([[1, 0], [1, 1], [1, 2], [1, 3]]) },
	{ name: "O", color: "\x1b[93m", rotations: makeRotations3x3([[0, 0], [0, 1], [1, 0], [1, 1]]) },
	{ name: "T", color: "\x1b[35m", rotations: makeRotations3x3([[0, 1], [1, 0], [1, 1], [1, 2]]) },
	{ name: "S", color: "\x1b[32m", rotations: makeRotations3x3([[0, 1], [0, 2], [1, 0], [1, 1]]) },
	{ name: "Z", color: "\x1b[31m", rotations: makeRotations3x3([[0, 0], [0, 1], [1, 1], [1, 2]]) },
	{ name: "J", color: "\x1b[34m", rotations: makeRotations3x3([[0, 0], [1, 0], [1, 1], [1, 2]]) },
	{ name: "L", color: "\x1b[33m", rotations: makeRotations3x3([[0, 2], [1, 0], [1, 1], [1, 2]]) },
];

export const PIECE_COLOR_MAP: Record<string, number> = {};
for (let i = 0; i < PIECE_DEFS.length; i++) PIECE_COLOR_MAP[PIECE_DEFS[i].name] = i + 1;

// =============================================================================
// Pure game logic
// =============================================================================

export function randomPiece(): PieceDef { return PIECE_DEFS[Math.floor(Math.random() * PIECE_DEFS.length)]; }

export function createBoard(): number[][] { return Array.from({ length: TOTAL_HEIGHT }, () => Array(BOARD_WIDTH).fill(0)); }

export function getShape(piece: Piece): Shape { return piece.def.rotations[piece.rotation]; }

export function getPieceCells(piece: Piece): Position[] {
	const shape = getShape(piece);
	const cells: Position[] = [];
	for (let r = 0; r < shape.length; r++)
		for (let c = 0; c < shape[r].length; c++)
			if (shape[r][c]) cells.push({ x: piece.pos.x + c, y: piece.pos.y + r });
	return cells;
}

export function isValidPlacement(board: number[][], cells: Position[]): boolean {
	for (const { x, y } of cells) {
		// positions that outside the board or already existing other cells are invalid
		if (x < 0 || x >= BOARD_WIDTH || y >= TOTAL_HEIGHT) return false;
		if (y >= 0 && board[y][x] !== 0) return false;
	}
	return true;
}

export function tryMove(board: number[][], piece: Piece, dx: number, dy: number): Piece | null {
	const p: Piece = { ...piece, pos: { x: piece.pos.x + dx, y: piece.pos.y + dy } };
	return isValidPlacement(board, getPieceCells(p)) ? p : null;
}

export function tryRotate(board: number[][], piece: Piece): Piece | null {
	const p: Piece = { ...piece, rotation: (piece.rotation + 1) % 4 };
	if (isValidPlacement(board, getPieceCells(p))) return p;
	for (const dx of [1, -1, 2, -2]) {
		const k: Piece = { ...p, pos: { x: p.pos.x + dx, y: p.pos.y } };
		if (isValidPlacement(board, getPieceCells(k))) return k;
	}
	return null;
}

export function hardDrop(board: number[][], piece: Piece): Piece {
	let d = piece;
	while (true) { const n = tryMove(board, d, 0, 1); if (!n) break; d = n; }
	return d;
}

export function lockPiece(board: number[][], piece: Piece): number[][] {
	const ci = PIECE_COLOR_MAP[piece.def.name] ?? 1;
	for (const { x, y } of getPieceCells(piece))
		if (y >= 0 && y < TOTAL_HEIGHT) board[y][x] = ci;
	return board;
}

export function clearLines(board: number[][]): { board: number[][]; linesCleared: number } {
	const remaining = board.filter((r) => r.some((c) => c === 0));
	const cleared = TOTAL_HEIGHT - remaining.length;
	if (cleared === 0) return { board, linesCleared: 0 };
	const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(0));
	return { board: [...empty, ...remaining], linesCleared: cleared };
}

// The higher level and more lines cleaned,the greater score 
export function calculateScore(linesCleared: number, level: number): number { return (LINE_SCORES[linesCleared] ?? 0) * (level + 1); }
export function calculateLevel(totalLines: number): number { return Math.floor(totalLines / LINES_PER_LEVEL); }
export function getSpeed(level: number): number { return level < 0 ? LEVEL_SPEEDS[0] : level >= LEVEL_SPEEDS.length ? LEVEL_SPEEDS[LEVEL_SPEEDS.length - 1] : LEVEL_SPEEDS[level]; }

export function isGameOver(board: number[][], def: PieceDef): boolean {
	const w = def.rotations[0][0].length;
	return !isValidPlacement(board, getPieceCells({ def, rotation: 0, pos: { x: Math.floor((BOARD_WIDTH - w) / 2), y: 0 } }));
}

// Create a new piece in the middle of top line
export function createPiece(def: PieceDef): Piece {
	const w = def.rotations[0][0].length;
	return { def, rotation: 0, pos: { x: Math.floor((BOARD_WIDTH - w) / 2), y: 0 } };
}

export function createInitialState(highScore = 0): GameState {
	return { board: createBoard(), current: createPiece(randomPiece()), next: randomPiece(), score: 0, lines: 0, level: 0, gameOver: false, highScore };
}

// =============================================================================
// ANSI helpers
// =============================================================================

const R = "\x1b[0m";
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}${R}`;
const yellow = (s: string) => `\x1b[93m${s}${R}`;
const magenta = (s: string) => `\x1b[35m${s}${R}`;
const green = (s: string) => `\x1b[32m${s}${R}`;
const red = (s: string) => `\x1b[31m${s}${R}`;
const blue = (s: string) => `\x1b[34m${s}${R}`;
const orange = (s: string) => `\x1b[33m${s}${R}`;
const colorFns: ((s: string) => string)[] = [(s) => s, cyan, yellow, magenta, green, red, blue, orange];

// =============================================================================
// TetrisComponent
// =============================================================================

const SAVE = "tetris-save";
const BOARD_PX = BOARD_WIDTH * 2;
const SIDEBAR_W = 20;
const GAP = 3;
const TOTAL_W = BOARD_PX + 2 + GAP + SIDEBAR_W;

class TetrisComponent {
	private st: GameState;
	private iv: ReturnType<typeof setInterval> | null = null;
	private onClose: () => void;
	private onSave: (s: GameState | null) => void;
	private tui: { requestRender: () => void };
	private cache: { lines: string[]; width: number; ver: number } = { lines: [], width: 0, ver: -1 };
	private version = 0;
	private paused = false;

	constructor(
		tui: { requestRender: () => void },
		onClose: () => void,
		onSave: (s: GameState | null) => void,
		saved?: GameState,
	) {
		this.tui = tui;
		this.onClose = onClose;
		this.onSave = onSave;
		this.st = (saved && !saved.gameOver) ? saved : createInitialState(saved?.highScore ?? 0);
		this.paused = !!(saved && !saved.gameOver);
		if (!this.paused) this._timer();
	}

	private _timer(): void {
		if (this.iv) clearInterval(this.iv);
		this.iv = setInterval(() => {
			if (!this.st.gameOver && !this.paused) { this._tick(); this.version++; this.tui.requestRender(); }
		}, getSpeed(this.st.level));
	}

	private _tick(): void {
		const cur = this.st.current;
		if (!cur) return;
		const m = tryMove(this.st.board, cur, 0, 1);	// try to get down by one grid
		if (m) { this.st.current = m; return; }		// if tryMove return the new piece,the tick ends
		this.st.board = lockPiece(this.st.board, cur);		// if tryMove failed,meaning the piece touch the bottom,lock it 
		const { board, linesCleared } = clearLines(this.st.board);	// check if any lines shall be cleaned
		this.st.board = board;
		// upgrade the statics of game state
		if (linesCleared > 0) {
			this.st.score += calculateScore(linesCleared, this.st.level);
			this.st.lines += linesCleared;
			this.st.level = calculateLevel(this.st.lines);
			if (this.st.score > this.st.highScore) this.st.highScore = this.st.score;
			this._timer();	// reload the timer to match the possibly new speed
		}
		const next = this.st.next;
		this.st.next = randomPiece();
		if (isGameOver(this.st.board, next)) { this.st.gameOver = true; this.st.current = null; }
		else { this.st.current = createPiece(next); }
	}

	private _tryMove(dx: number, dy: number): void {
		const cur = this.st.current;
		if (!cur || this.st.gameOver) return;
		const m = tryMove(this.st.board, cur, dx, dy);
		if (m) { this.st.current = m; this.version++; this.tui.requestRender(); }
	}

	private _softDrop(): void {
		const cur = this.st.current;
		if (!cur || this.st.gameOver) return;
		const m = tryMove(this.st.board, cur, 0, 1);
		if (m) { this.st.current = m; this.st.score += 1; this.version++; this.tui.requestRender(); }
	}

	private _hardDrop(): void {
		const cur = this.st.current;
		if (!cur || this.st.gameOver) return;
		const d = hardDrop(this.st.board, cur);
		this.st.score += (d.pos.y - cur.pos.y) * 2;
		this.st.current = d;
		this._tick();
		this.version++;
		this.tui.requestRender();
	}

	private _rotate(): void {
		const cur = this.st.current;
		if (!cur || this.st.gameOver) return;
		const r = tryRotate(this.st.board, cur);
		if (r) { this.st.current = r; this.version++; this.tui.requestRender(); }
	}

	private _restart(): void {
		this.st = createInitialState(this.st.highScore);
		this.paused = false;
		this._timer();
		this.onSave(null);
		this.version++;
		this.tui.requestRender();
	}

	// ---------- Input ----------

	handleInput(data: string): void {
		if (this.paused) {
			if (matchesKey(data, "escape")) { this.paused = false; this._timer(); this.version++; this.tui.requestRender(); }
			else if (data === "q" || data === "Q") { this.dispose(); this.onSave(this.st); this.onClose(); }
			return;
		}
		if (data === "r" || data === "R") { this._restart(); return; }
		if (matchesKey(data, "escape")) { this.paused = true; if (this.iv) { clearInterval(this.iv); this.iv = null; } this.version++; this.tui.requestRender(); return; }
		if (data === "q" || data === "Q") { this.dispose(); this.onSave(null); this.onClose(); return; }

		if (matchesKey(data, "left") || data === "a" || data === "A") this._tryMove(-1, 0);
		else if (matchesKey(data, "right") || data === "d" || data === "D") this._tryMove(1, 0);
		else if (matchesKey(data, "down") || data === "s" || data === "S") this._softDrop();
		else if (matchesKey(data, "up") || data === "w" || data === "W") this._rotate();
		else if (data === " ") this._hardDrop();
	}

	invalidate(): void { this.cache.ver = -1; }

	// ---------- Render ----------

	render(width: number): string[] {
		if (width === this.cache.width && this.cache.ver === this.version) return this.cache.lines;

		const board = this._renderBoard();
		const side = this._buildSidebar().render(SIDEBAR_W);
		const lp = Math.max(0, Math.floor((width - TOTAL_W) / 2));
		const pad = (s: string) => " ".repeat(lp) + s;

		const lines: string[] = [];
		lines.push(pad(dim(`╭${"─".repeat(BOARD_PX)}╮`)));
		const n = Math.max(board.length, side.length);
		for (let r = 0; r < n; r++)
			lines.push(pad((board[r] ?? "") + " ".repeat(GAP) + (side[r] ?? "")));
		lines.push(pad(dim(`╰${"─".repeat(BOARD_PX)}╯`)));

		this.cache = { lines, width, ver: this.version };
		return lines;
	}

	private _renderBoard(): string[] {
		const vb: number[][] = [];
		for (let y = HIDDEN_ROWS; y < TOTAL_HEIGHT; y++) vb.push([...this.st.board[y]]);

		const cur = this.st.current;
		if (cur) {
			const ci = PIECE_COLOR_MAP[cur.def.name] ?? 1;
			for (const { x, y } of getPieceCells(cur))
				if (y >= HIDDEN_ROWS && y < TOTAL_HEIGHT) vb[y - HIDDEN_ROWS][x] = ci;
			const g = hardDrop(this.st.board, cur);
			if (g.pos.y !== cur.pos.y)
				for (const { x, y } of getPieceCells(g))
					if (y >= HIDDEN_ROWS && y < TOTAL_HEIGHT && vb[y - HIDDEN_ROWS][x] === 0) vb[y - HIDDEN_ROWS][x] = -1;
		}

		const out: string[] = [];
		for (let r = 0; r < BOARD_HEIGHT; r++) {
			let s = "";
			for (let c = 0; c < BOARD_WIDTH; c++) {
				const v = vb[r][c];
				s += v === -1 ? dim("░░") : v === 0 ? " ·" : (colorFns[v] ?? cyan)("██");
			}
			out.push(dim("│") + s + dim("│"));
		}
		return out;
	}

	private _buildSidebar(): Container {
		const sb = new Container();
		const add = (s: string) => sb.addChild(new Text(s, 0, 0));

		// Stats
		add(`  ${bold(cyan("TETRIS"))}`);
		add(`  Score ${bold(yellow(String(this.st.score)))}`);
		add(`  High  ${bold(yellow(String(this.st.highScore)))}`);
		add(`  Level ${bold(green(String(this.st.level + 1)))}`);
		add(`  Lines ${bold(magenta(String(this.st.lines)))}`);
		sb.addChild(new Spacer(1));

		// Next piece
		add(`  ${bold(dim("Next"))}`);
		sb.addChild(new Spacer(1));
		const shape = this.st.next.rotations[0];
		for (let r = 0; r < shape.length; r++) {
			let line = "   ";
			for (let c = 0; c < shape[r].length; c++)
				line += shape[r][c] ? _cell(this.st.next.name) : "  ";
			add(line);
		}
		sb.addChild(new Spacer(1));

		// Controls
		add(`  ${bold(dim("Controls"))}`);
		
		if (this.paused) {
			add(`  ${yellow(bold("PAUSED"))}`);
			add(`    ${bold("ESC")} Resume`);
			add(`    ${bold("Q")}   Save & quit`);
		} else if (this.st.gameOver) {
			add(`  ${red(bold("GAME OVER"))}`);
			add(`    ${bold("Q")}   Quit`);
		} else {
			for (const [k, v] of [["← →", "Move"], ["↑", "Rotate"], ["↓", "Soft drop"], ["Spc", "Hard drop"], ["ESC", "Pause"], ["Q", "Quit"]] as const)
				add(`    ${bold(k)}  ${" ".repeat(Math.max(0, 4 - k.length))}${v}`);
		}
		add(`    ${bold("R")}     Restart`)
		return sb;
	}

	dispose(): void { if (this.iv) { clearInterval(this.iv); this.iv = null; } }
}

/** ANSI-colored cell for next-piece preview */
function _cell(name: string): string {
	const m: Record<string, string> = {
		I: `\x1b[36m██${R}`, O: `\x1b[93m██${R}`, T: `\x1b[35m██${R}`,
		S: `\x1b[32m██${R}`, Z: `\x1b[31m██${R}`, J: `\x1b[34m██${R}`, L: `\x1b[33m██${R}`,
	};
	return m[name] ?? "██";
}

// =============================================================================
// Extension registration
// =============================================================================

export default function (pi: ExtensionAPI) {
	pi.registerCommand("tetris", {
		description: "Play Tetris!",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") { ctx.ui.notify("Tetris requires interactive mode", "error"); return; }

			const entries = ctx.sessionManager.getEntries();
			let saved: GameState | undefined;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === SAVE) { saved = e.data as GameState; break; }
			}

			await ctx.ui.custom((tui, _theme, _kb, done) => {
				return new TetrisComponent(tui, () => done(undefined), (s) => pi.appendEntry(SAVE, s), saved);
			});
		},
	});
}
