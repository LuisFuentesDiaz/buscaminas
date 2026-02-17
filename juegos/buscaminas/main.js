// Configuración del juego
const difficulties = {
    easy: { rows: 8, cols: 6, mines: 13 },     
    medium: { rows: 10, cols: 8, mines: 23 }, 
    hard: { rows: 12, cols: 10, mines: 30 }     
};

let currentDifficulty = 'easy';
let config = difficulties[currentDifficulty];
let board = [];
let revealed = [];
let flagged = [];
let gameOver = false;
let gameWon = false;
let timer = 0;
let timerInterval = null;
let timerStarted = false;
let minesPlaced = false;  // minas se colocan tras el primer clic para que no pierda a la primera

// Sistema de sonidos
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundsEnabled = true;

// Función para crear tonos
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundsEnabled) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    // Envelope suave para evitar clicks
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Sonidos del juego - más suaves
const sounds = {
    click: () => playTone(600, 0.04, 'sine', 0.08),
    reveal: () => playTone(500, 0.06, 'sine', 0.06),
    flag: () => {
        playTone(800, 0.04, 'sine', 0.1);
        setTimeout(() => playTone(950, 0.04, 'sine', 0.08), 40);
    },
    unflag: () => playTone(550, 0.06, 'sine', 0.06),
    win: () => {
        playTone(523, 0.12, 'sine', 0.12); // Do
        setTimeout(() => playTone(659, 0.12, 'sine', 0.12), 120); // Mi
        setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 240); // Sol
    },
    lose: () => {
        playTone(300, 0.08, 'sine', 0.15);
        setTimeout(() => playTone(250, 0.12, 'sine', 0.12), 80);
        setTimeout(() => playTone(200, 0.2, 'sine', 0.1), 150);
    },
    cascade: (delay = 0) => {
        setTimeout(() => playTone(450 + Math.random() * 100, 0.02, 'sine', 0.04), delay);
    }
};

// Elementos DOM
const gameGrid = document.getElementById('gameGrid');
const minesCount = document.getElementById('minesCount');
const flagsCount = document.getElementById('flagsCount');
const timerDisplay = document.getElementById('timer');
const newGameBtn = document.getElementById('newGameBtn');
const gameModal = document.getElementById('gameModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalBtn = document.getElementById('modalBtn');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const soundBtn = document.getElementById('soundBtn');

// === Sistema de Records con IndexedDB ===
const recordsList = document.getElementById('recordsList');
const recordsTabs = document.querySelectorAll('.records-tab');
let currentRecordsView = 'easy';

// Abrir/crear base de datos IndexedDB
function openRecordsDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('BuscaminasRecords', 1);
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

// Guardar un nuevo record
async function saveRecord(difficulty, time) {
    try {
        const db = await openRecordsDB();
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        
        const record = {
            difficulty: difficulty,
            time: time,
            date: new Date().toISOString()
        };
        
        store.add(record);
        
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });

        // Limpiar: mantener solo los 10 mejores por dificultad
        await trimRecords(difficulty);
        
        db.close();
        renderRecords(currentRecordsView, time);
        renderMobileRecords(currentRecordsView, time);
    } catch (err) {
        console.error('Error guardando record:', err);
    }
}

