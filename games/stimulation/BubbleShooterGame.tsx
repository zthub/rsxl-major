import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

const BUBBLE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

interface Bubble {
  flavor: number; // Index in BUBBLE_COLORS
  x: number;
  y: number;
  r: number;
  c: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flavor: number;
}

export const BubbleShooterGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState<'won'|'lost'|null>(null);

  const gridRef = useRef<Bubble[]>([]);
  const projectileRef = useRef<Projectile | null>(null);
  const currentFlavorRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const pointerPosRef = useRef({ x: width/2, y: height/2 });

  // Grid metrics
  const radius = Math.max(15, Math.min(width, height) * 0.03);
  const hexSize = radius * 2;
  const rowHeight = radius * Math.sqrt(3);
  const cols = Math.floor(width / hexSize) - 1;
  const xOffset = (width - cols * hexSize) / 2 + radius;
  const topOffset = Math.max(60, height * 0.08);

  const initGame = useCallback(() => {
    const bubbles: Bubble[] = [];
    const rows = Math.min(4 + level, 8);
    for (let r = 0; r < rows; r++) {
      const cCount = r % 2 === 0 ? cols : cols - 1;
      for (let c = 0; c < cCount; c++) {
        bubbles.push({
          flavor: Math.floor(Math.random() * BUBBLE_COLORS.length),
          r, c,
          x: xOffset + c * hexSize + (r % 2 === 0 ? 0 : radius),
          y: topOffset + r * rowHeight + radius
        });
      }
    }
    gridRef.current = bubbles;
    currentFlavorRef.current = Math.floor(Math.random() * BUBBLE_COLORS.length);
    projectileRef.current = null;
    scoreRef.current = 0;
    setGameOverState(null);
  }, [cols, hexSize, radius, rowHeight, topOffset, xOffset, level]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, initGame]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying || gameOverState || projectileRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const startX = width / 2;
    const startY = height - 40;
    const angle = Math.atan2(py - startY, px - startX);
    
    // Prevent shooting horizontally or down
    if (angle > -0.1 || angle < -Math.PI + 0.1) return;

    const speed = height * 0.045;
    projectileRef.current = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      flavor: currentFlavorRef.current
    };
    currentFlavorRef.current = Math.floor(Math.random() * BUBBLE_COLORS.length);
    playSound('shoot');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getNeighbors = (bubble: Bubble) => {
    const dirsEven = [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
    const dirsOdd = [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
    const dirs = bubble.r % 2 === 0 ? dirsEven : dirsOdd;
    
    return dirs.map(d => {
      const nr = bubble.r + d[0];
      const nc = bubble.c + d[1];
      return gridRef.current.find(b => b.r === nr && b.c === nc);
    }).filter(Boolean) as Bubble[];
  };

  const snapToGrid = (px: number, py: number) => {
    const r = Math.round((py - topOffset - radius) / rowHeight);
    const rClamped = Math.max(0, r);
    const offset = rClamped % 2 === 0 ? 0 : radius;
    const c = Math.round((px - xOffset - offset) / hexSize);
    return { r: rClamped, c };
  };

  const checkMatch = (startBubble: Bubble) => {
    const matchGroup = new Set<Bubble>([startBubble]);
    const queue = [startBubble];

    while (queue.length > 0) {
      const current = queue.shift()!;
      getNeighbors(current).forEach(n => {
        if (n.flavor === startBubble.flavor && !matchGroup.has(n)) {
          matchGroup.add(n);
          queue.push(n);
        }
      });
    }

    if (matchGroup.size >= 3) {
      playSound('correct');
      const removedAmt = matchGroup.size;
      scoreRef.current += removedAmt * 10;
      onScore(removedAmt * 10);
      gridRef.current = gridRef.current.filter(b => !matchGroup.has(b));

      // Remove floating bubbles
      const attached = new Set<Bubble>();
      const attachQueue = gridRef.current.filter(b => b.r === 0);
      attachQueue.forEach(b => attached.add(b));

      while(attachQueue.length > 0) {
         const current = attachQueue.shift()!;
         getNeighbors(current).forEach(n => {
            if (!attached.has(n)) {
               attached.add(n);
               attachQueue.push(n);
            }
         });
      }

      const fallCount = gridRef.current.length - attached.size;
      if (fallCount > 0) {
        scoreRef.current += fallCount * 20;
        onScore(fallCount * 20);
      }
      gridRef.current = Array.from(attached);

      if (gridRef.current.length === 0) {
        setGameOverState('won');
        setTimeout(() => { if(isPlaying) setLevel(l => l + 1); }, 2000);
      }

    } else {
      playSound('wrong');
      // check if past danger line
      const maxR = Math.max(...gridRef.current.map(b => b.r));
      const bt = topOffset + maxR * rowHeight + radius;
      if (bt > height - 100) {
         setGameOverState('lost');
         setTimeout(() => onGameOver(), 2000);
      }
    }
  };

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, flavor: number) => {
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = BUBBLE_COLORS[flavor];
    ctx.fill();

    // 3D glass highlight
    const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    if (gameOverState) {
       ctx.fillStyle = 'rgba(0,0,0,0.6)';
       ctx.fillRect(0, 0, width, height);
       ctx.fillStyle = gameOverState === 'won' ? '#4ade80' : '#ef4444';
       ctx.font = `bold ${Math.min(48, width * 0.06)}px sans-serif`;
       ctx.textAlign = 'center';
       ctx.fillText(gameOverState === 'won' ? '🎉 通关！' : '💥 泡泡触底！', width/2, height/2 - 20);
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    // Update projectile
    if (projectileRef.current) {
      const p = projectileRef.current;
      p.x += p.vx;
      p.y += p.vy;

      // Wall bounce
      if (p.x - radius < 0 || p.x + radius > width) {
        p.vx *= -1;
        p.x = Math.max(radius, Math.min(width - radius, p.x));
      }

      // Collision with grid or top
      let hit = false;
      if (p.y - radius <= topOffset) {
        hit = true;
      } else {
         for (const b of gridRef.current) {
            if (Math.hypot(p.x - b.x, p.y - b.y) < radius * 1.8) {
               hit = true;
               break;
            }
         }
      }

      if (hit) {
         const { r, c } = snapToGrid(p.x, p.y);
         const cCount = r % 2 === 0 ? cols : cols - 1;
         const clampedC = Math.max(0, Math.min(c, cCount - 1));
         
         // In case occupied, move down
         let finalR = r;
         while(gridRef.current.some(b => b.r === finalR && b.c === clampedC)) {
            finalR++;
         }

         const offset = finalR % 2 === 0 ? 0 : radius;
         const newX = xOffset + clampedC * hexSize + offset;
         const newY = topOffset + finalR * rowHeight + radius;

         const newBubble: Bubble = { flavor: p.flavor, r: finalR, c: clampedC, x: newX, y: newY };
         gridRef.current.push(newBubble);
         projectileRef.current = null;
         
         checkMatch(newBubble);
      }
    }

    // Draw grid
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    gridRef.current.forEach(b => drawBubble(ctx, b.x, b.y, b.flavor));
    ctx.shadowBlur = 0;

    // Draw cannon & next bubble
    const startX = width / 2;
    const startY = height - 40;

    if (!projectileRef.current) {
       // Aim line
       ctx.strokeStyle = 'rgba(255,255,255,0.2)';
       ctx.setLineDash([5, 5]);
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.moveTo(startX, startY);
       
       let aimX = pointerPosRef.current.x;
       let aimY = pointerPosRef.current.y;
       // don't aim low
       if (aimY > startY) aimY = startY;
       
       let angle = Math.atan2(aimY - startY, aimX - startX);
       ctx.lineTo(startX + Math.cos(angle)*300, startY + Math.sin(angle)*300);
       ctx.stroke();
       ctx.setLineDash([]);
       
       drawBubble(ctx, startX, startY, currentFlavorRef.current);
    } else {
       drawBubble(ctx, projectileRef.current.x, projectileRef.current.y, projectileRef.current.flavor);
    }

    // Cannon base
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(startX - 25, height - 20, 50, 40, 10);
    ctx.fill();

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState, cols, hexSize, radius, rowHeight, topOffset, xOffset]);

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
      onPointerMove={handlePointerMove}
      className="block touch-none cursor-crosshair" 
    />
  );
};
