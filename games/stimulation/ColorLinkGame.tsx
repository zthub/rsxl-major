import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

const COLORS = [
  { name: '红', hex: '#ef4444', bg: 'rgba(239,68,68,0.3)' },
  { name: '蓝', hex: '#3b82f6', bg: 'rgba(59,130,246,0.3)' },
  { name: '绿', hex: '#22c55e', bg: 'rgba(34,197,94,0.3)' },
  { name: '黄', hex: '#eab308', bg: 'rgba(234,179,8,0.3)' },
  { name: '紫', hex: '#a855f7', bg: 'rgba(168,85,247,0.3)' },
  { name: '橙', hex: '#f97316', bg: 'rgba(249,115,22,0.3)' },
];

interface Ball {
  id: number;
  colorIdx: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  connected: boolean;
}

export const ColorLinkGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const pairsRef = useRef<{ left: Ball; right: Ball }[]>([]);
  const connectionsRef = useRef<boolean[]>([]);
  const currentColorRef = useRef<number | null>(null);
  const firstBallRef = useRef<{ pairIdx: number; side: 'left' | 'right' } | null>(null);
  const [completed, setCompleted] = useState(false);
  const initializedRef = useRef(false);

  const getPairCount = () => Math.min(3 + Math.floor(level / 2), 6);

  const initGame = useCallback(() => {
    const pairCount = getPairCount();
    const shuffled = [...Array(COLORS.length).keys()].sort(() => Math.random() - 0.5).slice(0, pairCount);
    const topOffset = Math.max(80, height * 0.1);
    const bottomY = height - Math.max(60, height * 0.08);
    const topY = topOffset + 30;
    const spacing = width / (pairCount + 1);

    pairsRef.current = shuffled.map((colorIdx, i) => ({
      left: { id: i * 2, colorIdx, x: spacing * (i + 1), y: topY, targetX: spacing * (i + 1), targetY: topY, connected: false },
      right: { id: i * 2 + 1, colorIdx, x: 0, y: bottomY, targetX: 0, targetY: bottomY, connected: false },
    }));

    // Shuffle right side positions
    // Avoid vertical same-color alignment as much as possible (derangement)
    const makePositions = () => [...Array(pairCount).keys()].sort(() => Math.random() - 0.5);
    let rightPositions = makePositions();
    let tries = 0;
    while (tries < 20 && rightPositions.some((pos, i) => pos === i) && pairCount > 1) {
      rightPositions = makePositions();
      tries++;
    }
    rightPositions.forEach((pos, i) => {
      pairsRef.current[i].right.x = spacing * (pos + 1);
      pairsRef.current[i].right.targetX = spacing * (pos + 1);
    });

    connectionsRef.current = new Array(pairCount).fill(false);
    firstBallRef.current = null;
    setCompleted(false);
    initializedRef.current = true;
  }, [level, width, height]);

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

    const ballRadius = Math.min(30, width * 0.03);

    // Find clicked ball
    for (let i = 0; i < pairsRef.current.length; i++) {
      const { left, right } = pairsRef.current[i];
      if (connectionsRef.current[i]) continue;

      for (const [ball, side] of [[left, 'left'] as const, [right, 'right'] as const]) {
        if (Math.hypot(x - ball.x, y - ball.y) < ballRadius + 10) {
          if (firstBallRef.current === null) {
            firstBallRef.current = { pairIdx: i, side };
            currentColorRef.current = ball.colorIdx;
          } else if (firstBallRef.current.pairIdx === i && firstBallRef.current.side !== side) {
            // Same pair but different side - connect!
            connectionsRef.current[i] = true;
            left.connected = true;
            right.connected = true;
            playSound('correct');
            onScore(20);
            firstBallRef.current = null;

            if (connectionsRef.current.every(c => c)) {
              setCompleted(true);
              playSound('correct');
              onScore(30);
              setTimeout(() => setLevel(prev => prev + 1), 1500);
            }
          } else {
            // Wrong pair
            playSound('wrong');
            firstBallRef.current = { pairIdx: i, side };
          }
          return;
        }
      }
    }
  }, [isPlaying, completed, onScore, width]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    const topOffset = Math.max(80, height * 0.1);
    const ballRadius = Math.min(30, width * 0.03);

    // Level info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(24, width * 0.03)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`第 ${level} 关  |  连线: ${connectionsRef.current.filter(Boolean).length}/${pairsRef.current.length}`, width / 2, topOffset);
    ctx.shadowBlur = 0;

    // Draw connections
    pairsRef.current.forEach((pair, i) => {
      if (connectionsRef.current[i]) {
        const color = COLORS[pair.left.colorIdx];
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = 6;
        ctx.shadowColor = color.hex;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(pair.left.x, pair.left.y);
        ctx.lineTo(pair.right.x, pair.right.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    // Draw balls
    pairsRef.current.forEach((pair, i) => {
      const color = COLORS[pair.left.colorIdx];

      for (const ball of [pair.left, pair.right]) {
        const isSelected = firstBallRef.current?.pairIdx === i;

        // Glow for selected
        if (isSelected) {
          ctx.shadowColor = color.hex;
          ctx.shadowBlur = 25;
        }

        // Ball background
        ctx.fillStyle = connectionsRef.current[i] ? color.hex : 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = isSelected ? 5 : 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Color fill
        if (!connectionsRef.current[i]) {
          ctx.fillStyle = color.hex;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ballRadius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Emoji indicator
        ctx.fillStyle = '#fff';
        ctx.font = `${ballRadius * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emojis = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
        ctx.fillText(emojis[pair.left.colorIdx] || '⬤', ball.x, ball.y);
      }
    });

    // Hint text
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.min(18, width * 0.02)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('点击上方和下方相同颜色的球进行连线', width / 2, height - 20);

    // Level complete
    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 完美连线！', width / 2, height / 2 - 10);
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