// Mantener solo top 10 por dificultad
async function trimRecords(difficulty) {
    try {
        const db = await openRecordsDB();
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        const index = store.index('difficulty');
        
        const records = await new Promise((resolve, reject) => {
            const req = index.getAll(difficulty);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        
        // Ordenar por tiempo ascendente
        records.sort((a, b) => a.time - b.time);
        
        // Eliminar los que sobran del top 10
        if (records.length > 10) {
            const toDelete = records.slice(10);
            for (const rec of toDelete) {
                store.delete(rec.id);
            }
        }
        
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
        
        db.close();
    } catch (err) {
        console.error('Error limpiando records:', err);
    }
}

// Obtener los top 10 records de una dificultad
async function getRecords(difficulty) {
    try {
        const db = await openRecordsDB();
        const tx = db.transaction('records', 'readonly');
        const store = tx.objectStore('records');
        const index = store.index('difficulty');
        
        const records = await new Promise((resolve, reject) => {
            const req = index.getAll(difficulty);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        
        db.close();
        
        // Ordenar por tiempo ascendente y tomar top 10
        records.sort((a, b) => a.time - b.time);
        return records.slice(0, 10);
    } catch (err) {
        console.error('Error leyendo records:', err);
        return [];
    }
}

// Renderizar la lista de records
async function renderRecords(difficulty, highlightTime = null) {
    const records = await getRecords(difficulty);
    recordsList.innerHTML = '';
    
    if (records.length === 0) {
        recordsList.innerHTML = '<div class="record-empty">Sin records aún.<br>¡Gana una partida!</div>';
        return;
    }
    
    records.forEach((rec, i) => {
        const item = document.createElement('div');
        item.className = 'record-item';
        
        if (i === 0) item.classList.add('gold');
        else if (i === 1) item.classList.add('silver');
        else if (i === 2) item.classList.add('bronze');
        
        // Resaltar el record recién agregado
        if (highlightTime !== null && rec.time === highlightTime) {
            item.classList.add('record-new');
            highlightTime = null; // Solo resaltar el primero que coincida
        }
        
        const date = new Date(rec.date);
        const dateStr = date.toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: '2-digit' 
        });
        const timeStr = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', minute: '2-digit' 
        });
        
        item.innerHTML = `
            <div class="record-rank">${i + 1}</div>
            <div class="record-info">
                <div class="record-time">${rec.time}s</div>
                <div class="record-date">${dateStr} ${timeStr}</div>
            </div>
        `;
        
        recordsList.appendChild(item);
    });
}

// Tabs de dificultad en el panel de records
recordsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        recordsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentRecordsView = tab.dataset.recordsDiff;
        renderRecords(currentRecordsView);
    });
});

// Renderizar records iniciales
renderRecords(currentRecordsView);

// Toggle de sonido
soundBtn.addEventListener('click', () => {
    soundsEnabled = !soundsEnabled;
    soundBtn.textContent = soundsEnabled ? '🔊' : '🔇';
    soundBtn.classList.toggle('muted', !soundsEnabled);
    if (soundsEnabled) {
        sounds.click();
    }
});

// === MOBILE UI ELEMENTS ===
const mobileSoundBtn = document.getElementById('mobileSoundBtn');
const mobileRecordsBtn = document.getElementById('mobileRecordsBtn');
const mobileRecordsOverlay = document.getElementById('mobileRecordsOverlay');
const mobileRecordsClose = document.getElementById('mobileRecordsClose');
const mobileRecordsList = document.getElementById('mobileRecordsList');
const mobileRecordsTabs = document.querySelectorAll('.mobile-records-tab');
const mobileDiffCurrent = document.getElementById('mobileDiffCurrent');
const mobileDiffMenu = document.getElementById('mobileDiffMenu');
const mobileDiffOptions = document.querySelectorAll('.mobile-diff-option');

// Mobile sound toggle
const mobileSoundIcon = document.getElementById('mobileSoundIcon');
mobileSoundBtn.addEventListener('click', () => {
    soundsEnabled = !soundsEnabled;
    mobileSoundIcon.textContent = soundsEnabled ? '🔊' : '🔇';
    soundBtn.textContent = soundsEnabled ? '🔊' : '🔇';
    soundBtn.classList.toggle('muted', !soundsEnabled);
    mobileSoundBtn.style.opacity = soundsEnabled ? '1' : '0.5';
    if (soundsEnabled) {
        sounds.click();
    }
});

// Mobile records overlay
mobileRecordsBtn.addEventListener('click', () => {
    mobileRecordsOverlay.classList.add('show');
    renderMobileRecords(currentRecordsView);
});

mobileRecordsClose.addEventListener('click', () => {
    mobileRecordsOverlay.classList.remove('show');
});

