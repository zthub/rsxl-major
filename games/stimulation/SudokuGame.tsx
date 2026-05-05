import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

type CellValue = number | null;

const generatePuzzle = (level: number): { puzzle: CellValue[][], solution: CellValue[][] } => {
  const size = level <= 3 ? 4 : 6;
  const subSize = size === 4 ? 2 : 3;

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
  } else {
    solve(grid);
  }

  // Copy solution
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      solution[r][c] = grid[r][c];

  // Remove cells based on level
  const cellsToRemove = Math.min(4 + level * 2, size * size - size);
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

export const SudokuGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const gridRef = useRef<CellValue[][]>([]);
  const solutionRef = useRef<CellValue[][]>([]);
  const givenRef = useRef<boolean[][]>([]);
  const selectedRef = useRef<[number, number] | null>(null);
  const sizeRef = useRef(4);
  const errorsRef = useRef(0);
  const [completed, setCompleted] = useState(false);
  const showNumbersRef = useRef(false);
  const numberPadY = useRef(0);

  const initGame = useCallback(() => {
    const { puzzle, solution } = generatePuzzle(level);
    const size = puzzle.length;
    sizeRef.current = size;
    gridRef.current = puzzle;
    solutionRef.current = solution;
    givenRef.current = puzzle.map(row => row.map(cell => cell !== null));
    selectedRef.current = null;
    errorsRef.current = 0;
    setCompleted(false);
  }, [level]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

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
                setTimeout(() => setLevel(prev => prev + 1), 2000);
              }
            } else {
              playSound('wrong');
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
  }, [isPlaying, completed, onScore, onGameOver, width, height]);

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
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`数独挑战  第${level}关  |  错误: ${errorsRef.current}/5`, width / 2, topOffset - 12);
    ctx.shadowBlur = 0;

    // Draw grid
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cx = gridX + c * cellSize;
        const cy = gridY + r * cellSize;
        const isSelected = selectedRef.current?.[0] === r && selectedRef.current?.[1] === c;
        const isGiven = givenRef.current[r]?.[c];

        // Cell background
        if (isSelected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        } else if (Math.floor(r / subSize) % 2 === Math.floor(c / subSize) % 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
        }
        ctx.fillRect(cx, cy, cellSize, cellSize);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx + 0.75, cy + 0.75, cellSize - 1.5, cellSize - 1.5);

        // Number
        const val = gridRef.current[r]?.[c];
        if (val !== null && val !== undefined) {
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

  return (
    <canvas ref={canvasRef} onPointerDown={handlePointerDown} className="block touch-none cursor-pointer" />
  );
};
