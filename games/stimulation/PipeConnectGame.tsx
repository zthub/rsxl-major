import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface PipeNode {
  row: number;
  col: number;
  connections: string[]; // 'top','right','bottom','left'
  type: 'straight' | 'curve' | 'tee' | 'cross' | 'end';
}

type Direction = 'top' | 'right' | 'bottom' | 'left';
const OPPOSITE: Record<Direction, Direction> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const DIR_DELTA: Record<Direction, [number, number]> = { top: [-1, 0], right: [0, 1], bottom: [1, 0], left: [0, -1] };

// Generate puzzle: first find a valid solution path, then scramble the pieces
const generatePuzzle = (rows: number, cols: number) => {
  // --- Step 1: Find solution path using BFS from (0,0) to (rows-1, cols-1) ---
  const visited = new Set<string>();
  const parent: Map<string, [number, number]> = new Map();
  const queue: [number, number][] = [[0, 0]];
  visited.add('0,0');

  const DIR_LIST: Direction[] = ['top', 'right', 'bottom', 'left'];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (r === rows - 1 && c === cols - 1) break; // reached end

    // Shuffle directions for randomness
    const dirs = [...DIR_LIST].sort(() => Math.random() - 0.5);
    for (const dir of dirs) {
      const [dr, dc] = DIR_DELTA[dir];
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key)) {
        visited.add(key);
        parent.set(key, [r, c]);
        queue.push([nr, nc]);
      }
    }
  }

  // --- Step 2: Reconstruct path from end to start ---
  const pathCells = new Set<string>();
  const pathOrder: [number, number][] = [];
  let cur: [number, number] | undefined = [rows - 1, cols - 1];
  while (cur) {
    pathCells.add(`${cur[0]},${cur[1]}`);
    pathOrder.push(cur);
    cur = parent.get(`${cur[0]},${cur[1]}`);
  }
  pathOrder.reverse(); // now from start to end

  // --- Step 3: Build grid with correct connections for the solution path ---
  const grid: PipeNode[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r, col: c, connections: [] as Direction[], type: 'end' as PipeNode['type']
    }))
  );

  // Set path cells to have correct connections (for solution)
  for (let i = 0; i < pathOrder.length; i++) {
    const [r, c] = pathOrder[i];
    const connections: Direction[] = [];

    if (i > 0) {
      const [pr, pc] = pathOrder[i - 1];
      if (pr < r) connections.push('top');
      else if (pr > r) connections.push('bottom');
      else if (pc < c) connections.push('left');
      else if (pc > c) connections.push('right');
    }
    if (i < pathOrder.length - 1) {
      const [nr, nc] = pathOrder[i + 1];
      if (nr < r) connections.push('top');
      else if (nr > r) connections.push('bottom');
      else if (nc < c) connections.push('left');
      else if (nc > c) connections.push('right');
    }

    // Determine type
    let type: PipeNode['type'] = 'end';
    if (connections.length === 2) {
      const s = [...connections].sort();
      if ((s[0] === 'bottom' && s[1] === 'top') || (s[0] === 'left' && s[1] === 'right')) {
        type = 'straight';
      } else {
        type = 'curve';
      }
    } else if (connections.length === 3) type = 'tee';
    else if (connections.length === 4) type = 'cross';

    grid[r][c] = { row: r, col: c, connections, type };
  }

  // --- Step 4: Set random connections for non-path cells ---
  const allConnections: Direction[][] = [
    ['top', 'bottom'], ['left', 'right'],
    ['top', 'right'], ['right', 'bottom'],
    ['bottom', 'left'], ['left', 'top'],
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!pathCells.has(`${r},${c}`)) {
        const conn = allConnections[Math.floor(Math.random() * allConnections.length)];
        grid[r][c] = { row: r, col: c, connections: conn, type: 'straight' };
      }
    }
  }

  // --- Step 5: Scramble ALL cells (including path cells) by random rotation ---
  // This guarantees the puzzle is solvable (solution exists) but starts scrambled
  const dirOrder: Direction[] = ['top', 'right', 'bottom', 'left'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rotations = Math.floor(Math.random() * 4); // 0-3 random rotations
      for (let i = 0; i < rotations; i++) {
        grid[r][c].connections = grid[r][c].connections.map(d =>
          dirOrder[(dirOrder.indexOf(d) + 1) % 4]
        );
      }
    }
  }

  return { grid, pathCells };
};