mobileRecordsOverlay.addEventListener('click', (e) => {
    if (e.target === mobileRecordsOverlay) {
        mobileRecordsOverlay.classList.remove('show');
    }
});

// Mobile records tabs
mobileRecordsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        mobileRecordsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderMobileRecords(tab.dataset.recordsDiff);
    });
});

// Render records in mobile overlay
async function renderMobileRecords(difficulty, highlightTime = null) {
    const records = await getRecords(difficulty);
    mobileRecordsList.innerHTML = '';
    
    if (records.length === 0) {
        mobileRecordsList.innerHTML = '<div class="record-empty">Sin records aún.<br>¡Gana una partida!</div>';
        return;
    }
    
    records.forEach((rec, i) => {
        const item = document.createElement('div');
        item.className = 'record-item';
        
        if (i === 0) item.classList.add('gold');
        else if (i === 1) item.classList.add('silver');
        else if (i === 2) item.classList.add('bronze');
        
        if (highlightTime !== null && rec.time === highlightTime) {
            item.classList.add('record-new');
            highlightTime = null;
        }
        
        const date = new Date(rec.date);
        const dateStr = date.toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: '2-digit' 
        });
        const timeStr = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', minute: '2-digit' 
        });
        
        item.innerHTML = `
            <div class="record-rank">${i + 1}</div>
            <div class="record-info">
                <div class="record-time">${rec.time}s</div>
                <div class="record-date">${dateStr} ${timeStr}</div>
            </div>
        `;
        
        mobileRecordsList.appendChild(item);
    });
}

// Mobile difficulty dropdown
const diffLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };

mobileDiffCurrent.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileDiffMenu.classList.toggle('show');
    mobileDiffCurrent.classList.toggle('open');
});

mobileDiffOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        const diff = opt.dataset.difficulty;
        mobileDiffOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        mobileDiffCurrent.textContent = diffLabels[diff];
        mobileDiffMenu.classList.remove('show');
        mobileDiffCurrent.classList.remove('open');
        
        // Sync with main difficulty buttons
        currentDifficulty = diff;
        difficultyBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === diff));
        initGame();
        
        currentRecordsView = diff;
        recordsTabs.forEach(t => t.classList.toggle('active', t.dataset.recordsDiff === diff));
        renderRecords(currentRecordsView);
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    mobileDiffMenu.classList.remove('show');
    mobileDiffCurrent.classList.remove('open');
});

// Inicializar juego
function initGame() {
    config = difficulties[currentDifficulty];
    board = [];
    revealed = [];
    flagged = [];
    gameOver = false;
    gameWon = false;
    timer = 0;
    timerStarted = false;
    minesPlaced = false;
    
    clearInterval(timerInterval);
    timerDisplay.textContent = '0';
    
    createBoard();
    // No colocar minas aquí: se colocan en el primer clic para que esa celda (y vecinas) estén libres
    calculateNumbers();
    renderBoard();
    updateStats();
}

// Crear tablero vacío
function createBoard() {
    for (let r = 0; r < config.rows; r++) {
        board[r] = [];
        revealed[r] = [];
        flagged[r] = [];
        for (let c = 0; c < config.cols; c++) {
            board[r][c] = 0;
            revealed[r][c] = false;
            flagged[r][c] = false;
        }
    }
}

