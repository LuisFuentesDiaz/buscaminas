// Configuración del juego
const difficulties = {
    easy: { given: 45 },
    medium: { given: 36 },
    hard: { given: 27 }
};

const diffLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };

let currentDifficulty = 'easy';
let solution = [];   // solución completa 9x9
let puzzle = [];    // pista inicial (0 = vacío)
let userBoard = []; // estado actual (puzzle + lo que escribe el usuario)
let errors = 0;
let selectedCell = null;
let gameWon = false;
let timer = 0;
let timerInterval = null;
let timerStarted = false;

// Sonidos
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundsEnabled = true;

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundsEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

const sounds = {
    click: () => playTone(600, 0.04, 'sine', 0.08),
    place: () => playTone(500, 0.06, 'sine', 0.06),
    error: () => {
        playTone(300, 0.06, 'sine', 0.12);
        setTimeout(() => playTone(250, 0.08, 'sine', 0.1), 60);
    },
    win: () => {
        playTone(523, 0.12, 'sine', 0.12);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.12), 120);
        setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 240);
    }
};

// Elementos DOM
const sudokuGrid = document.getElementById('sudokuGrid');
const errorsCount = document.getElementById('errorsCount');
const timerDisplay = document.getElementById('timer');
const newGameBtn = document.getElementById('newGameBtn');
const soundBtn = document.getElementById('soundBtn');
const gameModal = document.getElementById('gameModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalBtn = document.getElementById('modalBtn');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const keyboardInput = document.getElementById('keyboardInput');
const recordsList = document.getElementById('recordsList');
const recordsTabs = document.querySelectorAll('.records-tab');
const mobileRecordsBtn = document.getElementById('mobileRecordsBtn');
const mobileRecordsOverlay = document.getElementById('mobileRecordsOverlay');
const mobileRecordsClose = document.getElementById('mobileRecordsClose');
const mobileRecordsList = document.getElementById('mobileRecordsList');
const mobileRecordsTabs = document.querySelectorAll('.mobile-records-tab');
const mobileDiffCurrent = document.getElementById('mobileDiffCurrent');
const mobileDiffMenu = document.getElementById('mobileDiffMenu');
const mobileDiffOptions = document.querySelectorAll('.mobile-diff-option');
const mobileSoundBtn = document.getElementById('mobileSoundBtn');
const mobileSoundIcon = document.getElementById('mobileSoundIcon');

let currentRecordsView = 'easy';

// --- Sudoku lógica ---

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getBoxStart(r, c) {
    return [Math.floor(r / 3) * 3, Math.floor(c / 3) * 3];
}

function canPlace(grid, r, c, num) {
    for (let i = 0; i < 9; i++) if (grid[r][i] === num) return false;
    for (let i = 0; i < 9; i++) if (grid[i][c] === num) return false;
    const [br, bc] = getBoxStart(r, c);
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (grid[br + i][bc + j] === num) return false;
    return true;
}

function solveGrid(grid) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (grid[r][c] !== 0) continue;
            const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            for (const num of nums) {
                if (canPlace(grid, r, c, num)) {
                    grid[r][c] = num;
                    if (solveGrid(grid)) return true;
                    grid[r][c] = 0;
                }
            }
            return false;
        }
    }
    return true;
}

function generateFullGrid() {
    const grid = Array(9).fill(null).map(() => Array(9).fill(0));
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < 9; i++) grid[0][i] = nums[i];
    solveGrid(grid);
    return grid;
}

function createPuzzle(difficulty) {
    const full = generateFullGrid();
    const given = difficulties[difficulty].given;
    const puzzle = full.map(row => row.slice());
    const indices = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) indices.push([r, c]);
    shuffle(indices);
    let removed = 0;
    const toRemove = 81 - given;
    for (const [r, c] of indices) {
        if (removed >= toRemove) break;
        const backup = puzzle[r][c];
        puzzle[r][c] = 0;
        removed++;
    }
    return { solution: full, puzzle };
}

function isCellGiven(r, c) {
    return puzzle[r][c] !== 0;
}

function isCellError(r, c) {
    if (userBoard[r][c] === 0) return false;
    return solution[r][c] !== userBoard[r][c];
}

function checkWin() {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (userBoard[r][c] !== solution[r][c]) return false;
    return true;
}

