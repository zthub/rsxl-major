import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

// Helper to compute grid coordinates from client coordinates
const getGridCoords = (clientX: number, clientY: number, width: number, height: number, gridSize: number, canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const topOffset = Math.max(70, height * 0.09);
  const gridArea = Math.min(width * 0.6, height - topOffset - 60);
  const cellSize = gridArea / gridSize;
  const gridX = (width - gridArea) / 2;
  const gridY = topOffset;
  const col = Math.floor((x - gridX) / cellSize);
  const row = Math.floor((y - gridY) / cellSize);
  return { col, row, cellSize, gridX, gridY, gridArea };
};

// Word Search Puzzle - 找隐藏的汉字/词语

const WORD_SETS = [
  ['苹果', '香蕉', '葡萄', '西瓜', '草莓', '樱桃', '桃子', '橘子', '柠檬', '芒果'],
  ['兔子', '老虎', '狮子', '熊猫', '大象', '猴子', '长颈鹿', '企鹅', '海豚', '孔雀'],
  ['红色', '蓝色', '绿色', '黄色', '紫色', '白色', '黑色', '橙色', '粉色', '金色'],
  ['春天', '夏天', '秋天', '冬天', '太阳', '月亮', '星星', '云朵', '雨滴', '雪花'],
  ['飞机', '火车', '轮船', '汽车', '自行车', '火箭', '潜水艇', '直升机', '卡车', '公交车'],
];

const FILLER_CHARS = '天地人和大小上下左右东南西北山水花鸟鱼虫风雪雨电光日辰年月时分秒新旧好坏美丑明暗轻重快慢高低远近长短深浅宽窄粗细厚薄冷热干湿甜苦酸辣咸淡香臭软硬松紧开关进退来去飞跑走跳坐站立行读写画唱歌乐玩耍吃喝睡觉醒笑哭怒喜悲恐惊'.split('');

interface FoundWord {
  word: string;
  cells: [number, number][];
}