// Barajar array in situ (Fisher-Yates)
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// Colocar minas repartidas en 4 cuadrantes (partes iguales). excludeCells = celdas prohibidas (primer clic y vecinas).
function placeMines(excludeCells = []) {
    const excluded = new Set(excludeCells.map(([r, c]) => `${r},${c}`));
    const midR = Math.floor(config.rows / 2);
    const midC = Math.floor(config.cols / 2);
    const quadrants = [
        { r: [0, midR], c: [0, midC] },
        { r: [0, midR], c: [midC, config.cols] },
        { r: [midR, config.rows], c: [0, midC] },
        { r: [midR, config.rows], c: [midC, config.cols] }
    ];
    const cellsByQuad = quadrants.map(q => {
        const list = [];
        for (let r = q.r[0]; r < q.r[1]; r++) {
            for (let c = q.c[0]; c < q.c[1]; c++) {
                if (!excluded.has(`${r},${c}`)) list.push([r, c]);
            }
        }
        return list;
    });
    const total = config.mines;
    const base = Math.floor(total / 4);
    const remainder = total % 4;
    const perQuad = [base + (0 < remainder ? 1 : 0), base + (1 < remainder ? 1 : 0), base + (2 < remainder ? 1 : 0), base + (3 < remainder ? 1 : 0)];
    let overflow = 0;
    for (let q = 0; q < 4; q++) {
        const list = cellsByQuad[q];
        const need = perQuad[q];
        shuffle(list);
        const place = Math.min(need, list.length);
        for (let i = 0; i < place; i++) {
            const [r, c] = list[i];
            board[r][c] = -1;
        }
        overflow += need - place;
    }
    if (overflow > 0) {
        const allAvailable = [];
        for (let r = 0; r < config.rows; r++) {
            for (let c = 0; c < config.cols; c++) {
                if (board[r][c] !== -1 && !excluded.has(`${r},${c}`)) allAvailable.push([r, c]);
            }
        }
        shuffle(allAvailable);
        for (let i = 0; i < overflow && i < allAvailable.length; i++) {
            const [r, c] = allAvailable[i];
            board[r][c] = -1;
        }
    }
}

// Calcular números
function calculateNumbers() {
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (board[r][c] === -1) continue;
            
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                        if (board[nr][nc] === -1) count++;
                    }
                }
            }
            board[r][c] = count;
        }
    }
}

// Renderizar tablero
function renderBoard() {
    gameGrid.innerHTML = '';
    gameGrid.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    gameGrid.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
    
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const cell = document.createElement('button');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            if (revealed[r][c]) {
                cell.classList.add('revealed');
                if (board[r][c] === -1) {
                    cell.textContent = '💣';
                    cell.classList.add('mine');
                } else if (board[r][c] > 0) {
                    cell.textContent = board[r][c];
                    cell.classList.add(`number-${board[r][c]}`);
                }
            } else if (flagged[r][c]) {
                cell.textContent = '🚩';
                cell.classList.add('flagged');
            }
            
            cell.addEventListener('click', () => handleCellClick(r, c));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleRightClick(r, c);
            });
            
            // Sistema táctil: toque corto = revelar, mantener 1s = bandera
            let touchMoved = false;
            let longPressTimer = null;
            let longPressTriggered = false;
            
            cell.addEventListener('touchstart', (e) => {
                touchMoved = false;
                longPressTriggered = false;
                
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    
                    if (gameOver || gameWon) return;
                    if (revealed[r][c]) return;
                    
                    ensureTimerStarted();
                    
                    // Toggle bandera
                    flagged[r][c] = !flagged[r][c];
                    if (flagged[r][c]) {
                        sounds.flag();
                    } else {
                        sounds.unflag();
                    }
                    if (navigator.vibrate) navigator.vibrate(50);
                    updateStats();
                    renderBoard();
                }, 1000);
            }, { passive: true });
            
            cell.addEventListener('touchmove', () => {
                touchMoved = true;
                clearTimeout(longPressTimer);
            }, { passive: true });
            
            cell.addEventListener('touchend', (e) => {
                clearTimeout(longPressTimer);
                e.preventDefault();
                
                // Si se movió el dedo o ya se colocó bandera, no hacer nada
                if (touchMoved || longPressTriggered) return;
                
                // Toque corto: revelar celda
                if (gameOver || gameWon) return;
                if (revealed[r][c]) return;
                if (flagged[r][c]) return; // No revelar celdas con bandera
                
                ensureTimerStarted();
                handleCellClick(r, c);
            });
            
            cell.addEventListener('touchcancel', () => {
                clearTimeout(longPressTimer);
                touchMoved = false;
                longPressTriggered = false;
            });
            
            gameGrid.appendChild(cell);
        }
    }
}

