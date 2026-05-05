import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface MergeCard {
  id: string;
  value: number;
  col: number;
  x: number;
  y: number;
  targetY: number;
  isMerging: boolean;
  scale: number;
}

export const CardMergeGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState(false);

  const columnsRef = useRef<MergeCard[][]>([[], [], [], []]);
  const activeCardRef = useRef<MergeCard | null>(null);
  const scoreRef = useRef(0);

  const colCount = 4;
  const colWidth = width / colCount;
  const cardW = Math.max(50, colWidth * 0.8);
  const cardH = cardW * 1.3;
  const bottomMargin = Math.max(20, height * 0.05);

  const generateValue = () => {
     const val = Math.random();
     if (val < 0.6) return 2;
     if (val < 0.9) return 4;
     return 8;
  };

  const spawnActiveCard = useCallback(() => {
     activeCardRef.current = {
       id: Math.random().toString(),
       value: generateValue(),
       col: 1, // Default column
       x: 1 * colWidth + colWidth / 2,
       y: 50,
       targetY: 50,
       isMerging: false,
       scale: 1
     };
  }, [colWidth]);

  const initGame = useCallback(() => {
    columnsRef.current = [[], [], [], []];
    scoreRef.current = 0;
    setGameOverState(false);
    spawnActiveCard();
  }, [spawnActiveCard]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, initGame]);

  const dropCard = (colIdx: number) => {
    if (!activeCardRef.current || activeCardRef.current.y > 100) return;
    
    // Check game over (column full)
    const colCards = columnsRef.current[colIdx];
    const maxCards = Math.floor((height - 150) / (cardH * 0.3));
    if (colCards.length >= maxCards) {
       playSound('wrong');
       setGameOverState(true);
       setTimeout(() => onGameOver(), 2000);
       return;
    }

    const card = activeCardRef.current;
    card.col = colIdx;
    card.x = colIdx * colWidth + colWidth / 2;
    columnsRef.current[colIdx].push(card);
    activeCardRef.current = null;
    playSound('shoot');

    // Spawn next after a delay to prevent overlapping interactions
    setTimeout(() => {
       if (isPlaying && !gameOverState) spawnActiveCard();
    }, 300);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying || gameOverState || !activeCardRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colIdx = Math.floor(x / colWidth);
    if (colIdx >= 0 && colIdx < 4) {
       dropCard(colIdx);
    }
  };

  const getColorForValue = (val: number) => {
    switch(val) {
      case 2: return '#3b82f6';
      case 4: return '#8b5cf6';
      case 8: return '#d946ef';
      case 16: return '#f43f5e';
      case 32: return '#f97316';
      case 64: return '#eab308';
      case 128: return '#84cc16';
      case 256: return '#14b8a6';
      case 512: return '#6366f1';
      case 1024: return '#ec4899';
      case 2048: return '#facc15';
      default: return '#111827';
    }
  };

  const drawMergeCard = (ctx: CanvasRenderingContext2D, card: MergeCard) => {
     ctx.save();
     ctx.translate(card.x, card.y);
     ctx.scale(card.scale, card.scale);

     ctx.shadowColor = 'rgba(0,0,0,0.5)';
     ctx.shadowBlur = 10;
     ctx.shadowOffsetY = 5;

     ctx.fillStyle = getColorForValue(card.value);
     ctx.beginPath();
     ctx.roundRect(-cardW/2, -cardH/2, cardW, cardH, 8);
     ctx.fill();
     ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

     // Glass effect
     const grad = ctx.createLinearGradient(-cardW/2, -cardH/2, cardW/2, cardH/2);
     grad.addColorStop(0, 'rgba(255,255,255,0.4)');
     grad.addColorStop(1, 'rgba(255,255,255,0.0)');
     ctx.fillStyle = grad;
     ctx.fill();

     ctx.strokeStyle = 'rgba(255,255,255,0.5)';
     ctx.lineWidth = 2;
     ctx.stroke();

     // Text
     ctx.fillStyle = '#fff';
     ctx.font = `bold ${cardW * 0.4}px sans-serif`;
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.shadowColor = 'rgba(0,0,0,0.5)';
     ctx.shadowBlur = 4;
     ctx.fillText(card.value.toString(), 0, 0);

     ctx.restore();
  };

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);

    if (gameOverState) {
       ctx.fillStyle = 'rgba(0,0,0,0.6)';
       ctx.fillRect(0, 0, width, height);
       ctx.fillStyle = '#ef4444';
       ctx.font = `bold ${Math.min(48, width * 0.06)}px sans-serif`;
       ctx.textAlign = 'center';
       ctx.fillText('游戏结束', width/2, height/2 - 20);
       ctx.fillStyle = '#fff';
       ctx.font = `bold 24px sans-serif`;
       ctx.fillText(`最终合成最大数字: ${Math.max(...columnsRef.current.flat().map(c=>c.value), 0)}`, width/2, height/2 + 30);
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    // Logic update: Physics and merging down the columns
    for (let c = 0; c < colCount; c++) {
       const col = columnsRef.current[c];
       for (let i = 0; i < col.length; i++) {
          const card = col[i];
          // Calculate target Y
          // The bottom-most card is at height - bottomMargin - cardH/2
          const targetY = height - bottomMargin - cardH/2 - i * (cardH * 0.35); // overlapping
          card.targetY = targetY;

          // Move towards targetY
          if (card.y < card.targetY) {
             card.y += (card.targetY - card.y) * 0.3 + 2;
             if (card.y > card.targetY) card.y = card.targetY;
          }

          // Check merge with the card below it if they hit
          if (i > 0 && !card.isMerging) {
             const prevCard = col[i-1];
             if (!prevCard.isMerging && prevCard.value === card.value && Math.abs(card.y - card.targetY) < 5) {
                // Merge!
                prevCard.value *= 2;
                prevCard.scale = 1.3; // pump effect
                scoreRef.current += prevCard.value;
                onScore(prevCard.value);
                playSound('correct');
                
                if (prevCard.value >= level * 1024) {
                   setLevel(l => l + 1);
                }

                // Remove the top card that just merged
                col.splice(i, 1);
                i--; // adjust index since we removed
             }
          }

          // Scale animation return to 1
          if (card.scale > 1) {
             card.scale -= 0.05;
             if (card.scale < 1) card.scale = 1;
          }
       }
    }

    // Draw active card
    if (activeCardRef.current) {
       // Wobble effect for active card waiting to be dropped
       activeCardRef.current.y = 80 + Math.sin(frameCountRef.current * 0.1) * 5;
       drawMergeCard(ctx, activeCardRef.current);
       
       // Draw aiming columns
       ctx.fillStyle = 'rgba(255,255,255,0.05)';
       for(let c=0; c<colCount; c++) {
          ctx.beginPath();
          ctx.roundRect(c * colWidth + 5, 120, colWidth - 10, height, 10);
          ctx.fill();
       }
    }

    // Draw columns
    for (let c = 0; c < colCount; c++) {
       const col = columnsRef.current[c];
       for (let i = 0; i < col.length; i++) {
          drawMergeCard(ctx, col[i]);
       }
    }

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(10, width * 0.01), 30);
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState, colWidth, cardW, cardH, bottomMargin]);

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
    <canvas 
      ref={canvasRef} 
      onPointerDown={handlePointerDown}
      className="block touch-none cursor-pointer" 
    />
  );
};
