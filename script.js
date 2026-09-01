/**
 * BRAINBOOST — Gamified Cognitive Training & Aptitude Learning Engine
 * Built with Vanilla JavaScript (HTML5 + CSS3)
 */

// ==========================================
// 1. GLOBAL STATE & CONSTANTS
// ==========================================

const STORAGE_KEY = 'brainboost_player_progress_v1';
const TOTAL_LEVELS_PER_GAME = 20;
const QUESTIONS_PER_LEVEL = 10;
const QUESTION_TIME_LIMIT = 60; // 60-second rule

// Definition of all 8 Games (5 Cognitive + 3 Aptitude)
const GAMES_REGISTRY = {
  // --- COGNITIVE GAMES ---
  'color-rush': {
    id: 'color-rush',
    category: 'cognitive',
    title: 'Color Rush',
    purpose: 'Inhibition & Attention Control',
    icon: '⚡',
    theme: 'cyan',
    desc: 'Select the displayed text color, overcoming the Stroop word interference effect.',
    skill: 'Attention'
  },
  'pattern-match': {
    id: 'pattern-match',
    category: 'cognitive',
    title: 'Pattern Match',
    purpose: 'Pattern Recognition & Deductions',
    icon: '🧩',
    theme: 'purple',
    desc: 'Identify missing elements in sequences of geometric symbols, numbers, and colors.',
    skill: 'Patterns'
  },
  'logic-escape': {
    id: 'logic-escape',
    category: 'cognitive',
    title: 'Logic Escape',
    purpose: 'Logical Thinking & Problem Solving',
    icon: '💡',
    theme: 'amber',
    desc: 'Solve inductive puzzles, sequence relationships, and symbolic odd-one-out challenges.',
    skill: 'Logic'
  },
  'mental-grid-map': {
    id: 'mental-grid-map',
    category: 'cognitive',
    title: 'Mental Grid Map',
    purpose: 'Spatial Working Memory',
    icon: '🗺️',
    theme: 'emerald',
    desc: 'Memorize hidden object locations across expanding grids and accurately reconstruct them.',
    skill: 'Memory'
  },
  'matrix-pattern-copy': {
    id: 'matrix-pattern-copy',
    category: 'cognitive',
    title: 'Matrix Pattern Copy',
    purpose: 'Visual Memory & Focus',
    icon: '🔲',
    theme: 'rose',
    desc: 'Memorize active matrix formations and recreate the exact digital pattern.',
    skill: 'Memory'
  },

  // --- APTITUDE ARENA GAMES ---
  'quantitative-aptitude': {
    id: 'quantitative-aptitude',
    category: 'aptitude',
    title: 'Quantitative Aptitude',
    purpose: 'Numerical & Mathematical Speed',
    icon: '📐',
    theme: 'cyan',
    desc: 'Percentages, Profit & Loss, Ratios, Speed & Distance, Algebra, and Probability.',
    skill: 'Quantitative'
  },
  'logical-reasoning': {
    id: 'logical-reasoning',
    category: 'aptitude',
    title: 'Logical Reasoning',
    purpose: 'Analytical & Structural Reasoning',
    icon: '🔍',
    theme: 'purple',
    desc: 'Series deduction, Blood relations, Coding-decoding, Directions, and Syllogisms.',
    skill: 'Logic'
  },
  'verbal-ability': {
    id: 'verbal-ability',
    category: 'aptitude',
    title: 'Verbal Ability',
    purpose: 'Language Mastery & Vocabulary',
    icon: '📖',
    theme: 'amber',
    desc: 'Synonyms, Antonyms, Grammar correction, Fill in the blanks, and Comprehension.',
    skill: 'Verbal'
  }
};

// Player State Structure
let playerState = {
  totalScore: 0,
  totalStars: 0,
  soundEnabled: true,
  games: {} // { [gameId]: { unlockedLevel: 1, completedLevels: { [levelNum]: { stars: 3, bestScore: 500 } } } }
};

// Active Gameplay Runtime Session
let currentSession = {
  gameId: null,
  level: 1,
  questionIndex: 0, // 0 to 9 (10 challenges)
  score: 0,
  correctCount: 0,
  streak: 0,
  maxStreak: 0,
  timerSeconds: QUESTION_TIME_LIMIT,
  timerInterval: null,
  challengeStartTime: 0,
  activeChallenge: null,
  isAnsweringBlocked: false,
  autoNextTimeout: null,
  currentLevelChallenges: [],
  gridPlayerSelections: []
};

// ==========================================
// 2. AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
    if (!playerState.soundEnabled) return;
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  playCorrect() {
    this.playTone(523.25, 'triangle', 0.1, 0.2); // C5
    setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.2), 80); // E5
    setTimeout(() => this.playTone(783.99, 'triangle', 0.22, 0.22), 160); // G5
  }

  playWrong() {
    this.playTone(280, 'sawtooth', 0.15, 0.25);
    setTimeout(() => this.playTone(220, 'sawtooth', 0.25, 0.25), 100);
  }

  playTick() {
    this.playTone(800, 'sine', 0.03, 0.05);
  }

  playWarning() {
    this.playTone(880, 'square', 0.06, 0.08);
  }

  playClick() {
    this.playTone(600, 'sine', 0.04, 0.08);
  }

  playVictory() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.25), i * 120);
    });
  }

  playDefeat() {
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.25, 0.2), i * 150);
    });
  }
}

const sounds = new SoundEngine();

// ==========================================
// 3. PERSISTENCE & LOCAL STORAGE
// ==========================================
function initDefaultPlayerState() {
  const state = {
    totalScore: 0,
    totalStars: 0,
    soundEnabled: true,
    games: {}
  };
  Object.keys(GAMES_REGISTRY).forEach((id) => {
    state.games[id] = {
      unlockedLevel: 1,
      completedLevels: {}
    };
  });
  return state;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      playerState = Object.assign(initDefaultPlayerState(), parsed);
      // Ensure all game keys exist
      Object.keys(GAMES_REGISTRY).forEach((id) => {
        if (!playerState.games[id]) {
          playerState.games[id] = { unlockedLevel: 1, completedLevels: {} };
        }
      });
    } else {
      playerState = initDefaultPlayerState();
    }
  } catch (e) {
    console.error('Failed to load progress from localStorage', e);
    playerState = initDefaultPlayerState();
  }
  recalcGlobalStats();
  updateHeaderStats();
}

function saveProgress() {
  try {
    recalcGlobalStats();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playerState));
    updateHeaderStats();
  } catch (e) {
    console.error('Failed to save progress to localStorage', e);
  }
}

function recalcGlobalStats() {
  let stars = 0;
  let score = 0;
  Object.keys(playerState.games).forEach((gid) => {
    const g = playerState.games[gid];
    if (g && g.completedLevels) {
      Object.keys(g.completedLevels).forEach((lvl) => {
        stars += g.completedLevels[lvl].stars || 0;
        score += g.completedLevels[lvl].bestScore || 0;
      });
    }
  });
  playerState.totalStars = stars;
  playerState.totalScore = score;
}

function updateHeaderStats() {
  const scoreEl = document.getElementById('header-total-score');
  const starsEl = document.getElementById('header-total-stars');
  const soundBtn = document.getElementById('sound-toggle-btn');

  if (scoreEl) scoreEl.textContent = playerState.totalScore.toLocaleString();
  if (starsEl) starsEl.textContent = playerState.totalStars;
  if (soundBtn) {
    soundBtn.innerHTML = playerState.soundEnabled ? '🔊' : '🔇';
    soundBtn.title = playerState.soundEnabled ? 'Mute Sounds' : 'Unmute Sounds';
  }
}

