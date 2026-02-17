
// ============================================================
//  AUDIO
// ============================================================

let audioCtx = null;
let soundsEnabled = true;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, duration, type = 'sine', vol = 0.08) {
    if (!soundsEnabled) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

const sounds = {
    move: () => {
        playTone(440, 0.08, 'sine', 0.06);
        setTimeout(() => playTone(520, 0.06, 'sine', 0.04), 30);
    },
    capture: () => {
        playTone(300, 0.12, 'triangle', 0.1);
        setTimeout(() => playTone(200, 0.08, 'triangle', 0.06), 40);
    },
    check: () => {
        playTone(660, 0.1, 'square', 0.05);
        setTimeout(() => playTone(880, 0.1, 'square', 0.04), 80);
    },
    castle: () => {
        playTone(350, 0.06, 'sine', 0.05);
        setTimeout(() => playTone(440, 0.06, 'sine', 0.05), 50);
        setTimeout(() => playTone(520, 0.06, 'sine', 0.05), 100);
    },
    promote: () => {
        playTone(523, 0.1, 'sine', 0.07);
        setTimeout(() => playTone(659, 0.1, 'sine', 0.07), 80);
        setTimeout(() => playTone(784, 0.15, 'sine', 0.07), 160);
    },
    win: () => {
        playTone(523, 0.12, 'sine', 0.08);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.08), 120);
        setTimeout(() => playTone(784, 0.12, 'sine', 0.08), 240);
        setTimeout(() => playTone(1047, 0.2, 'sine', 0.08), 360);
    },
    lose: () => {
        playTone(400, 0.15, 'triangle', 0.08);
        setTimeout(() => playTone(350, 0.15, 'triangle', 0.08), 150);
        setTimeout(() => playTone(300, 0.2, 'triangle', 0.08), 300);
    },
    draw: () => {
        playTone(440, 0.15, 'sine', 0.06);
        setTimeout(() => playTone(440, 0.15, 'sine', 0.06), 200);
    },
    select: () => {
        playTone(600, 0.04, 'sine', 0.04);
    },
    invalid: () => {
        playTone(200, 0.06, 'triangle', 0.04);
    }
};

// ============================================================
//  CHESS ENGINE + UI
// ============================================================

// Piece constants
const EMPTY = 0;
const W_PAWN = 1, W_KNIGHT = 2, W_BISHOP = 3, W_ROOK = 4, W_QUEEN = 5, W_KING = 6;
const B_PAWN = 7, B_KNIGHT = 8, B_BISHOP = 9, B_ROOK = 10, B_QUEEN = 11, B_KING = 12;

const PIECE_CHARS = {
    [W_PAWN]: '♙', [W_KNIGHT]: '♘', [W_BISHOP]: '♗', [W_ROOK]: '♖', [W_QUEEN]: '♕', [W_KING]: '♔',
    [B_PAWN]: '♟', [B_KNIGHT]: '♞', [B_BISHOP]: '♝', [B_ROOK]: '♜', [B_QUEEN]: '♛', [B_KING]: '♚'
};

const PIECE_VALUES = {
    [W_PAWN]: 100, [W_KNIGHT]: 320, [W_BISHOP]: 330, [W_ROOK]: 500, [W_QUEEN]: 900, [W_KING]: 20000,
    [B_PAWN]: 100, [B_KNIGHT]: 320, [B_BISHOP]: 330, [B_ROOK]: 500, [B_QUEEN]: 900, [B_KING]: 20000
};

const PIECE_NAMES = {
    [W_KNIGHT]: 'C', [W_BISHOP]: 'A', [W_ROOK]: 'T', [W_QUEEN]: 'D', [W_KING]: 'R',
    [B_KNIGHT]: 'C', [B_BISHOP]: 'A', [B_ROOK]: 'T', [B_QUEEN]: 'D', [B_KING]: 'R'
};

function isWhite(p) { return p >= 1 && p <= 6; }
function isBlack(p) { return p >= 7 && p <= 12; }
function pieceColor(p) { return isWhite(p) ? 'w' : isBlack(p) ? 'b' : null; }
function isAlly(p, color) { return color === 'w' ? isWhite(p) : isBlack(p); }
function isEnemy(p, color) { return color === 'w' ? isBlack(p) : isWhite(p); }

