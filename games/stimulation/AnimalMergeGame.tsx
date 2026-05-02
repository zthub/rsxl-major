import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

// 动物合成链：农场 → 森林 → 神话
const ANIMALS = [
  { emoji: '🐣', value: 2 },    // 小鸡
  { emoji: '🐥', value: 4 },    // 雏鸡
  { emoji: '🐱', value: 8 },    // 小猫
  { emoji: '🐶', value: 16 },   // 小狗
  { emoji: '🐑', value: 32 },   // 小羊
  { emoji: '🐴', value: 64 },   // 小马
  { emoji: '🐮', value: 128 },  // 奶牛
  { emoji: '🐻', value: 256 },  // 大熊
  { emoji: '🦁', value: 512 },  // 狮子
  { emoji: '🐉', value: 1024 }, // 神龙
  { emoji: '🌟', value: 2048 }, // 星辰
];

const ANIMAL_MAP = new Map(ANIMALS.map(a => [a.value, a.emoji]));

const COLORS: Record<number, string> = {
  0: 'rgba(255,255,255,0.08)',
  2: '#fef3c7',
  4: '#fde68a',
  8: '#fdba74',
  16: '#fb923c',
  32: '#f87171',
  64: '#ef4444',
  128: '#a78bfa',
  256: '#8b5cf6',
  512: '#6d28d9',
  1024: '#4c1d95',
  2048: '#fbbf24',
};

type Direction = 'up' | 'down' | 'left' | 'right';
type AnimPhase = 'idle' | 'slide' | 'pop';

interface TileMovement {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  value: number;
  consumed: boolean;
}

const SLIDE_MS = 100;
const POP_MS = 80;
const WIN_ADVANCE_MS = 2000;

const isTouchDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth <= 768;