function resetAllData() {
  if (confirm('Are you sure you want to reset all your progress, scores, and stars? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    playerState = initDefaultPlayerState();
    saveProgress();
    showHome();
    alert('Progress reset successfully!');
  }
}

// ==========================================
// 4. NAVIGATION & VIEW SWITCHING
// ==========================================
function switchView(viewId) {
  // Clear any running game timers
  clearInterval(currentSession.timerInterval);
  clearTimeout(currentSession.autoNextTimeout);

  document.querySelectorAll('.view-container').forEach((el) => {
    el.classList.remove('active');
  });

  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update active navigation state
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.remove('active');
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
  switchView('view-home');
  renderHomeStats();
}

function showGames() {
  showCognitiveGames();
}

function showCognitiveGames() {
  switchView('view-cognitive');
  renderCognitiveCards();
}

function showAptitudeGames() {
  switchView('view-aptitude');
  renderAptitudeCards();
}

function showProgress() {
  switchView('view-progress');
  updateProgress();
}

// ==========================================
// 5. HOME & CATEGORY RENDERING
// ==========================================
function renderHomeStats() {
  let completedCount = 0;
  let totalPossibleLevels = Object.keys(GAMES_REGISTRY).length * TOTAL_LEVELS_PER_GAME;

  Object.keys(playerState.games).forEach((gid) => {
    const g = playerState.games[gid];
    if (g && g.completedLevels) {
      completedCount += Object.keys(g.completedLevels).length;
    }
  });

  const progressPercent = Math.min(100, Math.round((completedCount / totalPossibleLevels) * 100));

  const totalScoreEl = document.getElementById('home-score-val');
  const totalStarsEl = document.getElementById('home-stars-val');
  const completedLevelsEl = document.getElementById('home-levels-val');
  const progressPercentEl = document.getElementById('home-progress-val');
  const progressFillEl = document.getElementById('home-progress-fill');

  if (totalScoreEl) totalScoreEl.textContent = playerState.totalScore.toLocaleString();
  if (totalStarsEl) totalStarsEl.textContent = playerState.totalStars;
  if (completedLevelsEl) completedLevelsEl.textContent = `${completedCount} / ${totalPossibleLevels}`;
  if (progressPercentEl) progressPercentEl.textContent = `${progressPercent}%`;
  if (progressFillEl) progressFillEl.style.width = `${progressPercent}%`;
}

function renderCognitiveCards() {
  const container = document.getElementById('cognitive-games-grid');
  if (!container) return;

  const cognitiveKeys = Object.keys(GAMES_REGISTRY).filter((k) => GAMES_REGISTRY[k].category === 'cognitive');
  container.innerHTML = cognitiveKeys.map((key) => {
    const game = GAMES_REGISTRY[key];
    const gameData = playerState.games[key] || { unlockedLevel: 1, completedLevels: {} };
    const completedCount = Object.keys(gameData.completedLevels || {}).length;
    let earnedStars = 0;
    Object.values(gameData.completedLevels || {}).forEach((lvl) => {
      earnedStars += lvl.stars || 0;
    });

    return `
      <div class="game-card" id="card-${game.id}" onclick="showLevels('${game.id}')">
        <div class="game-card-top">
          <div class="game-icon-box icon-${game.theme}">
            <span>${game.icon}</span>
          </div>
          <div class="game-stars-badge">
            <span>⭐</span> <span>${earnedStars}</span>
          </div>
        </div>
        <div class="game-title">${game.title}</div>
        <div class="game-purpose">${game.purpose}</div>
        <div class="game-desc">${game.desc}</div>
        <div class="game-card-footer">
          <div class="game-level-info">Level ${gameData.unlockedLevel} / ${TOTAL_LEVELS_PER_GAME} Unlocked</div>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showLevels('${game.id}')">
            Play Game →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAptitudeCards() {
  const container = document.getElementById('aptitude-games-grid');
  if (!container) return;

  const aptitudeKeys = Object.keys(GAMES_REGISTRY).filter((k) => GAMES_REGISTRY[k].category === 'aptitude');
  container.innerHTML = aptitudeKeys.map((key) => {
    const game = GAMES_REGISTRY[key];
    const gameData = playerState.games[key] || { unlockedLevel: 1, completedLevels: {} };
    const completedCount = Object.keys(gameData.completedLevels || {}).length;
    let earnedStars = 0;
    Object.values(gameData.completedLevels || {}).forEach((lvl) => {
      earnedStars += lvl.stars || 0;
    });

    return `
      <div class="game-card" id="card-${game.id}" onclick="showLevels('${game.id}')">
        <div class="game-card-top">
          <div class="game-icon-box icon-${game.theme}">
            <span>${game.icon}</span>
          </div>
          <div class="game-stars-badge">
            <span>⭐</span> <span>${earnedStars}</span>
          </div>
        </div>
        <div class="game-title">${game.title}</div>
        <div class="game-purpose">${game.purpose}</div>
        <div class="game-desc">${game.desc}</div>
        <div class="game-card-footer">
          <div class="game-level-info">Level ${gameData.unlockedLevel} / ${TOTAL_LEVELS_PER_GAME} Unlocked</div>
          <button class="btn btn-purple btn-sm" onclick="event.stopPropagation(); showLevels('${game.id}')">
            Enter Arena →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 6. LEVEL MAP PROGRESSION PATH
// ==========================================
function showLevels(gameId) {
  const game = GAMES_REGISTRY[gameId];
  if (!game) return;

  sounds.playClick();
  switchView('view-level-map');

  const gameData = playerState.games[gameId] || { unlockedLevel: 1, completedLevels: {} };
  let totalStars = 0;
  Object.values(gameData.completedLevels || {}).forEach((l) => (totalStars += l.stars || 0));

  // Render Header
  const titleEl = document.getElementById('map-game-title');
  const catTagEl = document.getElementById('map-category-tag');
  const starsBadgeEl = document.getElementById('map-stars-badge');
  const backBtnEl = document.getElementById('map-back-btn');

  if (titleEl) titleEl.innerHTML = `${game.icon} ${game.title}`;
  if (catTagEl) catTagEl.textContent = game.category === 'cognitive' ? 'COGNITIVE TRAINING' : 'APTITUDE ARENA';
  if (starsBadgeEl) starsBadgeEl.innerHTML = `⭐ ${totalStars} Stars`;
  if (backBtnEl) {
    backBtnEl.onclick = () => {
      if (game.category === 'cognitive') showCognitiveGames();
      else showAptitudeGames();
    };
  }

  // Render Path Nodes
  const pathWrapper = document.getElementById('level-path-nodes');
  if (!pathWrapper) return;

  let nodesHtml = '';
  for (let lvl = 1; lvl <= TOTAL_LEVELS_PER_GAME; lvl++) {
    const isCompleted = !!(gameData.completedLevels && gameData.completedLevels[lvl]);
    const isUnlocked = lvl <= gameData.unlockedLevel;
    const completedInfo = isCompleted ? gameData.completedLevels[lvl] : null;

    let nodeClass = 'locked';
    let iconOrNum = '🔒';
    if (isCompleted) {
      nodeClass = 'completed';
      iconOrNum = lvl;
    } else if (isUnlocked) {
      nodeClass = 'unlocked';
      iconOrNum = lvl;
    }

    let starsDisplay = '';
    if (isCompleted && completedInfo) {
      const starCount = completedInfo.stars || 0;
      starsDisplay = '<div class="level-stars-bar">';
      for (let s = 1; s <= 3; s++) {
        starsDisplay += s <= starCount ? '⭐' : '☆';
      }
      starsDisplay += '</div>';
    }

    const difficultyLabel = getDifficultyLabel(lvl);
    const connectorClass = lvl < gameData.unlockedLevel ? 'unlocked' : '';
    const connectorHtml = lvl < TOTAL_LEVELS_PER_GAME ? `<div class="level-connector-line ${connectorClass}"></div>` : '';

    const scoreTag = isCompleted && completedInfo
      ? `<div class="level-score-tag">🏆 ${completedInfo.bestScore} pts</div>`
      : '';

    nodesHtml += `
      <div class="level-node-row">
        <div class="level-difficulty-tag">${difficultyLabel}</div>
        <div class="level-node ${nodeClass}" id="level-node-${lvl}" onclick="handleLevelClick('${gameId}', ${lvl}, ${isUnlocked})">
          <span>${iconOrNum}</span>
          ${starsDisplay}
        </div>
        ${scoreTag}
        ${connectorHtml}
      </div>
    `;
  }

  pathWrapper.innerHTML = nodesHtml;
}

function getDifficultyLabel(lvl) {
  if (lvl <= 2) return 'Easy';
  if (lvl <= 5) return 'Easy +';
  if (lvl <= 8) return 'Medium';
  if (lvl <= 12) return 'Medium +';
  if (lvl <= 16) return 'Hard';
  if (lvl <= 19) return 'Expert';
  return 'Genius 🔥';
}

function handleLevelClick(gameId, level, isUnlocked) {
  if (!isUnlocked) {
    sounds.playWrong();
    alert(`🔒 Level ${level} is locked! Clear Level ${level - 1} first to unlock it.`);
    return;
  }
  sounds.playClick();
  startGame(gameId, level);
}

// Quick Start from Home
function startBrainBoost() {
  // Find first unfinished cognitive game or aptitude game
  sounds.playClick();
  for (const gid of Object.keys(GAMES_REGISTRY)) {
    const g = playerState.games[gid];
    if (g && g.unlockedLevel <= TOTAL_LEVELS_PER_GAME) {
      startGame(gid, g.unlockedLevel);
      return;
    }
  }
  startGame('color-rush', 1);
}

// ==========================================
// 7. QUESTION & CHALLENGE GENERATORS
// ==========================================

// Helper: Shuffle array
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Helper: Random Integer in Range
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Pick Random item from array
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 1. COLOR RUSH GENERATOR (Stroop Effect)
 */
function generateColorRushChallenge(level) {
  const colorPool = [
    { name: 'RED', hex: '#ef4444' },
    { name: 'BLUE', hex: '#3b82f6' },
    { name: 'GREEN', hex: '#10b981' },
    { name: 'YELLOW', hex: '#eab308' },
    { name: 'PURPLE', hex: '#a855f7' },
    { name: 'ORANGE', hex: '#f97316' },
    { name: 'CYAN', hex: '#06b6d4' },
    { name: 'MAGENTA', hex: '#d946ef' }
  ];

  // Active pool increases with level
  const poolSize = Math.min(colorPool.length, 4 + Math.floor(level / 3));
  const activeColors = colorPool.slice(0, poolSize);

  // Pick ink color (the target answer) and word color (the distractor)
  const inkColorObj = randPick(activeColors);
  let wordColorObj = randPick(activeColors);

  // Ensure word and ink are different to create the Stroop interference
  while (wordColorObj.name === inkColorObj.name) {
    wordColorObj = randPick(activeColors);
  }

  // Create options (including target inkColorObj)
  const optionCount = level >= 8 ? 6 : (level >= 4 ? 5 : 4);
  const optionsSet = new Set([inkColorObj.name]);
  while (optionsSet.size < Math.min(optionCount, activeColors.length)) {
    optionsSet.add(randPick(activeColors).name);
  }

  const options = shuffleArray(Array.from(optionsSet));

  return {
    type: 'color-rush',
    instruction: 'FOLLOW THE COLOR, NOT THE WORD',
    displayWord: wordColorObj.name,
    displayColorHex: inkColorObj.hex,
    correctAnswer: inkColorObj.name,
    options: options,
    explanation: `The text is written in <strong>${inkColorObj.name}</strong> ink (ignoring the word "${wordColorObj.name}").`
  };
}

/**
 * 2. PATTERN MATCH GENERATOR (Geometric & Symbol Sequences)
 */
function generatePatternMatchChallenge(level) {
  const shapeSymbols = ['◆', '●', '▲', '★', '⬟', '◼', '✦', '⯁', '✚', '✖'];
  const mode = randInt(1, 4);

  let sequence = [];
  let answer = '';
  let options = [];
  let explanation = '';

  if (mode === 1) {
    // Repeating cycle: e.g. [A, B, C, A, B, ?] -> C
    const len = level >= 5 ? 3 : 2;
    const cycle = shuffleArray(shapeSymbols).slice(0, len);
    const full = [...cycle, ...cycle, ...cycle];
    const targetIdx = full.length - 1;
    answer = full[targetIdx];
    sequence = full.slice(0, targetIdx);
    sequence.push('?');
    explanation = `The sequence repeats the cycle [${cycle.join(', ')}]. The next symbol is <strong>${answer}</strong>.`;
  } else if (mode === 2) {
    // Alternating with fixed pivot: e.g. [★, A, ★, B, ★, ?] -> C
    const pivot = randPick(shapeSymbols);
    const subPool = shuffleArray(shapeSymbols.filter((s) => s !== pivot));
    const A = subPool[0];
    const B = subPool[1];
    const C = subPool[2];
    sequence = [pivot, A, pivot, B, pivot, '?'];
    answer = C;
    explanation = `The sequence alternates between ${pivot} and sequential unique shapes. Next is <strong>${answer}</strong>.`;
  } else if (mode === 3) {
    // Increasing repetition: [A, B, A, B, B, A, ?] -> B, B, B
    const pool = shuffleArray(shapeSymbols).slice(0, 2);
    sequence = [pool[0], pool[1], pool[0], pool[1], pool[1], pool[0], '?'];
    answer = pool[1];
    explanation = `The number of '${pool[1]}' symbols increases after every '${pool[0]}'. Next is <strong>${answer}</strong>.`;
  } else {
    // Number sequence with arithmetic/geometric rule
    const start = randInt(2, 8);
    const diff = randInt(2, 6) + Math.floor(level / 4);
    const isMult = level >= 6 && Math.random() > 0.5;
    const nums = isMult
      ? [start, start * 2, start * 4, start * 8, start * 16]
      : [start, start + diff, start + diff * 2, start + diff * 3, start + diff * 4];
    answer = String(nums[4]);
    sequence = [nums[0], nums[1], nums[2], nums[3], '?'];
    explanation = isMult
      ? `Each number is multiplied by 2. Thus, ${nums[3]} × 2 = <strong>${answer}</strong>.`
      : `The numbers increase by ${diff}. Thus, ${nums[3]} + ${diff} = <strong>${answer}</strong>.`;
  }

  // Generate 4 options
  const optionSet = new Set([answer]);
  if (shapeSymbols.includes(answer)) {
    while (optionSet.size < 4) {
      optionSet.add(randPick(shapeSymbols));
    }
  } else {
    const numAns = parseInt(answer, 10);
    while (optionSet.size < 4) {
      const delta = randPick([-4, -2, -1, 1, 2, 4, 6, 8]);
      if (delta !== 0 && numAns + delta > 0) {
        optionSet.add(String(numAns + delta));
      }
    }
  }

  options = shuffleArray(Array.from(optionSet));

  return {
    type: 'pattern-match',
    instruction: 'CHOOSE THE MISSING PATTERN SYMBOL',
    sequence: sequence,
    correctAnswer: answer,
    options: options,
    explanation: explanation
  };
}

/**
 * 3. LOGIC ESCAPE GENERATOR (Inductive Reasoning & Puzzles)
 */
function generateLogicEscapeChallenge(level) {
  const puzzleType = randInt(1, 5);
  let prompt = '';
  let answer = '';
  let explanation = '';
  let options = [];

  if (puzzleType === 1) {
    // Step arithmetic or square series
    if (level <= 4) {
      const step = randInt(3, 7);
      const start = randInt(1, 10);
      const a = start;
      const b = a + step;
      const c = b + step;
      const d = c + step;
      answer = String(d);
      prompt = `What number comes next in the sequence?<br><strong class="text-cyan">${a}, ${b}, ${c}, ?</strong>`;
      explanation = `The numbers increase by ${step} each time (${c} + ${step} = <strong>${answer}</strong>).`;
    } else {
      // Squares or cubes
      const base = randInt(2, 6);
      const s1 = base * base;
      const s2 = (base + 1) * (base + 1);
      const s3 = (base + 2) * (base + 2);
      const s4 = (base + 3) * (base + 3);
      answer = String(s4);
      prompt = `What number replaces the question mark?<br><strong class="text-cyan">${s1}, ${s2}, ${s3}, ?</strong>`;
      explanation = `These are consecutive squares: ${base}², ${base + 1}², ${base + 2}², so next is ${base + 3}² = <strong>${answer}</strong>.`;
    }
  } else if (puzzleType === 2) {
    // Word Analogy
    const analogies = [
      { a: 'Doctor', b: 'Hospital', c: 'Teacher', ans: 'School', exp: 'A doctor works in a hospital; a teacher works in a school.' },
      { a: 'Book', b: 'Author', c: 'Painting', ans: 'Artist', exp: 'An author creates a book; an artist creates a painting.' },
      { a: 'Bird', b: 'Fly', c: 'Fish', ans: 'Swim', exp: 'A bird navigates by flying; a fish navigates by swimming.' },
      { a: 'Sun', b: 'Day', c: 'Moon', ans: 'Night', exp: 'The Sun illuminates the day; the Moon shines during the night.' },
      { a: 'Engine', b: 'Car', c: 'Heart', ans: 'Human Body', exp: 'The engine powers a car; the heart powers the body.' },
      { a: 'Clock', b: 'Time', c: 'Thermometer', ans: 'Temperature', exp: 'A clock measures time; a thermometer measures temperature.' },
      { a: 'Pen', b: 'Write', c: 'Knife', ans: 'Cut', exp: 'A pen is used to write; a knife is used to cut.' }
    ];
    const pick = randPick(analogies);
    prompt = `Complete the logical analogy:<br><strong class="text-cyan">${pick.a} : ${pick.b} :: ${pick.c} : ?</strong>`;
    answer = pick.ans;
    explanation = pick.exp;

    const distractors = ['Desk', 'Canvas', 'Sky', 'Engine', 'Student', 'Water', 'Road', 'Scale', 'Paper'];
    const optSet = new Set([answer]);
    while (optSet.size < 4) {
      optSet.add(randPick(distractors));
    }
    options = shuffleArray(Array.from(optSet));
  } else if (puzzleType === 3) {
    // Odd one out
    const oddSets = [
      { list: ['Circle', 'Square', 'Triangle', 'Cube'], ans: 'Cube', exp: 'Cube is a 3D solid figure, while the others are 2D flat geometric shapes.' },
      { list: ['Copper', 'Iron', 'Silver', 'Plastic'], ans: 'Plastic', exp: 'Plastic is a non-metallic polymer, while copper, iron, and silver are metals.' },
      { list: ['Jupiter', 'Saturn', 'Moon', 'Mars'], ans: 'Moon', exp: 'Moon is a natural satellite, whereas Jupiter, Saturn, and Mars are planets.' },
      { list: ['27', '64', '125', '144'], ans: '144', exp: '144 is a square (12²), while 27 (3³), 64 (4³), and 125 (5³) are cubes.' },
      { list: ['Violin', 'Guitar', 'Cello', 'Flute'], ans: 'Flute', exp: 'Flute is a wind instrument, while violin, guitar, and cello are string instruments.' }
    ];
    const pick = randPick(oddSets);
    prompt = `Which item is the <strong>ODD ONE OUT</strong>?`;
    answer = pick.ans;
    explanation = pick.exp;
    options = shuffleArray([...pick.list]);
  } else {
    // Equation Balance Logic
    const aVal = randInt(4, 12);
    const bVal = randInt(2, 8);
    const cVal = aVal + bVal;
    prompt = `Solve the logical equation:<br><strong class="text-cyan">If ▲ = ${aVal} and ● = ${bVal}, then (▲ + ●) × 2 = ?</strong>`;
    answer = String(cVal * 2);
    explanation = `▲ + ● = ${aVal} + ${bVal} = ${cVal}. Then ${cVal} × 2 = <strong>${answer}</strong>.`;
  }

  // Ensure 4 options if not already built
  if (options.length < 4) {
    const numAns = parseInt(answer, 10);
    const optSet = new Set([answer]);
    if (!isNaN(numAns)) {
      while (optSet.size < 4) {
        const offset = randPick([-6, -4, -2, -1, 1, 2, 4, 6, 10]);
        if (numAns + offset > 0) optSet.add(String(numAns + offset));
      }
    } else {
      const words = ['Option A', 'Option B', 'Option C', 'Option D'];
      while (optSet.size < 4) optSet.add(randPick(words));
    }
    options = shuffleArray(Array.from(optSet));
  }

  return {
    type: 'logic-escape',
    instruction: 'SOLVE THE LOGICAL CHALLENGE',
    prompt: prompt,
    correctAnswer: answer,
    options: options,
    explanation: explanation
  };
}

/**
 * 4. MENTAL GRID MAP GENERATOR (Spatial Working Memory)
 */
function generateMentalGridChallenge(level) {
  // Grid size scales with level: 3x3 (L1-4), 4x4 (L5-10), 5x5 (L11-16), 6x6 (L17+)
  let gridSize = 3;
  if (level >= 17) gridSize = 6;
  else if (level >= 11) gridSize = 5;
  else if (level >= 5) gridSize = 4;

  const totalCells = gridSize * gridSize;
  const objectCount = Math.min(Math.floor(totalCells / 2), 3 + Math.floor(level / 3));
  const emojis = ['⭐', '🔑', '💎', '🍎', '🪙', '🚀', '🔮', '⚡', '👑', '🎯'];

  // Pick unique cell indices
  const allIndices = Array.from({ length: totalCells }, (_, i) => i);
  const targetIndices = shuffleArray(allIndices).slice(0, objectCount);

  const gridMap = {};
  targetIndices.forEach((idx) => {
    gridMap[idx] = randPick(emojis);
  });

  // Memorization time: 3.5s at early levels down to 1.8s at higher levels
  const previewTime = Math.max(1.8, 3.8 - (level * 0.1));

  return {
    type: 'mental-grid-map',
    instruction: 'MEMORIZE OBJECT POSITIONS',
    gridSize: gridSize,
    targetIndices: targetIndices,
    gridMap: gridMap,
    objectCount: objectCount,
    previewTime: previewTime,
    explanation: `Successfully recalled <strong>${objectCount}</strong> spatial object coordinates!`
  };
}

/**
 * 5. MATRIX PATTERN COPY GENERATOR (Visual Working Memory)
 */
function generateMatrixCopyChallenge(level) {
  let gridSize = 3;
  if (level >= 17) gridSize = 6;
  else if (level >= 11) gridSize = 5;
  else if (level >= 5) gridSize = 4;

  const totalCells = gridSize * gridSize;
  const activeCount = Math.min(totalCells - 2, 3 + Math.floor(level / 2.5));

  const allIndices = Array.from({ length: totalCells }, (_, i) => i);
  const targetIndices = shuffleArray(allIndices).slice(0, activeCount);

  const previewTime = Math.max(1.5, 3.5 - (level * 0.1));

  return {
    type: 'matrix-pattern-copy',
    instruction: 'MEMORIZE ACTIVE MATRIX TILES',
    gridSize: gridSize,
    targetIndices: targetIndices,
    activeCount: activeCount,
    previewTime: previewTime,
    explanation: `Successfully recreated the <strong>${activeCount}</strong> active matrix cells!`
  };
}

/**
 * 6. QUANTITATIVE APTITUDE GENERATOR
 */
function generateQuantitativeChallenge(level) {
  const topics = [
    'percentages',
    'profit-loss',
    'simple-interest',
    'average',
    'ratio',
    'speed-distance',
    'work-time',
    'probability'
  ];
  const topic = randPick(topics);
  let prompt = '';
  let answer = '';
  let explanation = '';

  if (topic === 'percentages') {
    const base = randPick([200, 400, 500, 600, 800, 1000, 1200, 1500]);
    const pct = randPick([10, 15, 20, 25, 30, 40, 50]);
    const val = (base * pct) / 100;
    prompt = `What is <strong>${pct}%</strong> of ₹<strong>${base}</strong>?`;
    answer = `₹${val}`;
    explanation = `${pct}% of ₹${base} = (${pct} / 100) × ${base} = <strong>₹${val}</strong>.`;
  } else if (topic === 'profit-loss') {
    const cp = randPick([200, 300, 400, 500, 800, 1000]);
    const discount = randPick([10, 20, 25, 30, 40]);
    const sp = cp - (cp * discount) / 100;
    prompt = `A jacket is priced at ₹<strong>${cp}</strong> with a <strong>${discount}%</strong> discount. What is the final selling price?`;
    answer = `₹${sp}`;
    explanation = `Discount = ${discount}% of ₹${cp} = ₹${(cp * discount) / 100}.<br>Selling Price = ₹${cp} - ₹${(cp * discount) / 100} = <strong>₹${sp}</strong>.`;
  } else if (topic === 'simple-interest') {
    const P = randPick([1000, 2000, 3000, 5000, 10000]);
    const R = randPick([5, 6, 8, 10, 12]);
    const T = randPick([2, 3, 4, 5]);
    const SI = (P * R * T) / 100;
    prompt = `Calculate the Simple Interest on Principal ₹<strong>${P}</strong> at <strong>${R}%</strong> per annum for <strong>${T}</strong> years.`;
    answer = `₹${SI}`;
    explanation = `Simple Interest (SI) = (P × R × T) / 100 = (${P} × ${R} × ${T}) / 100 = <strong>₹${SI}</strong>.`;
  } else if (topic === 'average') {
    const count = 4;
    const a = randInt(20, 60);
    const b = randInt(20, 60);
    const c = randInt(20, 60);
    // adjust d so sum is divisible by 4
    const partial = a + b + c;
    const rem = partial % 4;
    const d = randInt(20, 50) + ((4 - rem) % 4);
    const avg = (a + b + c + d) / 4;
    prompt = `Find the average of the numbers: <strong>${a}, ${b}, ${c}, ${d}</strong>.`;
    answer = String(avg);
    explanation = `Sum = ${a} + ${b} + ${c} + ${d} = ${a + b + c + d}.<br>Average = ${a + b + c + d} / 4 = <strong>${avg}</strong>.`;
  } else if (topic === 'ratio') {
    const ratioA = randPick([2, 3, 4, 5]);
    const ratioB = randPick([3, 5, 7]);
    const multiplier = randPick([20, 30, 50, 100]);
    const total = (ratioA + ratioB) * multiplier;
    const shareA = ratioA * multiplier;
    prompt = `A total amount of ₹<strong>${total}</strong> is divided between Alice and Bob in the ratio <strong>${ratioA}:${ratioB}</strong>. What is Alice's share?`;
    answer = `₹${shareA}`;
    explanation = `Total parts = ${ratioA} + ${ratioB} = ${ratioA + ratioB}.<br>Value of 1 part = ₹${total} / ${ratioA + ratioB} = ₹${multiplier}.<br>Alice's share = ${ratioA} × ₹${multiplier} = <strong>₹${shareA}</strong>.`;
  } else if (topic === 'speed-distance') {
    const speed = randPick([40, 50, 60, 80, 90]);
    const time = randPick([2, 3, 4, 5]);
    const distance = speed * time;
    prompt = `A train travels at a speed of <strong>${speed} km/h</strong> for <strong>${time} hours</strong>. What total distance does it cover?`;
    answer = `${distance} km`;
    explanation = `Distance = Speed × Time = ${speed} km/h × ${time} h = <strong>${distance} km</strong>.`;
  } else if (topic === 'work-time') {
    const aDays = randPick([6, 10, 12, 15, 20]);
    const bDays = randPick([10, 12, 15, 20, 30]);
    // 1/A + 1/B = (A+B)/(A*B) => days = (A*B)/(A+B)
    const combined = (aDays * bDays) / (aDays + bDays);
    const rounded = Math.round(combined * 10) / 10;
    prompt = `If Person A can finish a project in <strong>${aDays} days</strong> and Person B can finish it in <strong>${bDays} days</strong>, in how many days can they complete it together?`;
    answer = `${rounded} days`;
    explanation = `Combined 1-day work = 1/${aDays} + 1/${bDays} = ${(aDays + bDays)}/${aDays * bDays}.<br>Total time = (${aDays} × ${bDays}) / (${aDays} + ${bDays}) = <strong>${rounded} days</strong>.`;
  } else {
    // Probability
    const red = randInt(3, 6);
    const blue = randInt(4, 7);
    const total = red + blue;
    prompt = `A bag contains <strong>${red} red balls</strong> and <strong>${blue} blue balls</strong>. What is the probability of drawing a red ball?`;
    answer = `${red}/${total}`;
    explanation = `Total balls = ${red} + ${blue} = ${total}.<br>Favorable outcomes (Red) = ${red}.<br>Probability = <strong>${red}/${total}</strong>.`;
  }

  // Generate 4 distinct options
  const optSet = new Set([answer]);
  const isCurrency = answer.startsWith('₹');
  const isKm = answer.endsWith(' km');
  const isDays = answer.endsWith(' days');

  if (isCurrency) {
    const rawVal = parseInt(answer.replace('₹', ''), 10);
    while (optSet.size < 4) {
      const offset = randPick([-150, -100, -50, 50, 100, 150, 200]);
      if (rawVal + offset > 0) optSet.add(`₹${rawVal + offset}`);
    }
  } else if (isKm) {
    const rawVal = parseInt(answer, 10);
    while (optSet.size < 4) {
      const offset = randPick([-60, -30, -20, 20, 30, 60]);
      if (rawVal + offset > 0) optSet.add(`${rawVal + offset} km`);
    }
  } else if (isDays) {
    const rawVal = parseFloat(answer);
    while (optSet.size < 4) {
      const offset = randPick([-3, -2, -1, 1, 2, 3]);
      if (rawVal + offset > 0) optSet.add(`${Math.round((rawVal + offset) * 10) / 10} days`);
    }
  } else {
    const num = parseInt(answer, 10);
    if (!isNaN(num)) {
      while (optSet.size < 4) {
        const offset = randPick([-8, -5, -3, 3, 5, 8, 12]);
        if (num + offset > 0) optSet.add(String(num + offset));
      }
    } else {
      // Fraction probability
      while (optSet.size < 4) {
        optSet.add(`${randInt(2, 6)}/${randInt(10, 18)}`);
      }
    }
  }

  const options = shuffleArray(Array.from(optSet));

  return {
    type: 'quantitative-aptitude',
    instruction: 'QUANTITATIVE APTITUDE',
    prompt: prompt,
    correctAnswer: answer,
    options: options,
    explanation: explanation
  };
}

/**
 * 7. LOGICAL REASONING GENERATOR
 */
function generateLogicalReasoningChallenge(level) {
  const bank = [
    {
      prompt: 'Find the next number in the series:<br><strong class="text-cyan">2, 6, 12, 20, 30, ?</strong>',
      ans: '42',
      exp: 'Differences increase by 2: (+4, +6, +8, +10, +12). 30 + 12 = <strong>42</strong>.',
      opts: ['38', '40', '42', '44']
    },
    {
      prompt: 'Find the next term in the letter series:<br><strong class="text-cyan">B, D, G, K, ?</strong>',
      ans: 'P',
      exp: 'Alphabet positions skip: +2 (D), +3 (G), +4 (K), +5 (P). Answer is <strong>P</strong>.',
      opts: ['N', 'O', 'P', 'Q']
    },
    {
      prompt: 'If <strong>CAT</strong> is coded as <strong>3120</strong> (C=3, A=1, T=20), how is <strong>DOG</strong> coded?',
      ans: '4157',
      exp: 'D=4, O=15, G=7. Concatenating yields <strong>4157</strong>.',
      opts: ['4157', '4147', '3157', '4158']
    },
    {
      prompt: 'Pointing to a photograph, John says: "She is the only daughter of my mother." Who is the person to John?',
      ans: 'Sister',
      exp: "The only daughter of John's mother is John's <strong>Sister</strong>.",
      opts: ['Sister', 'Mother', 'Cousin', 'Aunt']
    },
    {
      prompt: 'A person walks 10m North, turns Right and walks 10m, then turns Right again and walks 10m. In which direction is the person facing now?',
      ans: 'South',
      exp: 'Starting North -> 1st Right faces East -> 2nd Right faces <strong>South</strong>.',
      opts: ['East', 'West', 'North', 'South']
    },
    {
      prompt: 'In a class of 40 students, Rohan ranks 15th from the top. What is his rank from the bottom?',
      ans: '26th',
      exp: 'Bottom Rank = Total Students - Top Rank + 1 = 40 - 15 + 1 = <strong>26th</strong>.',
      opts: ['25th', '26th', '27th', '24th']
    },
    {
      prompt: 'Statements: All roses are flowers. Some flowers fade quickly.<br>Conclusion: Can we definitively deduce that some roses fade quickly?',
      ans: 'No / Cannot be determined',
      exp: 'Only "some flowers" fade; those might not include roses. So it cannot be definitively deduced.',
      opts: ['Yes / Definite', 'No / Cannot be determined', 'Only in winter', 'Always true']
    },
    {
      prompt: 'Find the missing number in the matrix pattern:<br><strong class="text-cyan">[3, 4, 25] ; [5, 12, 169] ; [6, 8, ?]</strong>',
      ans: '100',
      exp: 'Pythagorean sum of squares: 3² + 4² = 25; 5² + 12² = 169; 6² + 8² = 36 + 64 = <strong>100</strong>.',
      opts: ['96', '100', '104', '120']
    }
  ];

  const pick = randPick(bank);
  return {
    type: 'logical-reasoning',
    instruction: 'LOGICAL REASONING',
    prompt: pick.prompt,
    correctAnswer: pick.ans,
    options: shuffleArray([...pick.opts]),
    explanation: pick.exp
  };
}

/**
 * 8. VERBAL ABILITY GENERATOR
 */
function generateVerbalAbilityChallenge(level) {
  const bank = [
    {
      prompt: 'Choose the correct <strong>SYNONYM</strong> of the word: <br><strong class="text-cyan">CANDID</strong>',
      ans: 'Frank / Honest',
      exp: '"Candid" means truthful, straightforward, and frank in expression.',
      opts: ['Frank / Honest', 'Deceptive', 'Shy', 'Arrogant']
    },
    {
      prompt: 'Choose the correct <strong>ANTONYM</strong> of the word: <br><strong class="text-cyan">ABUNDANT</strong>',
      ans: 'Scarce',
      exp: '"Abundant" means existing in large quantities. Its direct opposite is <strong>Scarce</strong>.',
      opts: ['Scarce', 'Plentiful', 'Vast', 'Generous']
    },
    {
      prompt: 'Fill in the blank with the appropriate preposition:<br>"She has been living in London _____ 2018."',
      ans: 'since',
      exp: 'We use "since" with a specific point in time (2018) in perfect tenses.',
      opts: ['since', 'for', 'from', 'during']
    },
    {
      prompt: 'Identify the grammatically correct sentence:',
      ans: 'Neither of the candidates was selected.',
      exp: '"Neither" takes a singular verb ("was", not "were").',
      opts: [
        'Neither of the candidates was selected.',
        'Neither of the candidates were selected.',
        'Neither of candidate are selected.',
        'Neither of the candidate have been selected.'
      ]
    },
    {
      prompt: 'Choose the correct <strong>SYNONYM</strong> of: <br><strong class="text-cyan">METICULOUS</strong>',
      ans: 'Thorough & Precise',
      exp: '"Meticulous" means showing great attention to detail; very careful and precise.',
      opts: ['Thorough & Precise', 'Careless', 'Speedy', 'Stubborn']
    },
    {
      prompt: 'What is the meaning of the idiom: <br><strong class="text-cyan">"Bite the bullet"</strong>?',
      ans: 'To endure a painful situation with courage',
      exp: '"Bite the bullet" means accepting unavoidable hardship or difficulty bravely.',
      opts: [
        'To endure a painful situation with courage',
        'To eat quickly',
        'To start an argument',
        'To shoot a target'
      ]
    },
    {
      prompt: 'Choose the one-word substitute for: <br>"A person who loves books and reading"',
      ans: 'Bibliophile',
      exp: 'A <strong>Bibliophile</strong> is someone who has a great love for books.',
      opts: ['Bibliophile', 'Philanthropist', 'Polyglot', 'Auditor']
    },
    {
      prompt: 'Choose the correct <strong>ANTONYM</strong> of: <br><strong class="text-cyan">OBSOLETE</strong>',
      ans: 'Modern / Current',
      exp: '"Obsolete" means out of date or no longer used. The opposite is <strong>Modern</strong>.',
      opts: ['Modern / Current', 'Ancient', 'Broken', 'Hidden']
    }
  ];

  const pick = randPick(bank);
  return {
    type: 'verbal-ability',
    instruction: 'VERBAL ABILITY',
    prompt: pick.prompt,
    correctAnswer: pick.ans,
    options: shuffleArray([...pick.opts]),
    explanation: pick.exp
  };
}

/**
 * Master Challenge Generator Router
 */
function generateChallengeForGame(gameId, level) {
  switch (gameId) {
    case 'color-rush':
      return generateColorRushChallenge(level);
    case 'pattern-match':
      return generatePatternMatchChallenge(level);
    case 'logic-escape':
      return generateLogicEscapeChallenge(level);
    case 'mental-grid-map':
      return generateMentalGridChallenge(level);
    case 'matrix-pattern-copy':
      return generateMatrixCopyChallenge(level);
    case 'quantitative-aptitude':
      return generateQuantitativeChallenge(level);
    case 'logical-reasoning':
      return generateLogicalReasoningChallenge(level);
    case 'verbal-ability':
      return generateVerbalAbilityChallenge(level);
    default:
      return generateColorRushChallenge(level);
  }
}

// Generate EXACTLY 10 non-repeating challenges for a level
function generateLevelChallenges(gameId, level) {
  const challenges = [];
  for (let i = 0; i < QUESTIONS_PER_LEVEL; i++) {
    challenges.push(generateChallengeForGame(gameId, level));
  }
  return challenges;
}

// ==========================================
// 8. GAMEPLAY ENGINE & RUNTIME
// ==========================================

function startGame(gameId, level) {
  const game = GAMES_REGISTRY[gameId];
  if (!game) return;

  currentSession = {
    gameId: gameId,
    level: level,
    questionIndex: 0,
    score: 0,
    correctCount: 0,
    streak: 0,
    maxStreak: 0,
    timerSeconds: QUESTION_TIME_LIMIT,
    timerInterval: null,
    challengeStartTime: Date.now(),
    activeChallenge: null,
    isAnsweringBlocked: false,
    autoNextTimeout: null,
    currentLevelChallenges: generateLevelChallenges(gameId, level),
    gridPlayerSelections: []
  };

  switchView('view-game');
  updateGameHUD();
  startChallenge();
}

function updateGameHUD() {
  const game = GAMES_REGISTRY[currentSession.gameId];
  const nameEl = document.getElementById('hud-game-name');
  const levelEl = document.getElementById('hud-game-level');
  const qIndexEl = document.getElementById('hud-question-index');
  const qBarEl = document.getElementById('hud-progress-fill');
  const scoreValEl = document.getElementById('hud-live-score');
  const streakBoxEl = document.getElementById('hud-streak-box');

  if (nameEl) nameEl.textContent = game.title;
  if (levelEl) levelEl.textContent = `Level ${currentSession.level} • ${getDifficultyLabel(currentSession.level)}`;
  if (qIndexEl) qIndexEl.textContent = `Question ${currentSession.questionIndex + 1}/${QUESTIONS_PER_LEVEL}`;

  const pct = ((currentSession.questionIndex) / QUESTIONS_PER_LEVEL) * 100;
  if (qBarEl) qBarEl.style.width = `${pct}%`;
  if (scoreValEl) scoreValEl.textContent = currentSession.score;

  if (streakBoxEl) {
    if (currentSession.streak >= 2) {
      streakBoxEl.style.display = 'inline-flex';
      streakBoxEl.innerHTML = `🔥 ${currentSession.streak}x Streak!`;
    } else {
      streakBoxEl.style.display = 'none';
    }
  }
}

function startChallenge() {
  currentSession.isAnsweringBlocked = false;
  currentSession.timerSeconds = QUESTION_TIME_LIMIT;
  currentSession.challengeStartTime = Date.now();
  currentSession.gridPlayerSelections = [];

  const challenge = currentSession.currentLevelChallenges[currentSession.questionIndex];
  currentSession.activeChallenge = challenge;

  updateGameHUD();
  renderChallengeBody(challenge);
  startTimer();
}

function startTimer() {
  clearInterval(currentSession.timerInterval);
  const timerTextEl = document.getElementById('hud-timer-text');
  const timerBoxEl = document.getElementById('hud-timer-box');

  if (timerTextEl) timerTextEl.textContent = currentSession.timerSeconds;
  if (timerBoxEl) timerBoxEl.classList.remove('timer-warning');

  currentSession.timerInterval = setInterval(() => {
    currentSession.timerSeconds--;

    if (timerTextEl) timerTextEl.textContent = currentSession.timerSeconds;

    if (currentSession.timerSeconds <= 10 && currentSession.timerSeconds > 0) {
      if (timerBoxEl) timerBoxEl.classList.add('timer-warning');
      sounds.playWarning();
    } else {
      if (timerBoxEl) timerBoxEl.classList.remove('timer-warning');
    }

    if (currentSession.timerSeconds <= 0) {
      clearInterval(currentSession.timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function handleTimeOut() {
  if (currentSession.isAnsweringBlocked) return;
  currentSession.isAnsweringBlocked = true;
  sounds.playWrong();
  currentSession.streak = 0;

  showSolution(false, currentSession.activeChallenge.explanation, currentSession.activeChallenge.correctAnswer);

  // Auto-advance after 1.5s
  currentSession.autoNextTimeout = setTimeout(() => {
    nextChallenge();
  }, 1500);
}

// Render dynamic challenge bodies based on game type
function renderChallengeBody(ch) {
  const container = document.getElementById('challenge-content-area');
  if (!container) return;

  const letterBadges = ['A', 'B', 'C', 'D', 'E', 'F'];

  if (ch.type === 'color-rush') {
    container.innerHTML = `
      <div class="challenge-prompt-header">
        <div class="challenge-instruction">${ch.instruction}</div>
      </div>
      <div class="color-rush-display">
        <div class="color-rush-word" style="color: ${ch.displayColorHex}">
          ${ch.displayWord}
        </div>
      </div>
      <div class="options-grid" id="options-grid">
        ${ch.options.map((opt, idx) => `
          <button class="option-btn" onclick="checkAnswer('${opt}')">
            <span class="option-letter-badge">${letterBadges[idx] || idx + 1}</span>
            <span>${opt}</span>
          </button>
        `).join('')}
      </div>
      <div id="feedback-anchor"></div>
    `;
  } else if (ch.type === 'pattern-match') {
    container.innerHTML = `
      <div class="challenge-prompt-header">
        <div class="challenge-instruction">${ch.instruction}</div>
      </div>
      <div class="pattern-sequence-row">
        ${ch.sequence.map((item) => `
          <div class="pattern-item ${item === '?' ? 'target-mystery' : ''}">${item}</div>
        `).join('')}
      </div>
      <div class="options-grid" id="options-grid">
        ${ch.options.map((opt, idx) => `
          <button class="option-btn" onclick="checkAnswer('${opt}')">
            <span class="option-letter-badge">${letterBadges[idx] || idx + 1}</span>
            <span>${opt}</span>
          </button>
        `).join('')}
      </div>
      <div id="feedback-anchor"></div>
    `;
  } else if (ch.type === 'logic-escape' || ch.type === 'quantitative-aptitude' || ch.type === 'logical-reasoning' || ch.type === 'verbal-ability') {
    container.innerHTML = `
      <div class="challenge-prompt-header">
        <div class="challenge-instruction">${ch.instruction}</div>
        <div class="challenge-title-text">${ch.prompt}</div>
      </div>
      <div class="options-grid" id="options-grid">
        ${ch.options.map((opt, idx) => `
          <button class="option-btn" onclick="checkAnswer('${opt.replace(/'/g, "\\'")}')">
            <span class="option-letter-badge">${letterBadges[idx] || idx + 1}</span>
            <span>${opt}</span>
          </button>
        `).join('')}
      </div>
      <div id="feedback-anchor"></div>
    `;
  } else if (ch.type === 'mental-grid-map') {
    renderMentalGridPhase(ch, container);
  } else if (ch.type === 'matrix-pattern-copy') {
    renderMatrixCopyPhase(ch, container);
  }
}

// 4. Mental Grid Map UI (2-Phase Recall)
function renderMentalGridPhase(ch, container) {
  // Phase 1: Memorization
  let cellsHtml = '';
  const totalCells = ch.gridSize * ch.gridSize;

  for (let i = 0; i < totalCells; i++) {
    const hasObj = ch.gridMap[i];
    cellsHtml += `
      <div class="memory-cell ${hasObj ? 'reveal-active' : ''}" id="mcell-${i}">
        ${hasObj ? hasObj : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="memory-phase-banner">
      <div class="challenge-instruction">SPATIAL MEMORY</div>
      <div class="memory-phase-title" id="mem-phase-title">🧠 Memorize the ${ch.objectCount} Object Locations!</div>
      <div class="memory-countdown-bar-wrap">
        <div class="memory-countdown-bar-fill" id="mem-timer-fill" style="width: 100%;"></div>
      </div>
    </div>
    <div class="memory-grid-stage">
      <div class="memory-grid" style="grid-template-columns: repeat(${ch.gridSize}, 1fr);">
        ${cellsHtml}
      </div>
    </div>
    <div id="feedback-anchor"></div>
  `;

  // Pause general timer during memorization
  clearInterval(currentSession.timerInterval);

  let timeLeft = ch.previewTime;
  const interval = setInterval(() => {
    timeLeft -= 0.1;
    const fill = document.getElementById('mem-timer-fill');
    if (fill) {
      fill.style.width = `${Math.max(0, (timeLeft / ch.previewTime) * 100)}%`;
    }
    if (timeLeft <= 0) {
      clearInterval(interval);
      startMentalGridRecall(ch);
    }
  }, 100);
}

function startMentalGridRecall(ch) {
  startTimer();
  const phaseTitle = document.getElementById('mem-phase-title');
  if (phaseTitle) {
    phaseTitle.innerHTML = `👉 Click the <strong>${ch.objectCount}</strong> cells where objects were! (<span id="grid-found-count">0</span>/${ch.objectCount})`;
  }

  // Clear all cells
  const totalCells = ch.gridSize * ch.gridSize;
  for (let i = 0; i < totalCells; i++) {
    const el = document.getElementById(`mcell-${i}`);
    if (el) {
      el.className = 'memory-cell';
      el.innerHTML = '';
      el.onclick = () => handleMentalGridClick(i, ch);
    }
  }
}

function handleMentalGridClick(cellIdx, ch) {
  if (currentSession.isAnsweringBlocked) return;
  const cellEl = document.getElementById(`mcell-${cellIdx}`);
  if (!cellEl) return;

  if (currentSession.gridPlayerSelections.includes(cellIdx)) {
    // Unselect
    currentSession.gridPlayerSelections = currentSession.gridPlayerSelections.filter((x) => x !== cellIdx);
    cellEl.classList.remove('selected');
    sounds.playClick();
  } else {
    // Select
    if (currentSession.gridPlayerSelections.length < ch.objectCount) {
      currentSession.gridPlayerSelections.push(cellIdx);
      cellEl.classList.add('selected');
      sounds.playClick();
    }
  }

  const counter = document.getElementById('grid-found-count');
  if (counter) counter.textContent = currentSession.gridPlayerSelections.length;

  // Auto-submit when required clicks reached
  if (currentSession.gridPlayerSelections.length === ch.objectCount) {
    verifyMentalGridAnswer(ch);
  }
}

function verifyMentalGridAnswer(ch) {
  clearInterval(currentSession.timerInterval);
  currentSession.isAnsweringBlocked = true;

  // Compare selections with targetIndices
  const correctSet = new Set(ch.targetIndices);
  let correctMatches = 0;

  currentSession.gridPlayerSelections.forEach((idx) => {
    const el = document.getElementById(`mcell-${idx}`);
    if (correctSet.has(idx)) {
      correctMatches++;
      if (el) {
        el.classList.add('correct-cell');
        el.innerHTML = ch.gridMap[idx] || '⭐';
      }
    } else {
      if (el) {
        el.classList.add('wrong-cell');
        el.innerHTML = '❌';
      }
    }
  });

  // Reveal missed correct cells
  ch.targetIndices.forEach((idx) => {
    if (!currentSession.gridPlayerSelections.includes(idx)) {
      const el = document.getElementById(`mcell-${idx}`);
      if (el) {
        el.classList.add('reveal-active');
        el.innerHTML = ch.gridMap[idx] || '⭐';
      }
    }
  });

  const isFullPass = correctMatches === ch.objectCount;
  if (isFullPass) {
    sounds.playCorrect();
    updateScore(calcPointsEarned());
    currentSession.correctCount++;
    currentSession.streak++;
  } else {
    sounds.playWrong();
    currentSession.streak = 0;
  }

  showSolution(
    isFullPass,
    `You accurately placed <strong>${correctMatches}/${ch.objectCount}</strong> coordinates.`,
    isFullPass ? 'Perfect Reconstruction' : 'Incomplete Match'
  );

  currentSession.autoNextTimeout = setTimeout(() => {
    nextChallenge();
  }, 1500);
}

// 5. Matrix Pattern Copy UI
function renderMatrixCopyPhase(ch, container) {
  let cellsHtml = '';
  const totalCells = ch.gridSize * ch.gridSize;

  for (let i = 0; i < totalCells; i++) {
    const isActive = ch.targetIndices.includes(i);
    cellsHtml += `
      <div class="memory-cell ${isActive ? 'reveal-active' : ''}" id="matrix-cell-${i}">
        ${isActive ? '■' : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="memory-phase-banner">
      <div class="challenge-instruction">MATRIX MEMORY</div>
      <div class="memory-phase-title" id="matrix-phase-title">👁️ Memorize the ${ch.activeCount} Active Matrix Cells!</div>
      <div class="memory-countdown-bar-wrap">
        <div class="memory-countdown-bar-fill" id="matrix-timer-fill" style="width: 100%;"></div>
      </div>
    </div>
    <div class="memory-grid-stage">
      <div class="memory-grid" style="grid-template-columns: repeat(${ch.gridSize}, 1fr);">
        ${cellsHtml}
      </div>
    </div>
    <div id="feedback-anchor"></div>
  `;

  clearInterval(currentSession.timerInterval);

  let timeLeft = ch.previewTime;
  const interval = setInterval(() => {
    timeLeft -= 0.1;
    const fill = document.getElementById('matrix-timer-fill');
    if (fill) fill.style.width = `${Math.max(0, (timeLeft / ch.previewTime) * 100)}%`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      startMatrixRecall(ch);
    }
  }, 100);
}

function startMatrixRecall(ch) {
  startTimer();
  const phaseTitle = document.getElementById('matrix-phase-title');
  if (phaseTitle) {
    phaseTitle.innerHTML = `👉 Recreate the exact pattern! (<span id="matrix-selected-count">0</span>/${ch.activeCount} filled)`;
  }

  const totalCells = ch.gridSize * ch.gridSize;
  for (let i = 0; i < totalCells; i++) {
    const el = document.getElementById(`matrix-cell-${i}`);
    if (el) {
      el.className = 'memory-cell';
      el.innerHTML = '';
      el.onclick = () => handleMatrixCellClick(i, ch);
    }
  }
}

function handleMatrixCellClick(cellIdx, ch) {
  if (currentSession.isAnsweringBlocked) return;
  const cellEl = document.getElementById(`matrix-cell-${cellIdx}`);
  if (!cellEl) return;

  if (currentSession.gridPlayerSelections.includes(cellIdx)) {
    currentSession.gridPlayerSelections = currentSession.gridPlayerSelections.filter((x) => x !== cellIdx);
    cellEl.classList.remove('selected');
    cellEl.innerHTML = '';
    sounds.playClick();
  } else {
    if (currentSession.gridPlayerSelections.length < ch.activeCount) {
      currentSession.gridPlayerSelections.push(cellIdx);
      cellEl.classList.add('selected');
      cellEl.innerHTML = '■';
      sounds.playClick();
    }
  }

  const counter = document.getElementById('matrix-selected-count');
  if (counter) counter.textContent = currentSession.gridPlayerSelections.length;

  if (currentSession.gridPlayerSelections.length === ch.activeCount) {
    verifyMatrixPattern(ch);
  }
}

function verifyMatrixPattern(ch) {
  clearInterval(currentSession.timerInterval);
  currentSession.isAnsweringBlocked = true;

  const targetSet = new Set(ch.targetIndices);
  let correctMatches = 0;

  currentSession.gridPlayerSelections.forEach((idx) => {
    const el = document.getElementById(`matrix-cell-${idx}`);
    if (targetSet.has(idx)) {
      correctMatches++;
      if (el) el.classList.add('correct-cell');
    } else {
      if (el) el.classList.add('wrong-cell');
    }
  });

  ch.targetIndices.forEach((idx) => {
    if (!currentSession.gridPlayerSelections.includes(idx)) {
      const el = document.getElementById(`matrix-cell-${idx}`);
      if (el) {
        el.classList.add('reveal-active');
        el.innerHTML = '■';
      }
    }
  });

  const isFullPass = correctMatches === ch.activeCount;
  if (isFullPass) {
    sounds.playCorrect();
    updateScore(calcPointsEarned());
    currentSession.correctCount++;
    currentSession.streak++;
  } else {
    sounds.playWrong();
    currentSession.streak = 0;
  }

  showSolution(
    isFullPass,
    `Matrix accuracy: <strong>${Math.round((correctMatches / ch.activeCount) * 100)}%</strong>.`,
    isFullPass ? 'Exact Pattern Match' : 'Mismatch Detected'
  );

  currentSession.autoNextTimeout = setTimeout(() => {
    nextChallenge();
  }, 1500);
}

// ==========================================
// 9. ANSWER CHECKING & FEEDBACK
// ==========================================

function checkAnswer(selectedOption) {
  if (currentSession.isAnsweringBlocked) return;
  currentSession.isAnsweringBlocked = true;
  clearInterval(currentSession.timerInterval);

  const ch = currentSession.activeChallenge;
  const isCorrect = String(selectedOption).trim() === String(ch.correctAnswer).trim();

  // Highlight option buttons
  document.querySelectorAll('.option-btn').forEach((btn) => {
    const text = btn.textContent.trim();
    // Disable all options
    btn.disabled = true;

    // If matches correct answer
    if (text.includes(String(ch.correctAnswer).trim())) {
      btn.classList.add('btn-correct');
    }
    // If clicked and wrong
    if (text.includes(String(selectedOption).trim()) && !isCorrect) {
      btn.classList.add('btn-wrong');
    }
  });

  if (isCorrect) {
    sounds.playCorrect();
    const pts = calcPointsEarned();
    updateScore(pts);
    currentSession.correctCount++;
    currentSession.streak++;
  } else {
    sounds.playWrong();
    currentSession.streak = 0;
  }

  showSolution(isCorrect, ch.explanation, ch.correctAnswer);

  // AUTOMATIC TRANSITION (NO Next Button!)
  currentSession.autoNextTimeout = setTimeout(() => {
    nextChallenge();
  }, 1400);
}

function calcPointsEarned() {
  const timeUsed = (Date.now() - currentSession.challengeStartTime) / 1000;
  let basePoints = 25;
  if (timeUsed < 15) {
    basePoints = 50; // Fast answer bonus
  } else if (timeUsed < 35) {
    basePoints = 35;
  }

  // Streak multiplier
  const multiplier = currentSession.streak >= 3 ? 1.5 : (currentSession.streak >= 2 ? 1.25 : 1);
  return Math.round(basePoints * multiplier);
}

function showSolution(isCorrect, explanation, correctAnswerText) {
  const anchor = document.getElementById('feedback-anchor');
  if (!anchor) return;

  const pointsBadge = isCorrect ? `+${calcPointsEarned()} points` : '+0 points';

  anchor.innerHTML = `
    <div class="feedback-container ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
      <div class="feedback-header ${isCorrect ? 'correct' : 'wrong'}">
        <span>${isCorrect ? '✅ CORRECT!' : '❌ INCORRECT'}</span>
        <span>${pointsBadge}</span>
      </div>
      <div class="feedback-solution">
        ${!isCorrect ? `<div><strong>Correct Answer:</strong> ${correctAnswerText}</div>` : ''}
        <div><strong>Solution:</strong> ${explanation}</div>
      </div>
      <div class="auto-advance-indicator">
        <span>Moving to next question...</span>
        <div class="auto-advance-bar">
          <div class="auto-advance-fill"></div>
        </div>
      </div>
    </div>
  `;
}

function updateScore(points) {
  currentSession.score += points;
  const scoreEl = document.getElementById('hud-live-score');
  if (scoreEl) scoreEl.textContent = currentSession.score;
}

function nextChallenge() {
  clearTimeout(currentSession.autoNextTimeout);
  currentSession.questionIndex++;

  if (currentSession.questionIndex < QUESTIONS_PER_LEVEL) {
    startChallenge();
  } else {
    finishLevel();
  }
}

// ==========================================
// 10. LEVEL FINISH, VICTORY & DEFEAT
// ==========================================

function finishLevel() {
  clearInterval(currentSession.timerInterval);
  const correct = currentSession.correctCount;
  const accuracy = Math.round((correct / QUESTIONS_PER_LEVEL) * 100);

  // Star calculation:
  // 9-10 = 3 Stars
  // 7-8  = 2 Stars
  // 5-6  = 1 Star
  // 0-4  = 0 Stars (Defeat)
  let stars = 0;
  if (correct >= 9) stars = 3;
  else if (correct >= 7) stars = 2;
  else if (correct >= 5) stars = 1;

  const isVictory = correct >= 5;

  if (isVictory) {
    sounds.playVictory();
    triggerConfetti();
    unlockNextLevel(currentSession.gameId, currentSession.level);

    // Save level performance
    const gameData = playerState.games[currentSession.gameId];
    if (!gameData.completedLevels[currentSession.level] || gameData.completedLevels[currentSession.level].stars < stars) {
      gameData.completedLevels[currentSession.level] = {
        stars: stars,
        bestScore: Math.max(
          gameData.completedLevels[currentSession.level]?.bestScore || 0,
          currentSession.score
        )
      };
    }
    saveProgress();
    showVictory(correct, accuracy, currentSession.score, stars);
  } else {
    sounds.playDefeat();
    showDefeat(correct, accuracy, currentSession.score);
  }
}

function unlockNextLevel(gameId, currentLevel) {
  const gameData = playerState.games[gameId];
  if (gameData && currentLevel === gameData.unlockedLevel && currentLevel < TOTAL_LEVELS_PER_GAME) {
    gameData.unlockedLevel = currentLevel + 1;
  }
}

function showVictory(correct, accuracy, score, stars) {
  let starSymbols = '';
  for (let i = 1; i <= 3; i++) {
    starSymbols += `<span class="star-anim" style="animation-delay: ${i * 0.15}s">${i <= stars ? '⭐' : '☆'}</span>`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'result-modal';

  const hasNext = currentSession.level < TOTAL_LEVELS_PER_GAME;

  modal.innerHTML = `
    <div class="result-card result-victory">
      <div class="result-badge-icon">🏆</div>
      <h2 class="result-title text-emerald">VICTORY!</h2>
      <div class="result-subtitle">Level Complete! Great brain workout!</div>
      
      <div class="stars-earned-row">
        ${starSymbols}
      </div>

      <div class="result-stats-grid">
        <div class="result-stat-box">
          <div class="result-stat-val text-emerald">${correct} / ${QUESTIONS_PER_LEVEL}</div>
          <div class="result-stat-lbl">Correct</div>
        </div>
        <div class="result-stat-box">
          <div class="result-stat-val text-cyan">${accuracy}%</div>
          <div class="result-stat-lbl">Accuracy</div>
        </div>
        <div class="result-stat-box">
          <div class="result-stat-val text-gold">${score}</div>
          <div class="result-stat-lbl">Score</div>
        </div>
      </div>

      <div class="result-actions-group">
        ${hasNext ? `
          <button class="btn btn-primary btn-lg" onclick="closeResultModal(); startGame('${currentSession.gameId}', ${currentSession.level + 1})">
            Next Level (${currentSession.level + 1}) ⏭️
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="closeResultModal(); startGame('${currentSession.gameId}', ${currentSession.level})">
          Replay Level 🔄
        </button>
        <button class="btn btn-secondary" onclick="closeResultModal(); showLevels('${currentSession.gameId}')">
          Level Map 🗺️
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function showDefeat(correct, accuracy, score) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'result-modal';

  modal.innerHTML = `
    <div class="result-card result-defeat">
      <div class="result-badge-icon">💔</div>
      <h2 class="result-title text-rose">DEFEAT</h2>
      <div class="result-subtitle">Keep Practicing! Score at least 5/10 to clear this level.</div>
      
      <div class="stars-earned-row">
        <span style="opacity: 0.4;">☆☆☆</span>
      </div>

      <div class="result-stats-grid">
        <div class="result-stat-box">
          <div class="result-stat-val text-rose">${correct} / ${QUESTIONS_PER_LEVEL}</div>
          <div class="result-stat-lbl">Correct</div>
        </div>
        <div class="result-stat-box">
          <div class="result-stat-val text-cyan">${accuracy}%</div>
          <div class="result-stat-lbl">Accuracy</div>
        </div>
        <div class="result-stat-box">
          <div class="result-stat-val text-gold">${score}</div>
          <div class="result-stat-lbl">Score</div>
        </div>
      </div>

      <div class="result-actions-group">
        <button class="btn btn-emerald btn-lg" onclick="closeResultModal(); startGame('${currentSession.gameId}', ${currentSession.level})">
          Try Again 🔄
        </button>
        <button class="btn btn-secondary" onclick="closeResultModal(); showLevels('${currentSession.gameId}')">
          Level Map 🗺️
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeResultModal() {
  const m = document.getElementById('result-modal');
  if (m) m.remove();
}

// ==========================================
// 11. PROGRESS DASHBOARD
// ==========================================

function updateProgress() {
  recalcGlobalStats();
  renderHomeStats();

  const totalScoreEl = document.getElementById('prog-total-score');
  const totalStarsEl = document.getElementById('prog-total-stars');
  const cogLevelsEl = document.getElementById('prog-cog-levels');
  const aptLevelsEl = document.getElementById('prog-apt-levels');
  const overallAccEl = document.getElementById('prog-overall-accuracy');

  let cogCompleted = 0;
  let aptCompleted = 0;
  let totalCorrect = 0;
  let totalAttempted = 0;

  Object.keys(GAMES_REGISTRY).forEach((gid) => {
    const g = GAMES_REGISTRY[gid];
    const data = playerState.games[gid];
    if (data && data.completedLevels) {
      const count = Object.keys(data.completedLevels).length;
      if (g.category === 'cognitive') cogCompleted += count;
      else aptCompleted += count;

      // Estimate accuracy based on stars
      Object.values(data.completedLevels).forEach((lvl) => {
        totalAttempted += 10;
        if (lvl.stars === 3) totalCorrect += 9.5;
        else if (lvl.stars === 2) totalCorrect += 7.5;
        else if (lvl.stars === 1) totalCorrect += 5.5;
      });
    }
  });

  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  if (totalScoreEl) totalScoreEl.textContent = playerState.totalScore.toLocaleString();
  if (totalStarsEl) totalStarsEl.textContent = playerState.totalStars;
  if (cogLevelsEl) cogLevelsEl.textContent = `${cogCompleted} / 100`;
  if (aptLevelsEl) aptLevelsEl.textContent = `${aptCompleted} / 60`;
  if (overallAccEl) overallAccEl.textContent = `${overallAccuracy}%`;

  // Skill percentages
  const memoryCompleted = (getCompletedCount('mental-grid-map') + getCompletedCount('matrix-pattern-copy')) / (TOTAL_LEVELS_PER_GAME * 2);
  const attentionCompleted = getCompletedCount('color-rush') / TOTAL_LEVELS_PER_GAME;
  const patternCompleted = getCompletedCount('pattern-match') / TOTAL_LEVELS_PER_GAME;
  const logicCompleted = (getCompletedCount('logic-escape') + getCompletedCount('logical-reasoning')) / (TOTAL_LEVELS_PER_GAME * 2);
  const quantCompleted = getCompletedCount('quantitative-aptitude') / TOTAL_LEVELS_PER_GAME;
  const verbalCompleted = getCompletedCount('verbal-ability') / TOTAL_LEVELS_PER_GAME;

  updateSkillBar('skill-memory', Math.round(memoryCompleted * 100));
  updateSkillBar('skill-attention', Math.round(attentionCompleted * 100));
  updateSkillBar('skill-patterns', Math.round(patternCompleted * 100));
  updateSkillBar('skill-logic', Math.round(logicCompleted * 100));
  updateSkillBar('skill-quant', Math.round(quantCompleted * 100));
  updateSkillBar('skill-verbal', Math.round(verbalCompleted * 100));

  renderBadges();
}

function getCompletedCount(gameId) {
  const g = playerState.games[gameId];
  return g && g.completedLevels ? Object.keys(g.completedLevels).length : 0;
}

function updateSkillBar(id, pct) {
  const bar = document.getElementById(`${id}-fill`);
  const val = document.getElementById(`${id}-val`);
  if (bar) bar.style.width = `${pct}%`;
  if (val) val.textContent = `${pct}%`;
}

function renderBadges() {
  const container = document.getElementById('badges-grid-container');
  if (!container) return;

  const totalCompleted = Object.values(playerState.games).reduce(
    (acc, g) => acc + Object.keys(g.completedLevels || {}).length,
    0
  );

  const badges = [
    {
      name: 'First Spark',
      desc: 'Complete your first level in any game.',
      icon: '🌱',
      unlocked: totalCompleted >= 1
    },
    {
      name: 'Star Collector',
      desc: 'Collect 15 or more total stars.',
      icon: '⭐',
      unlocked: playerState.totalStars >= 15
    },
    {
      name: 'Memory Prodigy',
      desc: 'Clear 5 levels in Mental Grid Map.',
      icon: '🧠',
      unlocked: getCompletedCount('mental-grid-map') >= 5
    },
    {
      name: 'Lightning Reflex',
      desc: 'Clear 5 levels in Color Rush.',
      icon: '⚡',
      unlocked: getCompletedCount('color-rush') >= 5
    },
    {
      name: 'Mathlete Master',
      desc: 'Clear 5 levels in Quantitative Aptitude.',
      icon: '📐',
      unlocked: getCompletedCount('quantitative-aptitude') >= 5
    },
    {
      name: 'Brain Grandmaster',
      desc: 'Accumulate over 5,000 Total Points.',
      icon: '👑',
      unlocked: playerState.totalScore >= 5000
    }
  ];

  container.innerHTML = badges.map((b) => `
    <div class="badge-item ${b.unlocked ? 'unlocked' : 'locked'}">
      <div class="badge-item-icon">${b.icon}</div>
      <div class="badge-item-name ${b.unlocked ? 'text-gold' : ''}">${b.name}</div>
      <div class="badge-item-desc">${b.desc}</div>
    </div>
  `).join('');
}

// ==========================================
// 12. CONFETTI VISUAL ENGINE
// ==========================================
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00f0ff', '#a855f7', '#10b981', '#fbbf24', '#f43f5e', '#38bdf8'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2 + 100,
      r: randInt(4, 8),
      color: randPick(colors),
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.8) * 16,
      gravity: 0.35,
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= 0.012;
      p.rotation += p.vRot;

      if (p.alpha > 0) {
        active = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
    });

    if (active) {
      requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render();
}

// ==========================================
// 13. SOUND TOGGLE & GLOBAL EVENT BINDINGS
// ==========================================
function toggleSound() {
  playerState.soundEnabled = !playerState.soundEnabled;
  saveProgress();
  sounds.playClick();
}

// Window init
window.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  showHome();

  // Resize listener for confetti
  window.addEventListener('resize', () => {
    const canvas = document.getElementById('confetti-canvas');
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
});

// Export functions to global scope as required by prompt
window.showHome = showHome;
window.showGames = showGames;
window.showCognitiveGames = showCognitiveGames;
window.showAptitudeGames = showAptitudeGames;
window.showLevels = showLevels;
window.startGame = startGame;
window.startChallenge = startChallenge;
window.checkAnswer = checkAnswer;
window.showSolution = showSolution;
window.nextChallenge = nextChallenge;
window.finishLevel = finishLevel;
window.showVictory = showVictory;
window.showDefeat = showDefeat;
window.unlockNextLevel = unlockNextLevel;
window.saveProgress = saveProgress;
window.loadProgress = loadProgress;
window.updateScore = updateScore;
window.updateProgress = updateProgress;
window.startBrainBoost = startBrainBoost;
window.toggleSound = toggleSound;
window.resetAllData = resetAllData;
window.closeResultModal = closeResultModal;