// Piece-square tables for evaluation
const PST_PAWN = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
];

const PST_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
];

const PST_BISHOP = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5,  5,  5,  5,  5,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];

const PST_ROOK = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const PST_QUEEN = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
];

const PST_KING_MID = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
];

const PST = {
    [W_PAWN]: PST_PAWN, [W_KNIGHT]: PST_KNIGHT, [W_BISHOP]: PST_BISHOP,
    [W_ROOK]: PST_ROOK, [W_QUEEN]: PST_QUEEN, [W_KING]: PST_KING_MID
};

function getPST(piece, idx) {
    const base = piece <= 6 ? piece : piece - 6;
    const table = PST[base];
    if (!table) return 0;
    if (isWhite(piece)) return table[idx];
    // Mirror for black
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    return table[(7 - row) * 8 + col];
}

// ============================================================
//  GAME STATE
// ============================================================

let board = [];
let turn = 'w';
let castling = { wK: true, wQ: true, bK: true, bQ: true };
let enPassant = -1; // target square index
let selectedSquare = -1;
let validMoves = [];
let lastMove = null;
let moveHistory = [];
let stateHistory = [];
let capturedWhite = []; // pieces captured by white (black pieces)
let capturedBlack = []; // pieces captured by black (white pieces)
let aiDepth = 2;
let gameActive = true;
let aiThinking = false;

const FILES = 'abcdefgh';

function initBoard() {
    board = [
        B_ROOK, B_KNIGHT, B_BISHOP, B_QUEEN, B_KING, B_BISHOP, B_KNIGHT, B_ROOK,
        B_PAWN, B_PAWN,   B_PAWN,   B_PAWN,  B_PAWN, B_PAWN,   B_PAWN,   B_PAWN,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,
        W_PAWN, W_PAWN,   W_PAWN,   W_PAWN,  W_PAWN, W_PAWN,   W_PAWN,   W_PAWN,
        W_ROOK, W_KNIGHT, W_BISHOP, W_QUEEN, W_KING, W_BISHOP, W_KNIGHT, W_ROOK
    ];
    turn = 'w';
    castling = { wK: true, wQ: true, bK: true, bQ: true };
    enPassant = -1;
    selectedSquare = -1;
    validMoves = [];
    lastMove = null;
    moveHistory = [];
    stateHistory = [];
    capturedWhite = [];
    capturedBlack = [];
    gameActive = true;
    aiThinking = false;
}

function cloneState() {
    return {
        board: [...board],
        turn,
        castling: { ...castling },
        enPassant,
        lastMove: lastMove ? { ...lastMove } : null,
        capturedWhite: [...capturedWhite],
        capturedBlack: [...capturedBlack]
    };
}

function restoreState(s) {
    board = [...s.board];
    turn = s.turn;
    castling = { ...s.castling };
    enPassant = s.enPassant;
    lastMove = s.lastMove ? { ...s.lastMove } : null;
    capturedWhite = [...s.capturedWhite];
    capturedBlack = [...s.capturedBlack];
}

// ============================================================
//  MOVE GENERATION
// ============================================================

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function idx(r, c) { return r * 8 + c; }
function rowCol(i) { return [Math.floor(i / 8), i % 8]; }