export const WordSearchGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const gridRef = useRef<string[][]>([]);
  const gridSizeRef = useRef(8);
  const wordsRef = useRef<string[]>([]);
  const foundRef = useRef<FoundWord[]>([]);
  const selectingRef = useRef<[number, number][]>([]);
  const isSelectingRef = useRef(false);
  const startPosRef = useRef<[number, number] | null>(null);

  const getWordCount = () => Math.min(3 + level, 6);
  const getGridSize = () => Math.min(6 + Math.ceil(level / 2), 10);

  const canPlace = (grid: string[][], word: string, row: number, col: number, dr: number, dc: number, size: number): boolean => {
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
    }
    return true;
  };

  const placeWord = (grid: string[][], word: string, row: number, col: number, dr: number, dc: number) => {
    const cells: [number, number][] = [];
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      grid[r][c] = word[i];
      cells.push([r, c]);
    }
    return cells;
  };

  const initGame = useCallback(() => {
    const gridSize = getGridSize();
    gridSizeRef.current = gridSize;
    const wordCount = getWordCount();

    const wordSetIdx = (level - 1) % WORD_SETS.length;
    const allWords = [...WORD_SETS[wordSetIdx]].sort(() => Math.random() - 0.5);
    const selectedWords = allWords.slice(0, wordCount).filter(w => w.length <= gridSize);

    // Limit to words that fit
    const words = selectedWords.slice(0, Math.min(selectedWords.length, wordCount));
    wordsRef.current = words;

    // Build grid
    const grid: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));

    const directions = [[0, 1], [1, 0], [1, 1], [-1, 1]]; // right, down, diag-right, diag-left
    foundRef.current = [];

    for (const word of words) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const row = Math.floor(Math.random() * gridSize);
        const col = Math.floor(Math.random() * gridSize);
        if (canPlace(grid, word, row, col, dir[0], dir[1], gridSize)) {
          placeWord(grid, word, row, col, dir[0], dir[1]);
          placed = true;
        }
      }
    }

    // Fill empty cells
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (grid[r][c] === '') {
          grid[r][c] = FILLER_CHARS[Math.floor(Math.random() * FILLER_CHARS.length)];
        }
      }
    }

    gridRef.current = grid;
    selectingRef.current = [];
    isSelectingRef.current = false;
    startPosRef.current = null;
  }, [level]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const isInLine = (start: [number, number], end: [number, number]) => {
    const dr = end[0] - start[0];
    const dc = end[1] - start[1];
    if (dr === 0 && dc === 0) return true;
    if (dr === 0 || dc === 0) return true;
    if (Math.abs(dr) === Math.abs(dc)) return true;
    return false;
  };

  const getLineCells = (start: [number, number], end: [number, number]): [number, number][] => {
    const cells: [number, number][] = [];
    const dr = Math.sign(end[0] - start[0]);
    const dc = Math.sign(end[1] - start[1]);
    const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]));
    for (let i = 0; i <= steps; i++) {
      cells.push([start[0] + dr * i, start[1] + dc * i]);
    }
    return cells;
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use client coordinates for reliable tracking
    const x = e.clientX;
    const y = e.clientY;

    const size = gridSizeRef.current;
    const { col, row } = getGridCoords(x, y, width, height, size, canvas);
    if (col >= 0 && col < size && row >= 0 && row < size) {
      isSelectingRef.current = true;
      startPosRef.current = [row, col];
      selectingRef.current = [[row, col]];
      canvas.setPointerCapture(e.pointerId);
    }
  }, [isPlaying, width, height]);

  const handlePointerMove = useCallback((e: MouseEvent) => {
    if (!isSelectingRef.current || !startPosRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use client coordinates directly for reliable tracking
    const x = e.clientX;
    const y = e.clientY;

    const size = gridSizeRef.current;
    const { col, row } = getGridCoords(x, y, width, height, size, canvas);
    if (col >= 0 && col < size && row >= 0 && row < size) {
      const end: [number, number] = [row, col];
      if (isInLine(startPosRef.current, end)) {
        selectingRef.current = getLineCells(startPosRef.current, end);
      }
    }
  }, [width, height]);

  const handlePointerUp = useCallback(() => {
    if (!isSelectingRef.current || selectingRef.current.length < 2) {
      selectingRef.current = [];
      isSelectingRef.current = false;
      startPosRef.current = null;
      return;
    }

    // Check if selected cells form a word
    const selectedWord = selectingRef.current.map(([r, c]) => gridRef.current[r][c]).join('');
    const reverseWord = selectedWord.split('').reverse().join('');

    const matchedWord = wordsRef.current.find(w => {
      if (foundRef.current.some(f => f.word === w)) return false;
      return w === selectedWord || w === reverseWord;
    });

    if (matchedWord) {
      foundRef.current.push({ word: matchedWord, cells: [...selectingRef.current] });
      playSound('correct');
      onScore(20);

      if (foundRef.current.length === wordsRef.current.length) {
        playSound('correct');
        onScore(30);
        setTimeout(() => setLevel(prev => prev + 1), 1500);
      }
    } else {
      playSound('wrong');
    }

    selectingRef.current = [];
    isSelectingRef.current = false;
    startPosRef.current = null;
  }, [onScore]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    const size = gridSizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const gridArea = Math.min(width * 0.6, height - topOffset - 60);
    const cellSize = gridArea / size;
    const gridX = (width - gridArea) / 2;
    const gridY = topOffset;

    // Info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(20, width * 0.022)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`找词语  第${level}关  |  已找到: ${foundRef.current.length}/${wordsRef.current.length}`, width / 2, topOffset - 12);
    ctx.shadowBlur = 0;

    // Build found cells set for highlighting
    const foundCellSet = new Set<string>();
    foundRef.current.forEach(f => f.cells.forEach(([r, c]) => foundCellSet.add(`${r},${c}`)));

    const selectCellSet = new Set(selectingRef.current.map(([r, c]) => `${r},${c}`));

    // Draw grid
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cx = gridX + c * cellSize;
        const cy = gridY + r * cellSize;
        const key = `${r},${c}`;
        const gap = 2;
        const w = cellSize - gap * 2;

        if (selectCellSet.has(key)) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
        } else if (foundCellSet.has(key)) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
        }
        ctx.beginPath();
        ctx.roundRect(cx + gap, cy + gap, w, w, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = foundCellSet.has(key) ? '#4ade80' : selectCellSet.has(key) ? '#93c5fd' : '#e2e8f0';
        ctx.font = `bold ${w * 0.55}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.fillText(gridRef.current[r][c], cx + w / 2, cy + w / 2);
        ctx.shadowBlur = 0;
      }
    }

    // Word list (below grid)
    const listX = Math.min(width - 150, gridX + gridArea + 20);
    const listY = topOffset + 10;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(18, width * 0.02)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText('📋 词语列表:', listX, listY);
    ctx.shadowBlur = 0;

    wordsRef.current.forEach((word, i) => {
      const found = foundRef.current.some(f => f.word === word);
      const wy = listY + 30 + i * 35;
      ctx.fillStyle = found ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(listX, wy - 12, 120, 28, 6);
      ctx.fill();

      ctx.fillStyle = found ? '#4ade80' : '#cbd5e1';
      ctx.font = `bold ${Math.min(18, width * 0.02)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${found ? '✅' : '⬜'} ${word}`, listX + 8, wy + 6);
    });

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.min(14, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('拖拽选择隐藏在方格中的词语', width / 2, gridY + gridArea + 20);

    // All found
    if (foundRef.current.length === wordsRef.current.length && wordsRef.current.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(48, width * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 全部找到！', width / 2, height / 2);
      ctx.shadowBlur = 0;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level]);

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

  // Document-level mouse events for reliable drag tracking
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e);
    const onMouseUp = () => handlePointerUp();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      style={{ touchAction: 'none' }}
      className="block cursor-pointer"
    />
  );
};