function setCell(r, c, num) {
    if (isCellGiven(r, c)) return;
    if (num === 0) {
        userBoard[r][c] = 0;
        renderBoard();
        return;
    }
    userBoard[r][c] = num;
    if (solution[r][c] !== num) {
        errors++;
        errorsCount.textContent = errors;
        sounds.error();
    } else {
        sounds.place();
    }
    renderBoard();
    if (checkWin()) {
        gameWon = true;
        stopTimer();
        sounds.win();
        showModal('¡Victoria!', `Completado en ${timer} segundos${errors > 0 ? ` (${errors} errores)` : ''}`);
        saveRecord(currentDifficulty, timer);
        currentRecordsView = currentDifficulty;
        recordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty));
        mobileRecordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty));
        renderRecords(currentRecordsView);
    }
}

function ensureTimerStarted() {
    if (!timerStarted) {
        timerStarted = true;
        startTimer();
    }
}

// --- Render ---

function renderBoard() {
    sudokuGrid.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            const val = userBoard[r][c];
            if (puzzle[r][c] !== 0) {
                cell.classList.add('given');
                cell.textContent = puzzle[r][c];
            } else {
                cell.classList.add('empty');
                cell.textContent = val !== 0 ? val : '';
                if (isCellError(r, c)) cell.classList.add('error');
                if (selectedCell && selectedCell.r === r && selectedCell.c === c) cell.classList.add('selected');
                cell.addEventListener('click', () => {
                    if (gameWon) return;
                    ensureTimerStarted();
                    selectedCell = { r, c };
                    renderBoard();
                    keyboardInput.focus();
                });
            }
            sudokuGrid.appendChild(cell);
        }
    }
}

// --- Inicialización ---

function initGame() {
    const { solution: sol, puzzle: puz } = createPuzzle(currentDifficulty);
    solution = sol;
    puzzle = puz;
    userBoard = puzzle.map(row => row.slice());
    errors = 0;
    selectedCell = null;
    gameWon = false;
    timer = 0;
    timerStarted = false;
    clearInterval(timerInterval);
    timerDisplay.textContent = '0';
    errorsCount.textContent = '0';
    if (keyboardInput) keyboardInput.blur();
    renderBoard();
    renderRecords(currentRecordsView);
}

// --- Teclado (físico y virtual en móvil) ---

function handleKeyInput(num) {
    if (!selectedCell || gameWon) return;
    setCell(selectedCell.r, selectedCell.c, num);
}

document.addEventListener('keydown', (e) => {
    if (!selectedCell || gameWon) return;
    const key = e.key;
    if (key >= '1' && key <= '9') {
        handleKeyInput(parseInt(key, 10));
        e.preventDefault();
    } else if (key === '0' || key === 'Backspace' || key === 'Delete') {
        handleKeyInput(0);
        e.preventDefault();
    }
});

keyboardInput.addEventListener('keydown', (e) => {
    if (!selectedCell || gameWon) return;
    const key = e.key;
    if (key >= '1' && key <= '9') {
        handleKeyInput(parseInt(key, 10));
        e.preventDefault();
        keyboardInput.value = '';
    } else if (key === '0' || key === 'Backspace' || key === 'Delete') {
        handleKeyInput(0);
        e.preventDefault();
        keyboardInput.value = '';
    }
});

keyboardInput.addEventListener('input', (e) => {
    if (!selectedCell || gameWon) return;
    const v = keyboardInput.value.replace(/\D/g, '');
    if (v.length >= 1) {
        const num = parseInt(v.slice(-1), 10);
        if (num >= 1 && num <= 9) handleKeyInput(num);
    }
    keyboardInput.value = '';
});

// --- Timer ---

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        timerDisplay.textContent = timer;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// --- Modal ---

function showModal(title, message) {
    if (keyboardInput) keyboardInput.blur();
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    gameModal.classList.add('show');
}

function hideModal() {
    gameModal.classList.remove('show');
}

modalBtn.addEventListener('click', () => {
    hideModal();
    initGame();
});

// --- Records IndexedDB ---

function openRecordsDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ZudokuRecords', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('records')) {
                const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
                store.createIndex('difficulty', 'difficulty', { unique: false });
                store.createIndex('time', 'time', { unique: false });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveRecord(difficulty, time) {
    try {
        const db = await openRecordsDB();
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        store.add({ difficulty, time, date: new Date().toISOString() });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        renderRecords(difficulty);
    } catch (e) { console.warn('Record no guardado', e); }
}