function generateMoves(brd, color, cast, ep) {
    const moves = [];
    for (let i = 0; i < 64; i++) {
        const p = brd[i];
        if (!isAlly(p, color)) continue;
        const [r, c] = rowCol(i);
        const type = p <= 6 ? p : p - 6;

        if (type === 1) { // Pawn
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            // Forward
            const f1 = idx(r + dir, c);
            if (inBounds(r + dir, c) && brd[f1] === EMPTY) {
                moves.push({ from: i, to: f1 });
                // Double push
                if (r === startRow) {
                    const f2 = idx(r + 2 * dir, c);
                    if (brd[f2] === EMPTY) moves.push({ from: i, to: f2 });
                }
            }
            // Captures
            for (const dc of [-1, 1]) {
                const nr = r + dir, nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                const ti = idx(nr, nc);
                if (isEnemy(brd[ti], color) || ti === ep) {
                    moves.push({ from: i, to: ti });
                }
            }
        } else if (type === 2) { // Knight
            for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                const nr = r + dr, nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                if (!isAlly(brd[idx(nr, nc)], color)) moves.push({ from: i, to: idx(nr, nc) });
            }
        } else if (type === 3 || type === 4 || type === 5) { // Bishop, Rook, Queen
            const dirs = type === 3 ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                         type === 4 ? [[-1,0],[1,0],[0,-1],[0,1]] :
                         [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
            for (const [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                while (inBounds(nr, nc)) {
                    const ti = idx(nr, nc);
                    if (isAlly(brd[ti], color)) break;
                    moves.push({ from: i, to: ti });
                    if (isEnemy(brd[ti], color)) break;
                    nr += dr; nc += dc;
                }
            }
        } else if (type === 6) { // King
            for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                const nr = r + dr, nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                if (!isAlly(brd[idx(nr, nc)], color)) moves.push({ from: i, to: idx(nr, nc) });
            }
            // Castling
            if (color === 'w') {
                if (cast.wK && brd[61] === EMPTY && brd[62] === EMPTY && brd[63] === W_ROOK &&
                    !isAttacked(brd, 60, 'b') && !isAttacked(brd, 61, 'b') && !isAttacked(brd, 62, 'b')) {
                    moves.push({ from: 60, to: 62, castle: 'wK' });
                }
                if (cast.wQ && brd[59] === EMPTY && brd[58] === EMPTY && brd[57] === EMPTY && brd[56] === W_ROOK &&
                    !isAttacked(brd, 60, 'b') && !isAttacked(brd, 59, 'b') && !isAttacked(brd, 58, 'b')) {
                    moves.push({ from: 60, to: 58, castle: 'wQ' });
                }
            } else {
                if (cast.bK && brd[5] === EMPTY && brd[6] === EMPTY && brd[7] === B_ROOK &&
                    !isAttacked(brd, 4, 'w') && !isAttacked(brd, 5, 'w') && !isAttacked(brd, 6, 'w')) {
                    moves.push({ from: 4, to: 6, castle: 'bK' });
                }
                if (cast.bQ && brd[3] === EMPTY && brd[2] === EMPTY && brd[1] === EMPTY && brd[0] === B_ROOK &&
                    !isAttacked(brd, 4, 'w') && !isAttacked(brd, 3, 'w') && !isAttacked(brd, 2, 'w')) {
                    moves.push({ from: 4, to: 2, castle: 'bQ' });
                }
            }
        }
    }
    return moves;
}

function isAttacked(brd, square, byColor) {
    const [r, c] = rowCol(square);
    // Knight attacks
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = brd[idx(nr, nc)];
        const t = p <= 6 ? p : p - 6;
        if (t === 2 && pieceColor(p) === byColor) return true;
    }
    // Sliding attacks (bishop/rook/queen)
    const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of diagDirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
            const p = brd[idx(nr, nc)];
            if (p !== EMPTY) {
                const t = p <= 6 ? p : p - 6;
                if (pieceColor(p) === byColor && (t === 3 || t === 5)) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }
    for (const [dr, dc] of straightDirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
            const p = brd[idx(nr, nc)];
            if (p !== EMPTY) {
                const t = p <= 6 ? p : p - 6;
                if (pieceColor(p) === byColor && (t === 4 || t === 5)) return true;
                break;
            }
            nr += dr; nc += dc;
        }
    }
    // Pawn attacks
    const pDir = byColor === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) {
        const nr = r + pDir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = brd[idx(nr, nc)];
        const t = p <= 6 ? p : p - 6;
        if (t === 1 && pieceColor(p) === byColor) return true;
    }
    // King attacks
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const p = brd[idx(nr, nc)];
        const t = p <= 6 ? p : p - 6;
        if (t === 6 && pieceColor(p) === byColor) return true;
    }
    return false;
}

function findKing(brd, color) {
    const king = color === 'w' ? W_KING : B_KING;
    for (let i = 0; i < 64; i++) if (brd[i] === king) return i;
    return -1;
}

function inCheck(brd, color) {
    const ki = findKing(brd, color);
    if (ki === -1) return false;
    return isAttacked(brd, ki, color === 'w' ? 'b' : 'w');
}

