import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GameComponentProps } from '../../types';
import { playSound } from '../../utils/gameUtils';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

type Direction = 'up' | 'down' | 'left' | 'right';
type TrainingMode = 'convergence' | 'divergence';

export const FusionEChartGame: React.FC<GameComponentProps> = ({
  width,
  height,
  isPlaying,
  onScore,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Game state
  const [offset, setOffset] = useState(2);        // Red/blue global shift
  const [historyOffset, setHistoryOffset] = useState(2);
  const [mode, setMode] = useState<TrainingMode>('convergence');
  const [direction, setDirection] = useState<Direction>('up');

  // Dot parameters
  const dotRadius = 1.2;
  const disparity = 3; // Extra shift for E-area dots (stereoscopic depth)

  // All dots share ONE base pattern (key to stereogram)
  const baseDotsRef = useRef<{ x: number; y: number }[]>([]);
  const maskRef = useRef<boolean[][]>([]);

  const panelSizeRatio = 0.35;
  const panelRef = useRef<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 0 });

  // Generate E mask in center 80% of the panel
  const updateEMask = useCallback((dir: Direction, size: number) => {
    const margin = size * 0.1;
    const eSize = size - margin * 2;

    const grid: boolean[][] = Array.from(
      { length: Math.ceil(size) },
      () => Array(Math.ceil(size)).fill(false)
    );
    const thickness = eSize / 5;

    for (let x = 0; x < eSize; x++) {
      for (let y = 0; y < eSize; y++) {
        let isInside = false;
        if (x < thickness) isInside = true;
        if (y < thickness) isInside = true;
        if (y > eSize / 2 - thickness / 2 && y < eSize / 2 + thickness / 2) isInside = true;
        if (y > eSize - thickness) isInside = true;

        if (isInside) {
          let tx = x, ty = y;
          if (dir === 'left') tx = eSize - 1 - x;
          else if (dir === 'up') { tx = y; ty = eSize - 1 - x; }
          else if (dir === 'down') { tx = eSize - 1 - y; ty = x; }

          const fx = Math.floor(tx + margin);
          const fy = Math.floor(ty + margin);
          if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
            grid[fx][fy] = true;
          }
        }
      }
    }
    maskRef.current = grid;
  }, []);

  const refreshGraphic = useCallback((newDir?: Direction) => {
    const dir = newDir || (['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)] as Direction);
    setDirection(dir);

    const size = Math.floor(Math.min(width, height) * panelSizeRatio);
    const px = (width - size) / 2;
    const py = (height - size) / 2;
    panelRef.current = { x: px, y: py, size };

    updateEMask(dir, size);

    // ONE set of random dots for the entire panel
    // This same set will be drawn 3 times: black, red(shifted), blue(shifted)
    const dots: { x: number; y: number }[] = [];
    const count = Math.floor((size * size) * 0.04); // 4% density
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * size,
        y: Math.random() * size,
      });
    }
    baseDotsRef.current = dots;
  }, [width, height, updateEMask]);

  const handleChoice = (choice: Direction) => {
    if (!isPlaying) return;
    if (choice === direction) {
      playSound('correct');
      onScore(10);
      setHistoryOffset(offset);
      // Correct: increase offset by 1 (harder to fuse)
      setOffset(prev => Math.min(prev + 1, 40));
      refreshGraphic();
    } else {
      playSound('wrong');
      // Wrong: return to previous offset
      setOffset(historyOffset);
      refreshGraphic();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowUp') handleChoice('up');
      else if (e.key === 'ArrowDown') handleChoice('down');
      else if (e.key === 'ArrowLeft') handleChoice('left');
      else if (e.key === 'ArrowRight') handleChoice('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, direction, offset, historyOffset]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f8b4d9';
    ctx.fillRect(0, 0, width, height);

    const { x: px, y: py, size } = panelRef.current;
    if (size <= 0) return;

    if (!isPlaying) {
      ctx.fillStyle = '#666';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('准备开始', width / 2, height / 2);
      return;
    }

    const shift = offset;
    const dots = baseDotsRef.current;
    const mask = maskRef.current;

    const colorRed = '#ff3333';
    const colorBlue = '#33ccff';
    const colorBlack = '#222';

    // --- LAYER 1: Black dots (static, no shift) ---
    // Covers the full panel, provides the base interference pattern
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      ctx.fillStyle = colorBlack;
      ctx.beginPath();
      ctx.arc(px + d.x, py + d.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- LAYER 2: Red dots (entire panel shifted RIGHT) ---
    // In the E-area, dots get an extra disparity shift
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const ix = Math.floor(d.x);
      const iy = Math.floor(d.y);
      const inE = mask[ix] && mask[ix][iy];

      const extraShift = inE ? disparity : 0;
      const redX = px + d.x + shift + extraShift;

      ctx.fillStyle = colorRed;
      ctx.beginPath();
      ctx.arc(redX, py + d.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- LAYER 3: Blue dots (entire panel shifted LEFT) ---
    // In the E-area, dots get an extra disparity shift (opposite direction)
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const ix = Math.floor(d.x);
      const iy = Math.floor(d.y);
      const inE = mask[ix] && mask[ix][iy];

      const extraShift = inE ? disparity : 0;
      const blueX = px + d.x - shift - extraShift;

      ctx.fillStyle = colorBlue;
      ctx.beginPath();
      ctx.arc(blueX, py + d.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, offset, mode, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [width, height]);

  useEffect(() => {
    if (isPlaying) {
      refreshGraphic();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, width, height]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#f8b4d9] overflow-hidden select-none">
      {/* Top controls */}
      <div className="absolute top-4 left-0 right-0 z-30 flex justify-center gap-4 px-4">
        <div className="flex bg-white/40 backdrop-blur-md rounded-2xl p-1 shadow-inner border border-white/20">
          {(['convergence', 'divergence'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === m ? 'bg-brand-blue text-white shadow-lg' : 'text-slate-600'
              }`}
            >
              {m === 'convergence' ? '辐辏训练' : '开散训练'}
            </button>
          ))}
        </div>

        <div className="flex items-center px-4 py-1.5 bg-white/40 backdrop-blur-md rounded-2xl text-[10px] font-bold text-slate-700 border border-white/20">
          偏移: {offset}px
        </div>
      </div>

      <canvas ref={canvasRef} className="flex-1 block touch-none" />

      {/* Bottom buttons */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="grid grid-cols-3 gap-4 pointer-events-auto bg-white/30 backdrop-blur-lg p-4 rounded-3xl shadow-xl border border-white/40">
          <div />
          <button onClick={() => handleChoice('up')} className="w-14 h-14 bg-white/50 hover:bg-white rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all">
            <ChevronUp size={32} className="text-slate-700" />
          </button>
          <div />

          <button onClick={() => handleChoice('left')} className="w-14 h-14 bg-white/50 hover:bg-white rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all">
            <ChevronLeft size={32} className="text-slate-700" />
          </button>
          <button onClick={() => handleChoice('down')} className="w-14 h-14 bg-white/50 hover:bg-white rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all">
            <ChevronDown size={32} className="text-slate-700" />
          </button>
          <button onClick={() => handleChoice('right')} className="w-14 h-14 bg-white/50 hover:bg-white rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all">
            <ChevronRight size={32} className="text-slate-700" />
          </button>
        </div>
      </div>
    </div>
  );
};
