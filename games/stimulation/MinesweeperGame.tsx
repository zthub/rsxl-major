import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

// state controls DISPLAY only: hidden/revealed/flagged
// hasMine tracks mine data separately so mines stay invisible until game over
type CellState = 'hidden' | 'revealed' | 'flagged';

interface Cell {
  state: CellState;
  hasMine: boolean;
  adjacentMines: number;
}

export const MinesweeperGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const gridRef = useRef<Cell[][]>([]);
  const sizeRef = useRef(6);
  const mineCountRef = useRef(5);
  const flagModeRef = useRef(false);
  const revealedRef = useRef(0);
  const [gameOverState, setGameOverState] = useState<'won' | 'lost' | null>(null);
  const firstClickRef = useRef(true);

  const getConfig = () => {
    if (level <= 2) return { size: 6, mines: 5 };
    if (level <= 4) return { size: 8, mines: 10 };
    if (level <= 6) return { size: 8, mines: 15 };
    return { size: 10, mines: 20 };
  };

  const initGame = useCallback(() => {
    const { size, mines } = getConfig();
    sizeRef.current = size;
    mineCountRef.current = mines;
    gridRef.current = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ state: 'hidden' as CellState, hasMine: false, adjacentMines: 0 }))
    );
    revealedRef.current = 0;
    setGameOverState(null);
    firstClickRef.current = true;
    flagModeRef.current = false;
  }, [level]);

  const placeMines = (excludeRow: number, excludeCol: number) => {
    const size = sizeRef.current;
    const mines = mineCountRef.current;

    // Build safe zone (clicked cell + neighbors)
    const safeZone = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = excludeRow + dr, nc = excludeCol + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          safeZone.add(`${nr},${nc}`);
        }
      }
    }

    // Collect candidates (non-safe positions)
    const candidates: number[] = [];
    for (let i = 0; i < size * size; i++) {
      const r = Math.floor(i / size);
      const c = i % size;
      if (!safeZone.has(`${r},${c}`)) candidates.push(i);
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Place mines using hasMine flag (NOT state, so mines stay visually hidden)
    const mineCount = Math.min(mines, candidates.length);
    for (let i = 0; i < mineCount; i++) {
      const idx = candidates[i];
      const r = Math.floor(idx / size);
      const c = idx % size;
      gridRef.current[r][c].hasMine = true;
    }

    // Calculate adjacent mine counts using hasMine
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (gridRef.current[r][c].hasMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && gridRef.current[nr][nc].hasMine) {
              count++;
            }
          }
        }
        gridRef.current[r][c].adjacentMines = count;
      }
    }
  };

  // Returns true if a mine was hit (game over)
  const revealCell = (row: number, col: number): boolean => {
    const size = sizeRef.current;

    // Only handle hidden cells
    if (gridRef.current[row][col].state !== 'hidden') return false;

    // Place mines on first click (guaranteed safe zone)
    if (firstClickRef.current) {
      firstClickRef.current = false;
      placeMines(row, col);
    }

    const cell = gridRef.current[row][col];

    // Check if clicked on a mine (hasMine, not state)
    if (cell.hasMine) {
      // Game over - flip all mine cells to revealed so bomb renders
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (gridRef.current[r][c].hasMine) {
            gridRef.current[r][c].state = 'revealed';
          }
        }
      }
      setGameOverState('lost');
      playSound('wrong');
      onGameOver();
      return true;
    }

    // Reveal clicked cell
    cell.state = 'revealed';
    revealedRef.current++;

    // If has adjacent mines, stop (no flood fill)
    if (cell.adjacentMines > 0) return false;

    // BFS flood fill for empty cells (adjacentMines === 0)
    // Start from neighbors of the already-revealed start cell
    const visited = new Set<number>([row * size + col]);
    const queue: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const nidx = nr * size + nc;
          if (!visited.has(nidx)) {
            visited.add(nidx);
            queue.push(nidx);
          }
        }
      }
    }

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const r = Math.floor(idx / size);
      const c = idx % size;
      const cur = gridRef.current[r][c];

      // Skip mines (hasMine) and already-revealed / flagged cells
      if (cur.hasMine || cur.state !== 'hidden') continue;

      cur.state = 'revealed';
      revealedRef.current++;

      // Only expand if this cell is also empty (no adjacent mines)
      if (cur.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
              const nidx = nr * size + nc;
              if (!visited.has(nidx)) {
                visited.add(nidx);
                queue.push(nidx);
              }
            }
          }
        }
      }
    }

    return false;
  };

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || gameOverState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(10, width * 0.015);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.15);
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;

    // Check flag mode button
    const flagBtnY = gridY + availSize + 10;
    if (y >= flagBtnY && y <= flagBtnY + 35) {
      flagModeRef.current = !flagModeRef.current;
      return;
    }

    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || col >= size || row < 0 || row >= size) return;

    const cell = gridRef.current[row][col];

    if (flagModeRef.current) {
      if (cell.state === 'hidden') {
        cell.state = 'flagged';
        playSound('shoot');
      } else if (cell.state === 'flagged') {
        cell.state = 'hidden';
      }
      return;
    }

    // Only handle hidden cells
    if (cell.state !== 'hidden') return;

    // Call revealCell - returns true if mine was hit (game over)
    const hitMine = revealCell(row, col);
    if (hitMine) return;

    playSound('correct');
    onScore(1);

    // Check win condition
    const totalSafe = size * size - mineCountRef.current;
    if (revealedRef.current >= totalSafe) {
      setGameOverState('won');
      playSound('correct');
      onScore(50);
      setTimeout(() => setLevel(prev => prev + 1), 2000);
    }
  }, [isPlaying, gameOverState, onScore, onGameOver, width, height]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(10, width * 0.015);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.15);
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;
    const flags = gridRef.current.flat().filter(c => c.state === 'flagged').length;
    const totalMines = gridRef.current.flat().filter(c => c.hasMine).length || mineCountRef.current;

    // Info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`扫雷  第${level}关  |  💣${totalMines - flags}  🚩${flags}`, width / 2, topOffset - 12);
    ctx.shadowBlur = 0;

    // Draw grid
    const numColors = ['', '#3b82f6', '#22c55e', '#ef4444', '#7c3aed', '#a16207', '#06b6d4', '#000', '#6b7280'];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = gridRef.current[r][c];
        const cx = gridX + c * cellSize;
        const cy = gridY + r * cellSize;
        const gap = 2;
        const w = cellSize - gap * 2;

        if (cell.state === 'hidden') {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
          ctx.beginPath(); ctx.roundRect(cx + gap, cy + gap, w, w, 4); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        } else if (cell.state === 'flagged') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.beginPath(); ctx.roundRect(cx + gap, cy + gap, w, w, 4); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `${w * 0.5}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🚩', cx + cellSize / 2, cy + cellSize / 2);
        } else {
          // Revealed cell — show bomb if hasMine, otherwise show number
          if (cell.hasMine) {
            ctx.fillStyle = 'rgba(220,38,38,0.8)';
            ctx.beginPath(); ctx.roundRect(cx + gap, cy + gap, w, w, 4); ctx.fill();
            ctx.font = `${w * 0.55}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('💣', cx + cellSize / 2, cy + cellSize / 2);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.roundRect(cx + gap, cy + gap, w, w, 4); ctx.fill();
            if (cell.adjacentMines > 0) {
              ctx.fillStyle = numColors[cell.adjacentMines] || '#fff';
              ctx.font = `bold ${w * 0.5}px sans-serif`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.shadowColor = 'black'; ctx.shadowBlur = 2;
              ctx.fillText(String(cell.adjacentMines), cx + cellSize / 2, cy + cellSize / 2);
              ctx.shadowBlur = 0;
            }
          }
        }
      }
    }

    // Flag mode button
    const flagBtnY = gridY + availSize + 10;
    ctx.fillStyle = flagModeRef.current ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.roundRect(width / 2 - 60, flagBtnY, 120, 35, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(flagModeRef.current ? '🚩 标雷模式' : '👆 挖掘模式', width / 2, flagBtnY + 17);

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.min(14, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🚩旗子 = 标记地雷位置  |  切换模式来挖格或标雷', width / 2, flagBtnY + 55);

    // Game over
    if (gameOverState) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = gameOverState === 'won' ? '#4ade80' : '#ef4444';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText(gameOverState === 'won' ? '🎉 扫雷成功！' : '💥 踩到地雷！', width / 2, height / 2 - 10);
      if (gameOverState === 'won') {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.min(28, width * 0.03)}px sans-serif`;
        ctx.fillText('准备下一关...', width / 2, height / 2 + 40);
      }
      ctx.shadowBlur = 0;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState]);

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