function makeMove(brd, move, cast, ep) {
    const newBrd = [...brd];
    const newCast = { ...cast };
    let newEp = -1;
    let captured = brd[move.to];
    const piece = brd[move.from];
    const type = piece <= 6 ? piece : piece - 6;
    const color = pieceColor(piece);

    // En passant capture
    if (type === 1 && move.to === ep) {
        const epCapture = color === 'w' ? move.to + 8 : move.to - 8;
        captured = newBrd[epCapture];
        newBrd[epCapture] = EMPTY;
    }

    newBrd[move.to] = piece;
    newBrd[move.from] = EMPTY;

    // Double pawn push - set en passant
    if (type === 1 && Math.abs(move.to - move.from) === 16) {
        newEp = (move.from + move.to) / 2;
    }

    // Castling
    if (move.castle) {
        if (move.castle === 'wK') { newBrd[61] = W_ROOK; newBrd[63] = EMPTY; }
        if (move.castle === 'wQ') { newBrd[59] = W_ROOK; newBrd[56] = EMPTY; }
        if (move.castle === 'bK') { newBrd[5] = B_ROOK; newBrd[7] = EMPTY; }
        if (move.castle === 'bQ') { newBrd[3] = B_ROOK; newBrd[0] = EMPTY; }
    }

    // Update castling rights
    if (piece === W_KING) { newCast.wK = false; newCast.wQ = false; }
    if (piece === B_KING) { newCast.bK = false; newCast.bQ = false; }
    if (move.from === 56 || move.to === 56) newCast.wQ = false;
    if (move.from === 63 || move.to === 63) newCast.wK = false;
    if (move.from === 0 || move.to === 0) newCast.bQ = false;
    if (move.from === 7 || move.to === 7) newCast.bK = false;

    // Promotion
    if (move.promotion) {
        newBrd[move.to] = move.promotion;
    }

    return { board: newBrd, castling: newCast, enPassant: newEp, captured };
}

function getLegalMoves(brd, color, cast, ep) {
    const pseudo = generateMoves(brd, color, cast, ep);
    const legal = [];
    for (const move of pseudo) {
        const result = makeMove(brd, move, cast, ep);
        if (!inCheck(result.board, color)) {
            legal.push(move);
        }
    }
    return legal;
}

// ============================================================
//  AI - Minimax with Alpha-Beta
// ============================================================

function evaluate(brd) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
        const p = brd[i];
        if (p === EMPTY) continue;
        const val = PIECE_VALUES[p] + getPST(p, i);
        score += isWhite(p) ? val : -val;
    }
    return score;
}

function orderMoves(brd, moves) {
    return moves.sort((a, b) => {
        let sa = 0, sb = 0;
        if (brd[a.to] !== EMPTY) sa += PIECE_VALUES[brd[a.to]] || 0;
        if (brd[b.to] !== EMPTY) sb += PIECE_VALUES[brd[b.to]] || 0;
        if (a.promotion) sa += 800;
        if (b.promotion) sb += 800;
        return sb - sa;
    });
}