export const PipeConnectGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const gridRef = useRef<PipeNode[][]>([]);
  const pathRef = useRef<Set<string>>(new Set());
  const connectedRef = useRef<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);

  const getGridConfig = () => {
    if (level <= 2) return { rows: 4, cols: 5 };
    if (level <= 4) return { rows: 5, cols: 6 };
    return { rows: 6, cols: 7 };
  };

  const initGame = useCallback(() => {
    const { rows, cols } = getGridConfig();
    const { grid, pathCells } = generatePuzzle(rows, cols);
    gridRef.current = grid;
    pathRef.current = pathCells;
    connectedRef.current = new Set();
    setCompleted(false);
    checkConnections();
  }, [level]);

  const rotatePipe = (row: number, col: number) => {
    const dirOrder: Direction[] = ['top', 'right', 'bottom', 'left'];
    gridRef.current[row][col].connections =
      gridRef.current[row][col].connections.map(d =>
        dirOrder[(dirOrder.indexOf(d) + 1) % 4]
      );
  };

  const checkConnections = () => {
    const rows = gridRef.current.length;
    const cols = gridRef.current[0].length;
    const connected = new Set<string>();
    const queue: [number, number][] = [[0, 0]];
    connected.add('0,0');

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const cell = gridRef.current[r][c];
      for (const dir of cell.connections) {
        const [dr, dc] = DIR_DELTA[dir];
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !connected.has(key)) {
          const neighbor = gridRef.current[nr][nc];
          if (neighbor.connections.includes(OPPOSITE[dir])) {
            connected.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
    connectedRef.current = connected;
  };

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

    const rows = gridRef.current.length;
    const cols = gridRef.current[0].length;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(10, width * 0.015);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.1);
    const cellSize = Math.min(availSize / cols, availSize / rows);
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    const gridX = (width - gridW) / 2;
    const gridY = topOffset;

    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY) / cellSize);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    rotatePipe(row, col);
    playSound('shoot');
    onScore(1);
    checkConnections();

    // Win: (rows-1, cols-1) is connected AND is on the solution path
    const endKey = `${rows - 1},${cols - 1}`;
    if (connectedRef.current.has(endKey) && pathRef.current.has(endKey)) {
      setCompleted(true);
      playSound('correct');
      onScore(30);
      setTimeout(() => setLevel(prev => prev + 1), 2000);
    }
  }, [isPlaying, completed, onScore, width, height]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    const rows = gridRef.current.length;
    const cols = gridRef.current[0]?.length || 0;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(10, width * 0.015);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.1);
    const cellSize = Math.min(availSize / cols, availSize / rows);
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    const gridX = (width - gridW) / 2;
    const gridY = topOffset;

    // Info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`接水管  第${level}关  |  点击管道旋转`, width / 2, topOffset - 12);
    ctx.shadowBlur = 0;

    // Legend
    const legX = width - 90;
    ctx.font = `${Math.min(12, width * 0.014)}px sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('灰色=未连通', legX, topOffset);
    ctx.fillStyle = '#60a5fa';
    ctx.fillText('蓝色=已连通', legX, topOffset + 18);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('绿色=解通路', legX, topOffset + 36);

    // Start/End markers
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold ${Math.min(14, cellSize * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('起点', gridX + cellSize / 2, gridY - 6);
    ctx.fillStyle = '#f87171';
    ctx.fillText('终点', gridX + (cols - 0.5) * cellSize, gridY + gridH + 16);

    // Draw cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = gridRef.current[r]?.[c];
        if (!cell) continue;
        const cx = gridX + (c + 0.5) * cellSize;
        const cy = gridY + (r + 0.5) * cellSize;
        const pipeR = cellSize * 0.48;
        const isConnected = connectedRef.current.has(`${r},${c}`);
        const isOnPath = pathRef.current.has(`${r},${c}`);

        // Background: gray=disconnected, blue=connected, green=path cell connected
        if (isConnected && isOnPath) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        } else if (isConnected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
        }
        ctx.beginPath();
        ctx.roundRect(cx - pipeR, cy - pipeR, pipeR * 2, pipeR * 2, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pipe color
        const pipeColor = isConnected
          ? (isOnPath ? '#4ade80' : '#60a5fa')
          : '#94a3b8';
        const pipeWidth = pipeR * 0.28;
        ctx.strokeStyle = pipeColor;
        ctx.lineWidth = pipeWidth;
        ctx.lineCap = 'round';

        for (const dir of cell.connections) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          switch (dir) {
            case 'top':    ctx.lineTo(cx, cy - pipeR * 0.85); break;
            case 'bottom': ctx.lineTo(cx, cy + pipeR * 0.85); break;
            case 'left':   ctx.lineTo(cx - pipeR * 0.85, cy); break;
            case 'right':  ctx.lineTo(cx + pipeR * 0.85, cy); break;
          }
          ctx.stroke();
        }

        // Center hub
        ctx.fillStyle = pipeColor;
        ctx.beginPath();
        ctx.arc(cx, cy, pipeWidth * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.min(14, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('旋转管道，让蓝色管道从起点连通到终点', width / 2, gridY + gridH + 40);

    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 管道连通！', width / 2, height / 2 - 10);
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