async function getRecords(difficulty) {
    try {
        const db = await openRecordsDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('records', 'readonly');
            const store = tx.objectStore('records');
            const index = store.index('difficulty');
            const req = index.getAll(difficulty);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (e) { return []; }
}

async function renderRecords(difficulty) {
    const records = await getRecords(difficulty);
    const sorted = records.slice().sort((a, b) => a.time - b.time).slice(0, 10);

    const fill = (container) => {
        if (!container) return;
        container.innerHTML = '';
        if (sorted.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'record-empty';
            empty.textContent = 'Aún no hay records';
            container.appendChild(empty);
            return;
        }
        sorted.forEach((rec, i) => {
            const item = document.createElement('div');
            item.className = 'record-item';
            if (i === 0) item.classList.add('gold');
            else if (i === 1) item.classList.add('silver');
            else if (i === 2) item.classList.add('bronze');
            item.innerHTML = `
                <span class="record-rank">${i + 1}</span>
                <div class="record-info">
                    <span class="record-time">${rec.time}s</span>
                    <span class="record-date">${new Date(rec.date).toLocaleDateString()}</span>
                </div>`;
            container.appendChild(item);
        });
    };

    fill(recordsList);
    fill(mobileRecordsList);
}

// --- Dificultad ---

difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.difficulty;
        currentRecordsView = currentDifficulty;
        recordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty));
        mobileRecordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty));
        mobileDiffCurrent.textContent = diffLabels[currentDifficulty];
        mobileDiffOptions.forEach(o => o.classList.toggle('active', o.dataset.difficulty === currentDifficulty));
        initGame();
        renderRecords(currentRecordsView);
    });
});

recordsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        recordsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentRecordsView = tab.dataset.recordsDiff;
        renderRecords(currentRecordsView);
    });
});

mobileRecordsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mobileRecordsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentRecordsView = tab.dataset.recordsDiff;
        renderRecords(currentRecordsView);
    });
});

// --- Sonido ---

function toggleSound() {
    soundsEnabled = !soundsEnabled;
    soundBtn.classList.toggle('muted', !soundsEnabled);
    mobileSoundBtn.classList.toggle('muted', !soundsEnabled);
    mobileSoundIcon.textContent = soundsEnabled ? '🔊' : '🔇';
    soundBtn.textContent = soundsEnabled ? '🔊' : '🔇';
}

soundBtn.addEventListener('click', () => { sounds.click(); toggleSound(); });
mobileSoundBtn.addEventListener('click', () => { sounds.click(); toggleSound(); });

// --- Records overlay móvil ---

mobileRecordsBtn.addEventListener('click', () => {
    mobileRecordsOverlay.classList.add('show');
    currentRecordsView = currentDifficulty;
    mobileRecordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentRecordsView));
    renderRecords(currentRecordsView);
});

mobileRecordsClose.addEventListener('click', () => mobileRecordsOverlay.classList.remove('show'));
mobileRecordsOverlay.addEventListener('click', (e) => { if (e.target === mobileRecordsOverlay) mobileRecordsOverlay.classList.remove('show'); });

// --- Dropdown dificultad móvil ---

mobileDiffCurrent.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileDiffMenu.classList.toggle('show');
    mobileDiffCurrent.classList.toggle('open', mobileDiffMenu.classList.contains('show'));
});

mobileDiffOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        currentDifficulty = opt.dataset.difficulty;
        mobileDiffCurrent.textContent = diffLabels[currentDifficulty];
        mobileDiffMenu.classList.remove('show');
        mobileDiffCurrent.classList.remove('open');
        difficultyBtns.forEach(b => { b.classList.toggle('active', b.dataset.difficulty === currentDifficulty); });
        currentRecordsView = currentDifficulty;
        recordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty));
        initGame();
        renderRecords(currentRecordsView);
    });
});

document.addEventListener('click', () => {
    mobileDiffMenu.classList.remove('show');
    mobileDiffCurrent.classList.remove('open');
});

// --- Nuevo juego ---

newGameBtn.addEventListener('click', initGame);

// Iniciar
initGame();