function minimax(brd, depth, alpha, beta, maximizing, cast, ep) {
    if (depth === 0) return evaluate(brd);

    const color = maximizing ? 'w' : 'b';
    const moves = getLegalMoves(brd, color, cast, ep);

    if (moves.length === 0) {
        if (inCheck(brd, color)) return maximizing ? -99999 + (aiDepth - depth) : 99999 - (aiDepth - depth);
        return 0; // Stalemate
    }

    orderMoves(brd, moves);

    if (maximizing) {
        let best = -Infinity;
        for (const move of moves) {
            // Handle pawn promotion in search
            if ((brd[move.from] === W_PAWN && Math.floor(move.to / 8) === 0) ||
                (brd[move.from] === B_PAWN && Math.floor(move.to / 8) === 7)) {
                const promoColor = pieceColor(brd[move.from]);
                const queen = promoColor === 'w' ? W_QUEEN : B_QUEEN;
                move.promotion = queen;
            }
            const result = makeMove(brd, move, cast, ep);
            const val = minimax(result.board, depth - 1, alpha, beta, false, result.castling, result.enPassant);
            best = Math.max(best, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const move of moves) {
            if ((brd[move.from] === W_PAWN && Math.floor(move.to / 8) === 0) ||
                (brd[move.from] === B_PAWN && Math.floor(move.to / 8) === 7)) {
                const promoColor = pieceColor(brd[move.from]);
                const queen = promoColor === 'w' ? W_QUEEN : B_QUEEN;
                move.promotion = queen;
            }
            const result = makeMove(brd, move, cast, ep);
            const val = minimax(result.board, depth - 1, alpha, beta, true, result.castling, result.enPassant);
            best = Math.min(best, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function aiBestMove() {
    const moves = getLegalMoves(board, 'b', castling, enPassant);
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestVal = Infinity;

    orderMoves(board, moves);

    for (const move of moves) {
        if (board[move.from] === B_PAWN && Math.floor(move.to / 8) === 7) {
            move.promotion = B_QUEEN;
        }
        const result = makeMove(board, move, castling, enPassant);
        const val = minimax(result.board, aiDepth - 1, -Infinity, Infinity, true, result.castling, result.enPassant);
        if (val < bestVal) {
            bestVal = val;
            bestMove = move;
        }
    }
    return bestMove;
}

// ============================================================
//  UI
// ============================================================

const boardEl = document.getElementById('board');
const statusText = document.getElementById('statusText');
const mobileStatusText = document.getElementById('mobileStatusText');
const moveListEl = document.getElementById('moveList');
const thinkingEl = document.getElementById('thinking');
const promoOverlay = document.getElementById('promoOverlay');
const promoChoices = document.getElementById('promoChoices');
const modalOverlay = document.getElementById('modalOverlay');
const capturedByWhiteEl = document.getElementById('capturedByWhite');
const capturedByBlackEl = document.getElementById('capturedByBlack');
const whiteScoreEl = document.getElementById('whiteScore');
const blackScoreEl = document.getElementById('blackScore');
const whiteIndicator = document.getElementById('whiteIndicator');
const blackIndicator = document.getElementById('blackIndicator');

function squareNotation(i) {
    const [r, c] = rowCol(i);
    return FILES[c] + (8 - r);
}

function renderBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 64; i++) {
        const [r, c] = rowCol(i);
        const sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.idx = i;

        if (i === selectedSquare) sq.classList.add('selected');
        if (lastMove && (i === lastMove.from || i === lastMove.to)) sq.classList.add('last-move');

        // Check highlight
        if (board[i] === W_KING && turn === 'w' && inCheck(board, 'w')) sq.classList.add('in-check');
        if (board[i] === B_KING && turn === 'b' && inCheck(board, 'b')) sq.classList.add('in-check');

        // Valid moves
        const vm = validMoves.find(m => m.to === i);
        if (vm) {
            if (board[i] !== EMPTY || (board[selectedSquare] <= 6 ? board[selectedSquare] : board[selectedSquare] - 6) === 1 && i === enPassant) {
                sq.classList.add('valid-capture');
            } else {
                sq.classList.add('valid-move');
            }
        }

        // Piece
        if (board[i] !== EMPTY) {
            const span = document.createElement('span');
            span.className = 'piece';
            span.textContent = PIECE_CHARS[board[i]];
            sq.appendChild(span);
            sq.classList.add(isWhite(board[i]) ? 'white-piece' : 'black-piece');
        }

        // Coordinates
        if (c === 0) {
            const rank = document.createElement('span');
            rank.className = 'coord-rank';
            rank.textContent = 8 - r;
            sq.appendChild(rank);
        }
        if (r === 7) {
            const file = document.createElement('span');
            file.className = 'coord-file';
            file.textContent = FILES[c];
            sq.appendChild(file);
        }

        // Unified click/touch handler
        let touchMoved = false;
        let handledByTouch = false;

        sq.addEventListener('touchstart', () => {
            touchMoved = false;
            handledByTouch = false;
        }, { passive: true });

        sq.addEventListener('touchmove', () => {
            touchMoved = true;
        }, { passive: true });

        sq.addEventListener('touchend', (e) => {
            if (!touchMoved) {
                handledByTouch = true;
                e.preventDefault();
                onSquareClick(i);
            }
        });

        sq.addEventListener('click', (e) => {
            if (handledByTouch) {
                handledByTouch = false;
                return;
            }
            onSquareClick(i);
        });

        boardEl.appendChild(sq);
    }

    updateCaptured();
    updateTurnIndicator();
}

function updateCaptured() {
    const order = [5, 4, 3, 2, 1]; // Q R B N P
    const sortCap = (arr) => [...arr].sort((a, b) => {
        const ta = a <= 6 ? a : a - 6;
        const tb = b <= 6 ? b : b - 6;
        return order.indexOf(tb) - order.indexOf(ta);
    });

    capturedByWhiteEl.textContent = sortCap(capturedWhite).map(p => PIECE_CHARS[p]).join('');
    capturedByBlackEl.textContent = sortCap(capturedBlack).map(p => PIECE_CHARS[p]).join('');

    const wScore = capturedWhite.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
    const bScore = capturedBlack.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
    const diff = wScore - bScore;
    whiteScoreEl.textContent = diff > 0 ? `+${Math.round(diff/100)}` : '';
    blackScoreEl.textContent = diff < 0 ? `+${Math.round(-diff/100)}` : '';
}

function updateTurnIndicator() {
    whiteIndicator.classList.toggle('active-turn', turn === 'w');
    blackIndicator.classList.toggle('active-turn', turn === 'b');
}

function setStatus(text, type) {
    statusText.textContent = text;
    statusText.className = 'status-text' + (type ? ' ' + type : '');
    mobileStatusText.textContent = text;
    mobileStatusText.className = 'status-text' + (type ? ' ' + type : '');
}

function addMoveNotation(move, piece, captured) {
    const pName = PIECE_NAMES[piece] || '';
    const dest = squareNotation(move.to);
    let notation = '';

    if (move.castle) {
        notation = move.castle.endsWith('K') ? 'O-O' : 'O-O-O';
    } else {
        notation = pName;
        if (captured) notation += 'x';
        notation += dest;
        if (move.promotion) notation += '=' + PIECE_NAMES[move.promotion];
    }

    // Check/checkmate
    const opp = turn === 'w' ? 'b' : 'w';
    if (inCheck(board, opp)) {
        const oppMoves = getLegalMoves(board, opp, castling, enPassant);
        notation += oppMoves.length === 0 ? '#' : '+';
    }

    moveHistory.push({ color: turn === 'b' ? 'w' : 'b', notation });
    renderMoveList();
}

function renderMoveList() {
    let html = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const num = Math.floor(i / 2) + 1;
        html += `<span class="move-number">${num}.</span>`;
        html += `<span class="move-white">${moveHistory[i].notation}</span>`;
        if (moveHistory[i + 1]) {
            html += `<span class="move-black">${moveHistory[i + 1].notation}</span>`;
        }
        html += ' ';
    }
    moveListEl.innerHTML = html;
    moveListEl.scrollTop = moveListEl.scrollHeight;
}

// ============================================================
//  INTERACTION
// ============================================================

function onSquareClick(i) {
    if (!gameActive || aiThinking) return;
    if (turn !== 'w') return;

    if (selectedSquare === -1) {
        if (board[i] !== EMPTY && isWhite(board[i])) {
            sounds.select();
            selectedSquare = i;
            validMoves = getLegalMoves(board, 'w', castling, enPassant).filter(m => m.from === i);
            renderBoard();
        }
    } else {
        const move = validMoves.find(m => m.to === i);
        if (move) {
            if (board[move.from] === W_PAWN && Math.floor(move.to / 8) === 0) {
                showPromotion(move);
                return;
            }
            executeMove(move);
        } else if (board[i] !== EMPTY && isWhite(board[i])) {
            sounds.select();
            selectedSquare = i;
            validMoves = getLegalMoves(board, 'w', castling, enPassant).filter(m => m.from === i);
            renderBoard();
        } else {
            selectedSquare = -1;
            validMoves = [];
            renderBoard();
        }
    }
}

function showPromotion(move) {
    promoOverlay.classList.add('visible');
    promoChoices.innerHTML = '';
    for (const piece of [W_QUEEN, W_ROOK, W_BISHOP, W_KNIGHT]) {
        const btn = document.createElement('div');
        btn.className = 'promo-piece';
        btn.textContent = PIECE_CHARS[piece];
        btn.addEventListener('click', () => {
            promoOverlay.classList.remove('visible');
            move.promotion = piece;
            executeMove(move);
        });
        promoChoices.appendChild(btn);
    }
}

function animateMove(from, to, piece, callback) {
    const squares = boardEl.querySelectorAll('.square');
    const fromSq = squares[from];
    const toSq = squares[to];
    if (!fromSq || !toSq) { callback(); return; }

    const fromRect = fromSq.getBoundingClientRect();
    const toRect = toSq.getBoundingClientRect();

    const ghost = document.createElement('span');
    ghost.className = 'piece-ghost ' + (isWhite(piece) ? 'white' : 'black');
    ghost.textContent = PIECE_CHARS[piece];
    ghost.style.fontSize = getComputedStyle(fromSq).fontSize;
    // Position fixed relative to viewport — avoids overflow:hidden clipping
    ghost.style.position = 'fixed';
    ghost.style.left = (fromRect.left + fromRect.width / 2) + 'px';
    ghost.style.top = (fromRect.top + fromRect.height / 2) + 'px';
    ghost.style.transform = 'translate(-50%, -50%)';

    // Hide original piece
    const origPiece = fromSq.querySelector('.piece');
    if (origPiece) origPiece.style.opacity = '0';
    // Also hide destination piece during animation (for captures)
    const destPiece = toSq.querySelector('.piece');
    if (destPiece) destPiece.style.opacity = '0';

    document.body.appendChild(ghost);

    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;

    // Double rAF ensures the browser has painted the ghost at its
    // initial position before we trigger the CSS transition
    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        ghost.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    });

    let done = false;
    function finish() {
        if (done) return;
        done = true;
        ghost.remove();
        callback();
    }

    ghost.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 600);
}