export const AnimalMergeGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const gridRef = useRef<number[][]>([]);
  const sizeRef = useRef(4);
  const scoreRef = useRef(0);
  const targetRef = useRef(64);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 动画状态
  const animPhaseRef = useRef<AnimPhase>('idle');
  const animStartRef = useRef(0);
  const movementsRef = useRef<TileMovement[]>([]);
  const mergeCellsRef = useRef<{ row: number; col: number }[]>([]);
  const newTileRef = useRef<{ row: number; col: number; value: number } | null>(null);
  const levelAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 胜利画面的"下一关"按钮区域
  const nextBtnRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // 关卡参数
  const getTarget = () => {
    if (level <= 1) return 64;
    if (level <= 2) return 128;
    if (level <= 3) return 256;
    return Math.min(256 * Math.pow(2, Math.floor((level - 3) / 2)), 2048);
  };

  const getGridSize = () => (level <= 3 ? 4 : 5);

  // 添加随机方块，返回新方块信息
  const addRandomTile = (): { row: number; col: number; value: number } | null => {
    const grid = gridRef.current;
    const size = grid.length;
    const empty: [number, number][] = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (grid[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const v = Math.random() < 0.9 ? 2 : 4;
    grid[r][c] = v;
    return { row: r, col: c, value: v };
  };

  const initGame = useCallback(() => {
    const size = getGridSize();
    sizeRef.current = size;
    targetRef.current = Math.min(getTarget(), 2048);
    gridRef.current = Array.from({ length: size }, () => Array(size).fill(0));
    addRandomTile();
    addRandomTile();
    scoreRef.current = 0;
    setWon(false);
    setLost(false);
    animPhaseRef.current = 'idle';
    nextBtnRef.current = null;
    if (levelAdvanceTimerRef.current) {
      clearTimeout(levelAdvanceTimerRef.current);
      levelAdvanceTimerRef.current = null;
    }
  }, [level]);

  // 滑动一行（从左到右），返回结果和移动信息
  const slideLine = (arr: number[]): {
    result: number[];
    points: number;
    movements: { from: number; to: number; value: number; consumed: boolean }[];
  } => {
    const filtered: { v: number; i: number }[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== 0) filtered.push({ v: arr[i], i });
    }

    const result: number[] = [];
    const movements: { from: number; to: number; value: number; consumed: boolean }[] = [];
    let points = 0;
    let fi = 0;
    let di = 0; // destination index

    while (fi < filtered.length) {
      if (fi + 1 < filtered.length && filtered[fi].v === filtered[fi + 1].v) {
        // 合并
        const mergedVal = filtered[fi].v * 2;
        result.push(mergedVal);
        points += mergedVal;
        movements.push({ from: filtered[fi].i, to: di, value: filtered[fi].v, consumed: false });
        movements.push({ from: filtered[fi + 1].i, to: di, value: filtered[fi + 1].v, consumed: true });
        fi += 2;
      } else {
        result.push(filtered[fi].v);
        movements.push({ from: filtered[fi].i, to: di, value: filtered[fi].v, consumed: false });
        fi++;
      }
      di++;
    }

    while (result.length < arr.length) result.push(0);
    return { result, points, movements };
  };

  // 检查是否有可用移动
  const canMove = (): boolean => {
    const grid = gridRef.current;
    const size = grid.length;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === 0) return true;
        if (c < size - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < size - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    return false;
  };

  // 执行移动
  const move = useCallback((dir: Direction) => {
    if (animPhaseRef.current !== 'idle') return;
    if (won || lost) return;

    const grid = gridRef.current;
    const size = grid.length;
    const prev = grid.map(r => [...r]);
    const allMovements: TileMovement[] = [];
    let scoreGain = 0;

    if (dir === 'left') {
      for (let r = 0; r < size; r++) {
        const { result, points, movements } = slideLine(grid[r]);
        grid[r] = result;
        scoreGain += points;
        for (const m of movements) {
          allMovements.push({ fromRow: r, fromCol: m.from, toRow: r, toCol: m.to, value: m.value, consumed: m.consumed });
        }
      }
    } else if (dir === 'right') {
      for (let r = 0; r < size; r++) {
        const rev = [...grid[r]].reverse();
        const { result, points, movements } = slideLine(rev);
        grid[r] = result.reverse();
        scoreGain += points;
        for (const m of movements) {
          allMovements.push({
            fromRow: r, fromCol: size - 1 - m.from,
            toRow: r, toCol: size - 1 - m.to,
            value: m.value, consumed: m.consumed,
          });
        }
      }
    } else if (dir === 'up') {
      for (let c = 0; c < size; c++) {
        const col = grid.map(r => r[c]);
        const { result, points, movements } = slideLine(col);
        for (let r = 0; r < size; r++) grid[r][c] = result[r];
        scoreGain += points;
        for (const m of movements) {
          allMovements.push({ fromRow: m.from, fromCol: c, toRow: m.to, toCol: c, value: m.value, consumed: m.consumed });
        }
      }
    } else {
      // down
      for (let c = 0; c < size; c++) {
        const col = grid.map(r => r[c]).reverse();
        const { result, points, movements } = slideLine(col);
        const final = result.reverse();
        for (let r = 0; r < size; r++) grid[r][c] = final[r];
        scoreGain += points;
        for (const m of movements) {
          allMovements.push({
            fromRow: size - 1 - m.from, fromCol: c,
            toRow: size - 1 - m.to, toCol: c,
            value: m.value, consumed: m.consumed,
          });
        }
      }
    }

    // 检查是否有变化
    let moved = false;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (grid[r][c] !== prev[r][c]) moved = true;

    if (!moved) return;

    // 统计合并目标格
    const mergeCells: { row: number; col: number }[] = [];
    const seen = new Set<string>();
    for (const m of allMovements) {
      if (m.consumed) {
        const key = `${m.toRow},${m.toCol}`;
        if (!seen.has(key)) {
          seen.add(key);
          mergeCells.push({ row: m.toRow, col: m.toCol });
        }
      }
    }

    scoreRef.current += scoreGain;
    onScore(scoreGain);

    const hadMerge = allMovements.some(m => m.consumed);
    if (hadMerge) playSound('correct');
    else playSound('shoot');

    // 启动滑动动画
    animPhaseRef.current = 'slide';
    animStartRef.current = performance.now();
    movementsRef.current = allMovements;
    mergeCellsRef.current = mergeCells;
    newTileRef.current = null;
  }, [won, lost, onScore]);

  // 自动过关计时器
  useEffect(() => {
    if (won && isPlaying) {
      levelAdvanceTimerRef.current = setTimeout(() => {
        setLevel(l => l + 1);
      }, WIN_ADVANCE_MS);
      return () => {
        if (levelAdvanceTimerRef.current) clearTimeout(levelAdvanceTimerRef.current);
      };
    }
  }, [won, isPlaying]);

  // 初始化游戏
  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  // 触摸/指针事件
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || won || lost) return;
    if (animPhaseRef.current !== 'idle') return;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  }, [isPlaying, won, lost]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStartRef.current || !isPlaying || won || lost) return;
    if (animPhaseRef.current !== 'idle') return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const minSwipe = 30;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }, [isPlaying, won, lost, move]);

  // 画布点击（胜利画面按钮）
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!won || !nextBtnRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const btn = nextBtnRef.current;
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      if (levelAdvanceTimerRef.current) clearTimeout(levelAdvanceTimerRef.current);
      setLevel(l => l + 1);
    }
  }, [won]);

  // 键盘事件
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isPlaying || won || lost) return;
      const map: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, won, lost, move]);

  // 渲染循环
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    const now = performance.now();
    const phase = animPhaseRef.current;
    const size = sizeRef.current;
    const topOffset = Math.max(70, height * 0.09);
    const padding = Math.max(15, width * 0.02);
    const availSize = Math.min(width - padding * 2, height - topOffset - height * 0.08);
    const cellSize = availSize / size;
    const gridW = cellSize * size;
    const gridX = (width - gridW) / 2;
    const gridY = topOffset;
    const gap = 4;
    const w = cellSize - gap * 2;

    // 背景
    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    // 顶部信息栏
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 6;
    const targetEmoji = ANIMAL_MAP.get(targetRef.current) || '🏆';
    ctx.fillText(
      `动物消消乐  目标: ${targetEmoji}(${targetRef.current})  第${level}关  |  分数: ${scoreRef.current}`,
      width / 2, topOffset - 12,
    );
    ctx.shadowBlur = 0;

    // 棋盘背景
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(gridX - 6, gridY - 6, gridW + 12, gridW + 12, 12);
    ctx.fill();

    // 单元格渲染辅助
    const drawCell = (cx: number, cy: number, val: number, alpha = 1, scale = 1) => {
      ctx.save();
      if (alpha < 1) ctx.globalAlpha = alpha;

      const centerX = cx + w / 2;
      const centerY = cy + w / 2;

      if (scale !== 1) {
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);
      }

      ctx.fillStyle = COLORS[val] || '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(cx, cy, w, w, 8);
      ctx.fill();

      if (val > 0) {
        const emoji = ANIMAL_MAP.get(val) || '❓';
        ctx.font = `${w * 0.55}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, cx + w / 2, cy + w / 2);

        if (val >= 8) {
          ctx.fillStyle = val >= 128 ? '#fde68a' : '#78350f';
          ctx.font = `bold ${w * 0.2}px sans-serif`;
          ctx.fillText(String(val), cx + w / 2, cy + w - 8);
        }
      }

      ctx.restore();
    };

    const getCellPos = (row: number, col: number) => ({
      x: gridX + col * cellSize + gap,
      y: gridY + row * cellSize + gap,
    });

    if (phase === 'slide') {
      const elapsed = now - animStartRef.current;
      let t = Math.min(elapsed / SLIDE_MS, 1);
      // ease-out
      t = 1 - (1 - t) * (1 - t);

      // 过渡到 pop 阶段
      if (elapsed >= SLIDE_MS) {
        animPhaseRef.current = 'pop';
        animStartRef.current = now;
        const nt = addRandomTile();
        newTileRef.current = nt;

        // 如果加不了方块且无法移动，直接判负（极端情况）
        if (!nt && !canMove()) {
          animPhaseRef.current = 'idle';
          setLost(true);
          playSound('wrong');
          onGameOver();
        }
      }

      // 渲染滑动中的方块
      const animMovements = elapsed >= SLIDE_MS ? movementsRef.current : movementsRef.current;
      for (const m of animMovements) {
        let alpha = 1;
        if (m.consumed && t > 0.6) {
          alpha = 1 - (t - 0.6) / 0.4;
        }

        const from = getCellPos(m.fromRow, m.fromCol);
        const to = getCellPos(m.toRow, m.toCol);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;

        drawCell(x, y, m.value, Math.max(0, alpha));
      }
    } else if (phase === 'pop') {
      const elapsed = now - animStartRef.current;
      let t = Math.min(elapsed / POP_MS, 1);
      t = 1 - (1 - t) * (1 - t);

      // 过渡到 idle
      if (elapsed >= POP_MS) {
        animPhaseRef.current = 'idle';

        // 检查胜利
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (gridRef.current[r]?.[c] >= targetRef.current) {
              setWon(true);
              playSound('correct');
              requestRef.current = requestAnimationFrame(animate); // 继续渲染胜利画面
              return;
            }

        // 检查失败
        if (!canMove()) {
          setLost(true);
          playSound('wrong');
          onGameOver();
        }
      }

      // 渲染 pop 阶段（当前棋盘 + 缩放效果）
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const val = gridRef.current[r]?.[c] || 0;
          const pos = getCellPos(r, c);

          // 合并格缩放
          let scale = 1;
          const isMerge = mergeCellsRef.current.some(mc => mc.row === r && mc.col === c);
          const isNew = newTileRef.current && newTileRef.current.row === r && newTileRef.current.col === c;

          if (isMerge) {
            scale = 0.3 + t * 0.7;
          } else if (isNew) {
            scale = t;
          }

          if (val > 0) {
            drawCell(pos.x, pos.y, val, 1, scale);
          }
        }
      }
    } else {
      // idle：正常渲染
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const val = gridRef.current[r]?.[c] || 0;
          const pos = getCellPos(r, c);
          if (val > 0) {
            drawCell(pos.x, pos.y, val);
          }
        }
      }
    }

    // 底部提示
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.min(14, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    const hint = isTouchDevice() ? '↕↔ 滑动屏幕合成动物' : '方向键移动 / 滑动屏幕合成动物';
    ctx.fillText(hint, width / 2, gridY + gridW + 25);

    // 胜利遮罩
    if (won) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#facc15';
      const titleSize = Math.min(56, width * 0.06);
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 10;
      const wonEmoji = ANIMAL_MAP.get(targetRef.current) || '🏆';
      ctx.fillText(`🎉 获得 ${wonEmoji}！`, width / 2, height / 2 - 40);

      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(24, width * 0.028)}px sans-serif`;
      ctx.fillText('准备下一关...', width / 2, height / 2 + 15);
      ctx.shadowBlur = 0;

      // "下一关"按钮
      const btnW = Math.min(200, width * 0.4);
      const btnH = 44;
      const btnX = width / 2 - btnW / 2;
      const btnY = height / 2 + 35;

      nextBtnRef.current = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 12);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(20, width * 0.022)}px sans-serif`;
      ctx.fillText('下一关 ▶', width / 2, btnY + btnH / 2 + 1);
    }

    // 失败遮罩（仅文字，交互由 GamePlayer 的 overlay 处理）
    if (lost) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ef4444';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 10;
      ctx.fillText('游戏结束', width / 2, height / 2);
      ctx.shadowBlur = 0;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, won, lost]);

  // 设置 canvas DPR
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

  // 控制动画循环
  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animate]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
      className="block touch-none"
    />
  );
};
