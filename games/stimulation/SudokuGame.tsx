import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

type CellValue = number | null;

// 数独配置
const TOTAL_LEVELS = 30; // 增加到30关
const FREE_SWITCH_LEVELS = 3; // 默认开放前3关
const SUDOKU_STORAGE_KEY = 'sudoku_progress';

// 关卡难度配置 - 完整的学习曲线
const LEVEL_CONFIG = [
  // ===== 4x4 入门关卡 (1-4) =====
  { level: 1, size: 4, removeCount: 5, difficulty: '入门' },    // 4x4, 保留11个
  { level: 2, size: 4, removeCount: 6, difficulty: '入门' },    // 4x4, 保留10个
  { level: 3, size: 4, removeCount: 7, difficulty: '简单' },    // 4x4, 保留9个
  { level: 4, size: 4, removeCount: 8, difficulty: '简单' },    // 4x4, 保留8个

  // ===== 6x6 进阶关卡 (5-10) =====
  { level: 5, size: 6, removeCount: 14, difficulty: '简单' },   // 6x6, 保留22个
  { level: 6, size: 6, removeCount: 18, difficulty: '中等' },   // 6x6, 保留18个
  { level: 7, size: 6, removeCount: 22, difficulty: '中等' },   // 6x6, 保留14个
  { level: 8, size: 6, removeCount: 26, difficulty: '较难' },   // 6x6, 保留10个
  { level: 9, size: 6, removeCount: 28, difficulty: '较难' },   // 6x6, 保留8个
  { level: 10, size: 6, removeCount: 30, difficulty: '困难' },  // 6x6, 保留6个

  // ===== 9x9 简单模式 (11-15) - 数字较多，适合新手 =====
  { level: 11, size: 9, removeCount: 36, difficulty: '简单' },  // 9x9, 保留45个 (50%)
  { level: 12, size: 9, removeCount: 40, difficulty: '简单' },  // 9x9, 保留41个 (46%)
  { level: 13, size: 9, removeCount: 42, difficulty: '简单' },  // 9x9, 保留39个 (43%)
  { level: 14, size: 9, removeCount: 44, difficulty: '中等' },  // 9x9, 保留37个 (41%)
  { level: 15, size: 9, removeCount: 46, difficulty: '中等' },  // 9x9, 保留35个 (39%)

  // ===== 9x9 中等模式 (16-20) - 标准难度 =====
  { level: 16, size: 9, removeCount: 48, difficulty: '中等' },  // 9x9, 保留33个 (37%)
  { level: 17, size: 9, removeCount: 50, difficulty: '中等' },  // 9x9, 保留31个 (34%)
  { level: 18, size: 9, removeCount: 52, difficulty: '较难' },  // 9x9, 保留29个 (32%)
  { level: 19, size: 9, removeCount: 54, difficulty: '较难' },  // 9x9, 保留27个 (30%)
  { level: 20, size: 9, removeCount: 56, difficulty: '较难' },  // 9x9, 保留25个 (28%)

  // ===== 9x9 困难模式 (21-25) - 挑战性 =====
  { level: 21, size: 9, removeCount: 58, difficulty: '困难' },  // 9x9, 保留23个 (26%)
  { level: 22, size: 9, removeCount: 60, difficulty: '困难' },  // 9x9, 保留21个 (23%)
  { level: 23, size: 9, removeCount: 62, difficulty: '困难' },  // 9x9, 保留19个 (21%)
  { level: 24, size: 9, removeCount: 64, difficulty: '专家' },  // 9x9, 保留17个 (19%)
  { level: 25, size: 9, removeCount: 66, difficulty: '专家' },  // 9x9, 保留15个 (17%)

  // ===== 9x9 专家模式 (26-30) - 极限挑战 =====
  { level: 26, size: 9, removeCount: 68, difficulty: '专家' },  // 9x9, 保留13个 (14%)
  { level: 27, size: 9, removeCount: 70, difficulty: '专家' },  // 9x9, 保留11个 (12%)
  { level: 28, size: 9, removeCount: 72, difficulty: '大师' },  // 9x9, 保留9个 (10%)
  { level: 29, size: 9, removeCount: 74, difficulty: '大师' },  // 9x9, 保留7个 (8%)
  { level: 30, size: 9, removeCount: 76, difficulty: '大师' },  // 9x9, 保留5个 (6%)
];