function playMoveSound(move, captured, promoed) {
    if (promoed) { sounds.promote(); return; }
    if (move.castle) { sounds.castle(); return; }
    if (captured && captured !== EMPTY) { sounds.capture(); return; }
    sounds.move();
}

function executeMove(move) {
    const piece = board[move.from];
    stateHistory.push(cloneState());

    animateMove(move.from, move.to, piece, () => {
        const result = makeMove(board, move, castling, enPassant);
        const captured = result.captured;

        board = result.board;
        castling = result.castling;
        enPassant = result.enPassant;

        if (captured && captured !== EMPTY) {
            if (isWhite(piece)) capturedWhite.push(captured);
            else capturedBlack.push(captured);
        }

        lastMove = { from: move.from, to: move.to };
        addMoveNotation(move, piece, captured && captured !== EMPTY);
        playMoveSound(move, captured, move.promotion);

        turn = turn === 'w' ? 'b' : 'w';
        selectedSquare = -1;
        validMoves = [];

        renderBoard();
        checkGameEnd();

        if (gameActive && turn === 'b') {
            aiTurn();
        }
    });
}

function aiTurn() {
    aiThinking = true;
    setStatus('Pensando...', '');
    thinkingEl.classList.add('visible');

    const thinkDelay = 700 + Math.random() * 600; // 700-1300ms
    setTimeout(() => {
        const move = aiBestMove();
        if (!move) {
            aiThinking = false;
            thinkingEl.classList.remove('visible');
            renderBoard();
            checkGameEnd();
            return;
        }

        const piece = board[move.from];

        // Render board first so AI piece is visible, then animate
        selectedSquare = -1;
        validMoves = [];
        renderBoard();

        // Wait for layout to complete before animating
        requestAnimationFrame(() => { requestAnimationFrame(() => {
        animateMove(move.from, move.to, piece, () => {
            stateHistory.push(cloneState());
            const result = makeMove(board, move, castling, enPassant);
            const captured = result.captured;

            board = result.board;
            castling = result.castling;
            enPassant = result.enPassant;

            if (captured && captured !== EMPTY) {
                capturedBlack.push(captured);
            }

            lastMove = { from: move.from, to: move.to };
            addMoveNotation(move, piece, captured && captured !== EMPTY);
            playMoveSound(move, captured, move.promotion);

            turn = 'w';
            aiThinking = false;
            thinkingEl.classList.remove('visible');
            renderBoard();
            checkGameEnd();

            if (gameActive) {
                setStatus('Tu turno (Blancas)', '');
            }
        });
        }); });
    }, thinkDelay);
}

