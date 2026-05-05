import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

const EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑', '🍌', '🥑', '🌽', '🥕', '🌸', '🌺', '🦋', '🐝', '🐸', '🐰', '🐱', '🐶'];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export const MemoryCardGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const cardsRef = useRef<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [canFlip, setCanFlip] = useState(true);
  const matchedRef = useRef(0);
  const scoreRef = useRef(0);
  const initializedRef = useRef(false);
  const clickCooldownRef = useRef(false);

  const getGridSize = () => {
    if (level <= 2) return { cols: 4, rows: 2, pairs: 4 };
    if (level <= 4) return { cols: 4, rows: 3, pairs: 6 };
    if (level <= 6) return { cols: 4, rows: 4, pairs: 8 };
    return { cols: 5, rows: 4, pairs: 10 };
  };

  const initGame = useCallback(() => {
    const { pairs } = getGridSize();
    const selectedEmojis = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, pairs);
    const cardPairs = [...selectedEmojis, ...selectedEmojis]
      .map((emoji, i) => ({ id: i, emoji, isFlipped: false, isMatched: false }))
      .sort(() => Math.random() - 0.5);
    cardsRef.current = cardPairs;
    matchedRef.current = 0;
    setFlipped([]);
    setCanFlip(true);
    initializedRef.current = true;
  }, [level]);

  useEffect(() => {
    if (isPlaying) {
      initGame();
    }
  }, [isPlaying, level, initGame]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || !canFlip || clickCooldownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { cols, rows } = getGridSize();
    const padding = 20;
    const topOffset = Math.max(100, height * 0.12);
    const availW = width - padding * 2;
    const availH = height - topOffset - padding;
    const cardW = (availW - (cols - 1) * 10) / cols;
    const cardH = (availH - (rows - 1) * 10) / rows;
    const cardSize = Math.min(cardW, cardH, 120);
    const gridW = cols * cardSize + (cols - 1) * 10;
    const gridH = rows * cardSize + (rows - 1) * 10;
    const startX = (width - gridW) / 2;
    const startY = topOffset + (availH - gridH) / 2;

    const col = Math.floor((x - startX) / (cardSize + 10));
    const row = Math.floor((y - startY) / (cardSize + 10));
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    const idx = row * cols + col;
    const card = cardsRef.current[idx];
    if (!card || card.isFlipped || card.isMatched) return;

    clickCooldownRef.current = true;
    setTimeout(() => { clickCooldownRef.current = false; }, 200);

    const newFlipped = [...flipped, idx];
    card.isFlipped = true;
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);
      const [first, second] = newFlipped;
      const c1 = cardsRef.current[first];
      const c2 = cardsRef.current[second];

      if (c1.emoji === c2.emoji) {
        c1.isMatched = true;
        c2.isMatched = true;
        matchedRef.current += 2;
        scoreRef.current += 10;
        playSound('correct');
        onScore(10);

        if (matchedRef.current === cardsRef.current.length) {
          scoreRef.current += 50;
          onScore(50);
          setTimeout(() => {
            setLevel(prev => prev + 1);
          }, 1200);
        }

        setTimeout(() => {
          setFlipped([]);
          setCanFlip(true);
        }, 500);
      } else {
        playSound('wrong');
        setTimeout(() => {
          c1.isFlipped = false;
          c2.isFlipped = false;
          setFlipped([]);
          setCanFlip(true);
        }, 800);
      }
    }
  }, [isPlaying, canFlip, flipped, onScore, level]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    const { cols, rows } = getGridSize();
    const padding = 20;
    const topOffset = Math.max(100, height * 0.12);
    const availW = width - padding * 2;
    const availH = height - topOffset - padding;
    const cardW = (availW - (cols - 1) * 10) / cols;
    const cardH = (availH - (rows - 1) * 10) / rows;
    const cardSize = Math.min(cardW, cardH, 120);
    const gridW = cols * cardSize + (cols - 1) * 10;
    const gridH = rows * cardSize + (rows - 1) * 10;
    const startX = (width - gridW) / 2;
    const startY = topOffset + (availH - gridH) / 2;

    // Level info
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(24, width * 0.03)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${level} 关  |  已匹配: ${matchedRef.current}/${cardsRef.current.length}`, width / 2, topOffset - 20);

    // Draw cards
    cardsRef.current.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardSize + 10);
      const cy = startY + row * (cardSize + 10);

      if (card.isMatched) {
        // Matched card - green tint
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardSize, cardSize, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `${cardSize * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.emoji, cx + cardSize / 2, cy + cardSize / 2);
      } else if (card.isFlipped) {
        // Flipped card - white
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardSize, cardSize, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `${cardSize * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.emoji, cx + cardSize / 2, cy + cardSize / 2);
      } else {
        // Hidden card - pattern back
        ctx.fillStyle = 'rgba(99, 102, 241, 0.85)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardSize, cardSize, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Star pattern on back
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = `${cardSize * 0.35}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❓', cx + cardSize / 2, cy + cardSize / 2);
      }
    });

    // Level complete
    if (matchedRef.current === cardsRef.current.length && cardsRef.current.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(60, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🎉 过关！', width / 2, height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.min(28, width * 0.03)}px sans-serif`;
      ctx.fillText('准备下一关...', width / 2, height / 2 + 40);
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
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }, [width, height]);

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animate]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      className="block touch-none cursor-pointer"
    />
  );
};
