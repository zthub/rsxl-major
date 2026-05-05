import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

export const NumberTapGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const numbersRef = useRef<{ num: number; x: number; y: number; clicked: boolean; radius: number }[]>([]);
  const nextNumRef = useRef(1);
  const totalRef = useRef(0);
  const [completed, setCompleted] = useState(false);

  const getCount = () => Math.min(5 + level * 3, 25);

  const initGame = useCallback(() => {
    const count = getCount();
    const topOffset = Math.max(80, height * 0.1);
    const padding = Math.max(20, width * 0.03);
    const availW = width - padding * 2;
    const availH = height - topOffset - padding;
    const maxRadius = Math.min(40, width * 0.04, availW / (Math.ceil(count / 3) + 1) / 2.5);
    const radius = maxRadius;

    const cols = Math.min(Math.ceil(Math.sqrt(count * (availW / availH))), 6);
    const rows = Math.ceil(count / cols);
    const cellW = availW / cols;
    const cellH = availH / rows;

    const positions: { x: number; y: number }[] = [];
    for (let r = 0; r < rows && positions.length < count; r++) {
      for (let c = 0; c < cols && positions.length < count; c++) {
        positions.push({
          x: padding + c * cellW + cellW / 2 + (Math.random() - 0.5) * cellW * 0.3,
          y: topOffset + r * cellH + cellH / 2 + (Math.random() - 0.5) * cellH * 0.3,
        });
      }
    }

    // Shuffle numbers so they appear in random order on screen
    const shuffledNums = [...Array(count).keys()].map(i => i + 1).sort(() => Math.random() - 0.5);
    numbersRef.current = positions.map((pos, i) => ({
      num: shuffledNums[i],
      x: pos.x,
      y: pos.y,
      clicked: false,
      radius,
    }));
    nextNumRef.current = 1;
    totalRef.current = count;
    setCompleted(false);
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

    for (const item of numbersRef.current) {
      if (item.clicked) continue;
      if (Math.hypot(x - item.x, y - item.y) < item.radius + 8) {
        if (item.num === nextNumRef.current) {
          item.clicked = true;
          nextNumRef.current++;
          playSound('correct');
          onScore(10);

          if (nextNumRef.current > totalRef.current) {
            setCompleted(true);
            playSound('correct');
            onScore(30);
            setTimeout(() => setLevel(prev => prev + 1), 1500);
          }
        } else {
          playSound('wrong');
        }
        return;
      }
    }
  }, [isPlaying, completed, onScore]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    const topOffset = Math.max(80, height * 0.1);

    // Level info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(24, width * 0.03)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${level} 关  |  下一个: ${nextNumRef.current}`, width / 2, topOffset);

    // Draw numbers
    for (const item of numbersRef.current) {
      if (item.clicked) {
        // Clicked - fade green
        ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${item.radius * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', item.x, item.y);
      } else {
        // Not clicked yet
        const isNext = item.num === nextNumRef.current;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${item.radius * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(item.num), item.x, item.y);
      }
    }

    // Hint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.min(16, width * 0.018)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('按数字从小到大的顺序依次点击', width / 2, height - 15);

    // Level complete
    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🎉 太棒了！', width / 2, height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(28, width * 0.03)}px sans-serif`;
      ctx.fillText('准备下一关...', width / 2, height / 2 + 40);
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