function checkGameEnd() {
    const moves = getLegalMoves(board, turn, castling, enPassant);
    if (moves.length === 0) {
        gameActive = false;
        if (inCheck(board, turn)) {
            const icon = turn === 'w' ? '♚' : '♔';
            const msg = turn === 'w' ? '¡La máquina gana!' : '¡Has ganado!';
            setStatus(`Jaque mate - ${msg}`, 'win');
            showGameOver(icon, `Jaque Mate`, msg);
            setTimeout(() => turn === 'w' ? sounds.lose() : sounds.win(), 200);
        } else {
            setStatus('Tablas - Ahogado', '');
            showGameOver('🤝', 'Tablas', 'Ahogado - no hay movimientos legales');
            setTimeout(() => sounds.draw(), 200);
        }
        return;
    }

    if (inCheck(board, turn)) {
        setStatus(`¡Jaque! - ${turn === 'w' ? 'Tu turno' : 'Turno de la máquina'}`, 'check');
        setTimeout(() => sounds.check(), 100);
    }

    // Insufficient material check
    const pieces = board.filter(p => p !== EMPTY);
    if (pieces.length <= 3) {
        const nonKings = pieces.filter(p => { const t = p <= 6 ? p : p - 6; return t !== 6; });
        if (nonKings.length === 0 || (nonKings.length === 1 && [2, 3, 8, 9].includes(nonKings[0]))) {
            gameActive = false;
            setStatus('Tablas - Material insuficiente', '');
            showGameOver('🤝', 'Tablas', 'Material insuficiente para dar jaque mate');
            setTimeout(() => sounds.draw(), 200);
        }
    }
}

