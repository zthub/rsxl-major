import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

const TILE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#f43f5e', '#06b6d4', '#84cc16',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#8b5cf6', '#10b981', '#e11d48', '#0ea5e9'];

export const SlidePuzzleGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const tilesRef = useRef<number[]>([]);
  const emptyRef = useRef(0);
  const sizeRef = useRef(3);
  const movesRef = useRef(0);
  const [completed, setCompleted] = useState(false);
  const animatingRef = useRef<{ fromIdx: number; toIdx: number; progress: number } | null>(null);

  const getGridSize = () => (level <= 2 ? 3 : level <= 5 ? 4 : 5);

  const shuffle = (arr: number[]): number[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const isSolvable = (tiles: number[], size: number): boolean => {
    let inversions = 0;
    const flat = tiles.filter(t => t !== 0);
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i] > flat[j]) inversions++;
      }
    }
    if (size % 2 === 1) return inversions % 2 === 0;
    const emptyRow = Math.floor(tiles.indexOf(0) / size);
    return (inversions + (size - emptyRow)) % 2 === 0;
  };

  const initGame = useCallback(() => {
    const size = getGridSize();
    sizeRef.current = size;
    const total = size * size;
    let tiles: number[];

    // Generate solvable puzzle
    do {
      tiles = shuffle([...Array(total).keys()]);
    } while (!isSolvable(tiles, size) || tiles.join(',') === [...Array(total).keys()].join(','));

    tilesRef.current = tiles;
    emptyRef.current = tiles.indexOf(0);
    movesRef.current = 0;
    setCompleted(false);
    animatingRef.current = null;
  }, [level]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || completed || animatingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(15, width * 0.02);
    const availSize = Math.min(width - padding * 2, (height - topOffset - height * 0.12));
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;

    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || col >= size || row < 0 || row >= size) return;

    const clickedIdx = row * size + col;
    const emptyIdx = emptyRef.current;
    const emptyRow = Math.floor(emptyIdx / size);
    const emptyCol = emptyIdx % size;

    // Check if adjacent to empty
    const isAdjacent = (Math.abs(row - emptyRow) + Math.abs(col - emptyCol)) === 1;
    if (!isAdjacent) return;

    // Animate
    animatingRef.current = { fromIdx: clickedIdx, toIdx: emptyIdx, progress: 0 };
    const newTiles = [...tilesRef.current];
    [newTiles[clickedIdx], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[clickedIdx]];
    tilesRef.current = newTiles;
    emptyRef.current = clickedIdx;
    movesRef.current++;
    playSound('shoot');

    // Check win
    const won = newTiles.every((t, i) => t === (i + 1) % newTiles.length);
    if (won) {
      setTimeout(() => {
        setCompleted(true);
        playSound('correct');
        onScore(50 + Math.max(0, 30 - movesRef.current));
        setTimeout(() => setLevel(prev => prev + 1), 2000);
      }, 300);
    }
  }, [isPlaying, completed, onScore, width, height]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    // Animate slide
    if (animatingRef.current) {
      animatingRef.current.progress += 0.15;
      if (animatingRef.current.progress >= 1) animatingRef.current = null;
    }

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(15, width * 0.02);
    const availSize = Math.min(width - padding * 2, (height - topOffset - height * 0.12));
    const cellSize = availSize / size;
    const gridX = (width - availSize) / 2;
    const gridY = topOffset;

    // Info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`数字华容道 ${size}×${size}  第${level}关  |  步数: ${movesRef.current}`, width / 2, topOffset - 12);
    ctx.shadowBlur = 0;

    // Draw tiles
    const gap = 4;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = r * size + c;
        const val = tilesRef.current[idx];
        if (val === 0) {
          // Empty slot
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.roundRect(gridX + c * cellSize + gap, gridY + r * cellSize + gap, cellSize - gap * 2, cellSize - gap * 2, 8);
          ctx.fill();
          continue;
        }

        let drawX = gridX + c * cellSize + gap;
        let drawY = gridY + r * cellSize + gap;

        // Animation
        if (animatingRef.current && animatingRef.current.toIdx === idx) {
          const fromC = animatingRef.current.fromIdx % size;
          const fromR = Math.floor(animatingRef.current.fromIdx / size);
          const p = animatingRef.current.progress;
          drawX = gridX + (fromC + (c - fromC) * p) * cellSize + gap;
          drawY = gridY + (fromR + (r - fromR) * p) * cellSize + gap;
        }

        const w = cellSize - gap * 2;

        // Tile
        const colorIdx = (val - 1) % TILE_COLORS.length;
        ctx.fillStyle = TILE_COLORS[colorIdx];
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, w, w, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Highlight for correct position
        if (val === idx + 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Number
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${w * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(String(val), drawX + w / 2, drawY + w / 2);
        ctx.shadowBlur = 0;
      }
    }

    // Completed
    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 华容道完成！', width / 2, height / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(28, width * 0.03)}px sans-serif`;
      ctx.fillText(`用了 ${movesRef.current} 步`, width / 2, height / 2 + 25);
      ctx.fillText('准备下一关...', width / 2, height / 2 + 60);
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