const generatePuzzle = (level: number): { puzzle: CellValue[][], solution: CellValue[][] } => {
  const config = LEVEL_CONFIG[Math.min(level - 1, LEVEL_CONFIG.length - 1)];
  const size = config.size;
  const subSize = size === 4 ? 2 : 3;
  const cellsToRemove = Math.min(config.removeCount, size * size - size);

  // Generate a valid solution using backtracking
  const grid: CellValue[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const solution: CellValue[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const isValid = (grid: CellValue[][], row: number, col: number, num: number): boolean => {
    for (let c = 0; c < size; c++) if (grid[row][c] === num) return false;
    for (let r = 0; r < size; r++) if (grid[r][col] === num) return false;
    const br = Math.floor(row / subSize) * subSize;
    const bc = Math.floor(col / subSize) * subSize;
    for (let r = br; r < br + subSize; r++)
      for (let c = bc; c < bc + subSize; c++)
        if (grid[r][c] === num) return false;
    return true;
  };

  const solve = (grid: CellValue[][]): boolean => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
          const nums = [...Array(size)].map((_, i) => i + 1).sort(() => Math.random() - 0.5);
          for (const num of nums) {
            if (isValid(grid, r, c, num)) {
              grid[r][c] = num;
              if (solve(grid)) return true;
              grid[r][c] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  // Use a simpler approach - generate row by row permutations for 4x4
  if (size === 4) {
    const perms = [[1,2,3,4],[1,2,4,3],[1,3,2,4],[1,3,4,2],[1,4,2,3],[1,4,3,2],
                    [2,1,3,4],[2,1,4,3],[2,3,1,4],[2,3,4,1],[2,4,1,3],[2,4,3,1],
                    [3,1,2,4],[3,1,4,2],[3,2,1,4],[3,2,4,1],[3,4,1,2],[3,4,2,1],
                    [4,1,2,3],[4,1,3,2],[4,2,1,3],[4,2,3,1],[4,3,1,2],[4,3,2,1]];

    // Build valid 4x4 grid: must be valid Latin square (rows AND cols unique)
    let found = false;
    const usedInCol: number[][] = Array.from({ length: 4 }, () => []);

    for (let attempt = 0; attempt < 2000 && !found; attempt++) {
      // Reset column tracking
      for (let c = 0; c < 4; c++) usedInCol[c] = [];
      let valid = true;

      for (let r = 0; r < 4 && valid; r++) {
        // Pick a random permutation that doesn't conflict with columns used so far
        let shuffled = [...perms].sort(() => Math.random() - 0.5);
        let placed = false;
        for (const perm of shuffled) {
          // Check if perm conflicts with any column so far
          let conflict = false;
          for (let c = 0; c < 4; c++) {
            if (usedInCol[c].includes(perm[c])) { conflict = true; break; }
          }
          if (!conflict) {
            grid[r] = [...perm];
            for (let c = 0; c < 4; c++) usedInCol[c].push(perm[c]);
            placed = true;
            break;
          }
        }
        if (!placed) valid = false;
      }

      // Check 2x2 boxes
      if (valid) {
        for (let br = 0; br < 4 && valid; br += 2) {
          for (let bc = 0; bc < 4 && valid; bc += 2) {
            const box = [grid[br][bc], grid[br][bc+1], grid[br+1][bc], grid[br+1][bc+1]];
            if (new Set(box).size !== 4) valid = false;
          }
        }
      }

      if (valid) found = true;
    }

    if (!found) {
      // Fallback: use a pre-built valid 4x4 grid
      grid[0] = [1,2,3,4];
      grid[1] = [3,4,1,2];
      grid[2] = [2,1,4,3];
      grid[3] = [4,3,2,1];
    }
  } else if (size === 6) {
    // For 6x6, use solve with multiple attempts
    let solved = false;
    for (let attempt = 0; attempt < 100 && !solved; attempt++) {
      // Reset grid
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          grid[r][c] = null;
      solved = solve(grid);
    }

    if (!solved) {
      // Fallback: use a pre-built valid 6x6 grid
      grid[0] = [1,2,3,4,5,6];
      grid[1] = [4,5,6,1,2,3];
      grid[2] = [2,3,1,5,6,4];
      grid[3] = [5,6,4,2,3,1];
      grid[4] = [3,1,2,6,4,5];
      grid[5] = [6,4,5,3,1,2];
    }
  } else {
    // For 9x9 - optimized generation with diagonal box filling first
    let solved = false;

    // Strategy: Fill diagonal 3x3 boxes first (they don't conflict), then solve rest
    const fillDiagonalBoxes = () => {
      for (let box = 0; box < 3; box++) {
        const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            grid[box * 3 + r][box * 3 + c] = nums[idx++];
          }
        }
      }
    };

    for (let attempt = 0; attempt < 50 && !solved; attempt++) {
      // Reset grid
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          grid[r][c] = null;

      fillDiagonalBoxes();
      solved = solve(grid);
    }

    if (!solved) {
      // Fallback: use a pre-built valid 9x9 grid
      grid[0] = [5,3,4,6,7,8,9,1,2];
      grid[1] = [6,7,2,1,9,5,3,4,8];
      grid[2] = [1,9,8,3,4,2,5,6,7];
      grid[3] = [8,5,9,7,6,1,4,2,3];
      grid[4] = [4,2,6,8,5,3,7,9,1];
      grid[5] = [7,1,3,9,2,4,8,5,6];
      grid[6] = [9,6,1,5,3,7,2,8,4];
      grid[7] = [2,8,7,4,1,9,6,3,5];
      grid[8] = [3,4,5,2,8,6,1,7,9];
    }
  }

  // Copy solution
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      solution[r][c] = grid[r][c];

  // Remove cells based on difficulty config
  const positions: [number, number][] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      positions.push([r, c]);
  positions.sort(() => Math.random() - 0.5);

  for (let i = 0; i < cellsToRemove; i++) {
    const [r, c] = positions[i];
    grid[r][c] = null;
  }

  return { puzzle: grid, solution };
};

// 进度管理函数
function loadSudokuProgress(): { completed: number[]; currentLevel: number } {
  try {
    const raw = localStorage.getItem(SUDOKU_STORAGE_KEY);
    if (!raw) return { completed: [], currentLevel: 1 };
    const parsed = JSON.parse(raw);
    const completed = Array.isArray(parsed?.completed) ? parsed.completed : [];
    const normalized = completed
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= TOTAL_LEVELS) as number[];
    const currentLevel = clamp(Number(parsed?.currentLevel || 1), 1, TOTAL_LEVELS);
    return { completed: Array.from(new Set(normalized)).sort((a, b) => a - b), currentLevel };
  } catch {
    return { completed: [], currentLevel: 1 };
  }
}

function saveSudokuProgress(state: { completed: number[]; currentLevel?: number }) {
  const current = loadSudokuProgress();
  localStorage.setItem(
    SUDOKU_STORAGE_KEY,
    JSON.stringify({
      completed: state.completed,
      currentLevel: state.currentLevel ?? current.currentLevel ?? 1,
    })
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const SudokuGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  // 进度管理
  const initialProgress = useMemo(() => loadSudokuProgress(), []);
  const [level, setLevel] = useState(initialProgress.currentLevel || 1);
  const [completedLevels, setCompletedLevels] = useState<number[]>(() => initialProgress.completed);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  const gridRef = useRef<CellValue[][]>([]);
  const solutionRef = useRef<CellValue[][]>([]);
  const givenRef = useRef<boolean[][]>([]);
  const selectedRef = useRef<[number, number] | null>(null);
  const sizeRef = useRef(4);
  const errorsRef = useRef(0);
  const [completed, setCompleted] = useState(false);
  const showNumbersRef = useRef(false);
  const numberPadY = useRef(0);

  // 错误动画状态 - 用于显示明显的错误提示
  const errorAnimRef = useRef<{
    row: number;
    col: number;
    startTime: number;
    duration: number; // 动画持续时间（毫秒）
  } | null>(null);

  const isMobile = Math.min(width, height) <= 600;
  const maxCompleted = completedLevels.length ? completedLevels[completedLevels.length - 1] : 0;
  const maxUnlocked = Math.max(FREE_SWITCH_LEVELS, clamp(maxCompleted + 1, 1, TOTAL_LEVELS));

  const isUnlocked = useCallback((id: number) => {
    if (id <= FREE_SWITCH_LEVELS) return true;
    if (completedLevels.includes(id)) return true;
    return id <= maxUnlocked;
  }, [completedLevels, maxUnlocked]);

  const initGame = useCallback((newLevelId?: number) => {
    const currentLevel = newLevelId || level;
    const safeLevel = clamp(currentLevel, 1, TOTAL_LEVELS);

    const { puzzle, solution } = generatePuzzle(safeLevel);
    const size = puzzle.length;
    sizeRef.current = size;
    gridRef.current = puzzle;
    solutionRef.current = solution;
    givenRef.current = puzzle.map(row => row.map(cell => cell !== null));
    selectedRef.current = null;
    errorsRef.current = 0;
    setCompleted(false);

    // 保存当前关卡
    saveSudokuProgress({ completed: loadSudokuProgress().completed, currentLevel: safeLevel });
  }, [level]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const markLevelCompleted = useCallback((id: number) => {
    setCompletedLevels((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].sort((a, b) => a - b);
      saveSudokuProgress({ completed: next, currentLevel: id });
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || completed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(15, width * 0.02);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.18);
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;

    // Check number pad
    const padY = gridY + availSize + 15;
    numberPadY.current = padY;
    const padCellSize = Math.min(cellSize, 50);
    const padTotalW = size * padCellSize + (size - 1) * 6;
    const padStartX = (width - padTotalW) / 2;

    for (let i = 0; i < size; i++) {
      const px = padStartX + i * (padCellSize + 6);
      if (x >= px && x <= px + padCellSize && y >= padY && y <= padY + padCellSize) {
        if (selectedRef.current) {
          const [sr, sc] = selectedRef.current;
          if (!givenRef.current[sr][sc]) {
            const num = i + 1;
            gridRef.current[sr][sc] = num;
            if (num === solutionRef.current[sr][sc]) {
              playSound('correct');
              onScore(5);
              // Check completion
              let complete = true;
              for (let r = 0; r < size && complete; r++)
                for (let c = 0; c < size && complete; c++)
                  if (gridRef.current[r][c] !== solutionRef.current[r][c]) complete = false;
              if (complete) {
                setCompleted(true);
                playSound('correct');
                onScore(50);
                // 标记当前关卡完成
                markLevelCompleted(level);
                // 自动进入下一关（如果已解锁）
                setTimeout(() => {
                  const nextLevel = clamp(level + 1, 1, TOTAL_LEVELS);
                  if (isUnlocked(nextLevel)) {
                    setLevel(nextLevel);
                    initGame(nextLevel);
                  }
                }, 2000);
              }
            } else {
              playSound('wrong');
              // 触发错误动画 - 明显的视觉反馈
              errorAnimRef.current = {
                row: sr,
                col: sc,
                startTime: Date.now(),
                duration: 800 // 动画持续800毫秒
              };
              gridRef.current[sr][sc] = null;
              errorsRef.current++;
              if (errorsRef.current >= 5) {
                onGameOver();
              }
            }
          }
        }
        return;
      }
    }

    // Check grid click
    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col >= 0 && col < size && row >= 0 && row < size) {
      selectedRef.current = [row, col];
    } else {
      selectedRef.current = null;
    }
  }, [isPlaying, completed, onScore, onGameOver, width, height, level, isUnlocked, markLevelCompleted, initGame]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(15, width * 0.02);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.18);
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;
    const subSize = size === 4 ? 2 : 3;

    // Level info
    const currentConfig = LEVEL_CONFIG[level - 1];
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(
      `数独挑战  第${level}关 (${currentConfig?.size}×${currentConfig?.size} ${currentConfig?.difficulty || ''})  |  错误: ${errorsRef.current}/5`,
      width / 2,
      topOffset - 12
    );
    ctx.shadowBlur = 0;

    // Draw grid
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cx = gridX + c * cellSize;
        const cy = gridY + r * cellSize;
        const isSelected = selectedRef.current?.[0] === r && selectedRef.current?.[1] === c;
        const isGiven = givenRef.current[r]?.[c];

        // 检查是否是错误动画的格子
        const isErrorCell = errorAnimRef.current &&
                           errorAnimRef.current.row === r &&
                           errorAnimRef.current.col === c;
        let errorProgress = 0;
        if (isErrorCell) {
          const elapsed = Date.now() - errorAnimRef.current.startTime;
          errorProgress = Math.min(elapsed / errorAnimRef.current.duration, 1);
          if (errorProgress >= 1) {
            errorAnimRef.current = null; // 动画结束
          }
        }

        // Cell background
        if (isErrorCell && errorProgress < 1) {
          // 错误动画效果：红色闪烁 + 抖动
          const flashIntensity = Math.sin(errorProgress * Math.PI * 4) * (1 - errorProgress);
          const shakeOffset = Math.sin(errorProgress * Math.PI * 12) * 3 * (1 - errorProgress);

          ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + flashIntensity * 0.5})`;
          ctx.fillRect(cx + shakeOffset, cy + shakeOffset, cellSize, cellSize);

          // 红色边框发光效果
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.8 + flashIntensity * 0.2})`;
          ctx.lineWidth = 3 + flashIntensity * 2;
          ctx.strokeRect(cx + shakeOffset - 1, cy + shakeOffset - 1, cellSize + 2, cellSize + 2);

          // 绘制错误图标（X）
          if (errorProgress > 0.2 && errorProgress < 0.8) {
            const iconAlpha = Math.min(1, (errorProgress - 0.2) * 2) * Math.min(1, (0.8 - errorProgress) * 5);
            ctx.save();
            ctx.translate(cx + cellSize / 2 + shakeOffset, cy + cellSize / 2 + shakeOffset);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = `rgba(239, 68, 68, ${iconAlpha})`;
            ctx.fillRect(-cellSize * 0.25, -3, cellSize * 0.5, 6);
            ctx.fillRect(-3, -cellSize * 0.25, 6, cellSize * 0.5);
            ctx.restore();
          }
        } else if (isSelected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.fillRect(cx, cy, cellSize, cellSize);

          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx + 0.75, cy + 0.75, cellSize - 1.5, cellSize - 1.5);
        } else if (Math.floor(r / subSize) % 2 === Math.floor(c / subSize) % 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(cx, cy, cellSize, cellSize);

          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.75, cy + 0.75, cellSize - 1.5, cellSize - 1.5);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(cx, cy, cellSize, cellSize);

          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.75, cy + 0.75, cellSize - 1.5, cellSize - 1.5);
        }

        // Number (不在错误动画期间显示数字)
        const val = gridRef.current[r]?.[c];
        if (val !== null && val !== undefined && !(isErrorCell && errorProgress < 1)) {
          ctx.fillStyle = isGiven ? '#94a3b8' : '#facc15';
          ctx.font = `bold ${cellSize * 0.5}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'black'; ctx.shadowBlur = 3;
          ctx.fillText(String(val), cx + cellSize / 2, cy + cellSize / 2);
          ctx.shadowBlur = 0;
        }
      }
    }

    // Thick lines for sub-grids
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= size; i += subSize) {
      ctx.beginPath();
      ctx.moveTo(gridX + i * cellSize, gridY);
      ctx.lineTo(gridX + i * cellSize, gridY + availSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gridX, gridY + i * cellSize);
      ctx.lineTo(gridX + availSize, gridY + i * cellSize);
      ctx.stroke();
    }

    // Number pad
    const padY = gridY + availSize + 15;
    const padCellSize = Math.min(cellSize, 50);
    const padTotalW = size * padCellSize + (size - 1) * 6;
    const padStartX = (width - padTotalW) / 2;

    for (let i = 0; i < size; i++) {
      const px = padStartX + i * (padCellSize + 6);
      ctx.fillStyle = selectedRef.current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.roundRect(px, padY, padCellSize, padCellSize, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = `bold ${padCellSize * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px + padCellSize / 2, padY + padCellSize / 2);
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.min(14, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('选择空格，再点击下方数字填入', width / 2, padY + padCellSize + 20);

    // 错误警告提示 - 当有错误动画时显示
    if (errorAnimRef.current) {
      const elapsed = Date.now() - errorAnimRef.current.startTime;
      const warningProgress = Math.min(elapsed / errorAnimRef.current.duration, 1);

      if (warningProgress < 1) {
        const alpha = Math.sin(warningProgress * Math.PI) * 0.9;
        const yOffset = (1 - warningProgress) * 20;

        ctx.save();
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.font = `bold ${Math.min(20, width * 0.022)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText('❌ 填错了！', width / 2, padY + padCellSize + 45 + yOffset);
        ctx.restore();
      }
    }

    // 错误次数接近上限时的警告
    if (errorsRef.current >= 3 && errorsRef.current < 5) {
      const warningAlpha = 0.6 + Math.sin(Date.now() / 200) * 0.3;
      ctx.fillStyle = `rgba(251, 146, 60, ${warningAlpha})`;
      ctx.font = `${Math.min(12, width * 0.014)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`⚠️ 还剩 ${5 - errorsRef.current} 次机会`, width / 2, padY + padCellSize + 62);
    }

    // Completed
    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 数独完成！', width / 2, height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(28, width * 0.03)}px sans-serif`;
      ctx.fillText('准备下一关...', width / 2, height / 2 + 40);
      ctx.shadowBlur = 0;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, completed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
  }, [width, height]);

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animate]);

  const selectLevel = useCallback((id: number) => {
    if (!isUnlocked(id)) return;
    setShowLevelSelect(false);
    setLevel(id);
    setTimeout(() => {
      initGame(id);
    }, 0);
  }, [isUnlocked, initGame]);

  // 渲染关卡按钮的辅助函数
  const renderLevelButton = useCallback((id: number) => {
    const isCurrent = id === level;
    const isDone = completedLevels.includes(id);
    const unlocked = isUnlocked(id);
    const config = LEVEL_CONFIG[id - 1];

    return (
      <button
        key={id}
        onClick={() => selectLevel(id)}
        disabled={!unlocked}
        className={`
          relative aspect-square rounded-xl font-bold text-base transition-all
          ${isCurrent
            ? 'bg-blue-500 text-white shadow-lg scale-105'
            : isDone
              ? 'bg-green-500 text-white'
              : unlocked
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
          }
        `}
        title={`第${id}关 - ${config?.size}x${config?.size} ${config?.difficulty || ''}`}
      >
        {id}
        {isDone && (
          <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
        )}
        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center text-xs opacity-50">🔒</span>
        )}
      </button>
    );
  }, [level, completedLevels, isUnlocked, selectLevel]);

  const progressText = `${completedLevels.length}/${TOTAL_LEVELS}`;

  return (
    <div className="relative w-full h-full select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block touch-none cursor-pointer"
      />

      {/* HUD (mobile: only show level select to avoid overlap) */}
      <div className="absolute top-16 md:top-20 right-12 md:right-28 z-10 pointer-events-auto flex items-center gap-2">
        {!isMobile && (
          <div className="px-3 py-1.5 rounded-full bg-black/35 text-white text-xs md:text-sm font-semibold backdrop-blur">
            已通关: {progressText}
          </div>
        )}
        <button
          onClick={() => setShowLevelSelect((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-800 text-xs md:text-sm font-black shadow"
        >
          选关
        </button>
      </div>

      {/* Level Select Panel */}
      {showLevelSelect && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="text-lg md:text-xl font-black text-slate-800">数独挑战 - 关卡选择</div>
                <div className="text-xs md:text-sm text-slate-500">
                  前 {FREE_SWITCH_LEVELS} 关可自由切换；后续需通关前一关解锁
                </div>
              </div>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                关闭
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-6">
              {/* 4x4 入门关卡 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-400"></span>
                  4×4 入门 (1-4关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const id = idx + 1;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>

              {/* 6x6 进阶关卡 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-400"></span>
                  6×6 进阶 (5-10关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const id = idx + 5;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>

              {/* 9x9 简单模式 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-yellow-400"></span>
                  9×9 简单 (11-15关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const id = idx + 11;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>

              {/* 9x9 中等模式 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-orange-400"></span>
                  9×9 中等 (16-20关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const id = idx + 16;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>

              {/* 9x9 困难模式 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-red-400"></span>
                  9×9 困难 (21-25关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const id = idx + 21;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>

              {/* 9x9 专家/大师模式 */}
              <div>
                <h3 className="text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500"></span>
                  9×9 专家/大师 (26-30关)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const id = idx + 26;
                    return renderLevelButton(id);
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  当前: 第{level}关 ({LEVEL_CONFIG[level-1]?.size}×{LEVEL_CONFIG[level-1]?.size}) -
                  难度: {LEVEL_CONFIG[level-1]?.difficulty || '未知'}
                </span>
                <span>已解锁: {maxUnlocked}/{TOTAL_LEVELS}</span>
              </div>
              {level >= 11 && (
                <div className="mt-1 text-xs text-slate-400">
                  提示: 9×9数独需要填入1-9的数字，每行、每列、每个3×3宫格都不能重复
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