function showGameOver(icon, title, msg) {
    document.getElementById('modalIcon').textContent = icon;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMsg').textContent = msg;
    modalOverlay.classList.add('visible');
}

function undoMove() {
    if (stateHistory.length < 2 || aiThinking) return; // Undo both player and AI move
    stateHistory.pop(); // AI move
    const prev = stateHistory.pop(); // Player move
    restoreState(prev);
    moveHistory.splice(-2);
    renderMoveList();
    selectedSquare = -1;
    validMoves = [];
    gameActive = true;
    renderBoard();
    setStatus('Tu turno (Blancas)', '');
}

function newGame() {
    initBoard();
    moveListEl.innerHTML = '';
    renderBoard();
    setStatus('Tu turno (Blancas)', '');
    modalOverlay.classList.remove('visible');
    thinkingEl.classList.remove('visible');
}

// ============================================================
//  EVENT LISTENERS
// ============================================================

document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('undoBtn').addEventListener('click', undoMove);
document.getElementById('mobileUndoBtn').addEventListener('click', undoMove);
document.getElementById('mobileNewGame').addEventListener('click', newGame);
document.getElementById('modalNewGame').addEventListener('click', newGame);

// Sound toggle
function toggleSound() {
    soundsEnabled = !soundsEnabled;
    const icon = soundsEnabled ? '🔊' : '🔇';
    document.querySelectorAll('.btn-sound').forEach(b => {
        b.textContent = icon;
        b.classList.toggle('muted', !soundsEnabled);
    });
}
document.getElementById('soundBtn').addEventListener('click', toggleSound);
document.getElementById('mobileSoundBtn').addEventListener('click', toggleSound);

// Difficulty buttons (desktop + mobile sync)
function setDifficulty(depth) {
    aiDepth = depth;
    document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.depth === String(depth));
    });
    document.querySelectorAll('.mobile-diff-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.depth === String(depth));
    });
}

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(parseInt(btn.dataset.depth)));
});

document.querySelectorAll('.mobile-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(parseInt(btn.dataset.depth)));
});

// Init audio context on first user interaction
document.addEventListener('click', function initAudio() {
    getAudioCtx();
    document.removeEventListener('click', initAudio);
}, { once: true });
document.addEventListener('touchstart', function initAudioTouch() {
    getAudioCtx();
    document.removeEventListener('touchstart', initAudioTouch);
}, { once: true });

// Prevent context menu on board
boardEl.addEventListener('contextmenu', e => e.preventDefault());


// Sync side panel height with board area
function syncPanelHeight() {
    const boardArea = document.querySelector('.board-area');
    const sidePanel = document.querySelector('.side-panel');
    if (boardArea && sidePanel && window.innerWidth > 700) {
        sidePanel.style.maxHeight = boardArea.offsetHeight + 'px';
    } else if (sidePanel) {
        sidePanel.style.maxHeight = '';
    }
}

window.addEventListener('resize', syncPanelHeight);

// Start
newGame();
requestAnimationFrame(syncPanelHeight);