// Iniciar timer en la primera interacción
function ensureTimerStarted() {
    if (!timerStarted) {
        timerStarted = true;
        startTimer();
    }
}

// Manejar clic en celda
function handleCellClick(r, c) {
    if (gameOver || gameWon) return;
    if (revealed[r][c]) return;
    
    ensureTimerStarted();
    
    if (flagged[r][c]) return;
    
    // Primer clic: colocar minas evitando esta celda y sus 8 vecinas para que nunca sea mina
    if (!minesPlaced) {
        const exclude = [[r, c]];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols && (nr !== r || nc !== c)) {
                    exclude.push([nr, nc]);
                }
            }
        }
        placeMines(exclude);
        calculateNumbers();
        minesPlaced = true;
    }
    
    if (board[r][c] === -1) {
        sounds.lose();
        gameOver = true;
        revealAllMines();
        showModal('💥 Game Over', 'Has pisado una mina');
        stopTimer();
        return;
    }
    
    sounds.click();
    revealCell(r, c);
    checkWin();
}

// Manejar clic derecho (toggle bandera)
function handleRightClick(r, c) {
    if (gameOver || gameWon) return;
    if (revealed[r][c]) return;
    
    ensureTimerStarted();
    
    flagged[r][c] = !flagged[r][c];
    if (flagged[r][c]) {
        sounds.flag();
    } else {
        sounds.unflag();
    }
    
    updateStats();
    renderBoard();
}

// Revelar celda
let revealCount = 0;
function revealCell(r, c) {
    if (r < 0 || r >= config.rows || c < 0 || c >= config.cols) return;
    if (revealed[r][c] || flagged[r][c]) return;
    
    revealed[r][c] = true;
    
    // Sonido de cascada con delay
    if (board[r][c] === 0) {
        sounds.cascade(revealCount * 10);
        revealCount++;
    } else {
        sounds.reveal();
        revealCount = 0;
    }
    
    if (board[r][c] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                revealCell(r + dr, c + dc);
            }
        }
    }
    
    renderBoard();
}

// Revelar todas las minas
function revealAllMines() {
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (board[r][c] === -1) {
                revealed[r][c] = true;
            }
        }
    }
    renderBoard();
}

// Comprobar victoria
function checkWin() {
    let cellsToReveal = config.rows * config.cols - config.mines;
    let revealedCount = 0;
    
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (revealed[r][c] && board[r][c] !== -1) {
                revealedCount++;
            }
        }
    }
    
    if (revealedCount === cellsToReveal) {
        gameWon = true;
        stopTimer();
        sounds.win();
        showModal('🎉 ¡Victoria!', `Has ganado en ${timer} segundos`);
        
        // Guardar record y actualizar vista
        saveRecord(currentDifficulty, timer);
        
        // Cambiar la tab de records a la dificultad actual
        currentRecordsView = currentDifficulty;
        recordsTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty);
        });
    }
}

// Actualizar estadísticas
function updateStats() {
    minesCount.textContent = config.mines;
    
    let flagCount = 0;
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (flagged[r][c]) flagCount++;
        }
    }
    flagsCount.textContent = flagCount;
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        timerDisplay.textContent = timer;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// Modal
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    gameModal.classList.add('show');
}

function hideModal() {
    gameModal.classList.remove('show');
}

// Event listeners
newGameBtn.addEventListener('click', initGame);
modalBtn.addEventListener('click', () => {
    hideModal();
    initGame();
});

difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.difficulty;
        initGame();
        
        // Sincronizar tab de records con dificultad seleccionada
        currentRecordsView = currentDifficulty;
        recordsTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.recordsDiff === currentDifficulty);
        });
        renderRecords(currentRecordsView);
        
        // Sincronizar dropdown móvil
        mobileDiffCurrent.textContent = diffLabels[currentDifficulty];
        mobileDiffOptions.forEach(o => o.classList.toggle('active', o.dataset.difficulty === currentDifficulty));
    });
});

// Iniciar juego
initGame();
    