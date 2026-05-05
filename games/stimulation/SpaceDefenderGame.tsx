import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface Bullet {
  x: number;
  y: number;
  vy: number;
  active: boolean;
}

interface Asteroid {
  x: number;
  y: number;
  size: number;
  vy: number;
  hp: number;
  maxHp: number;
  rotation: number;
  vRot: number;
  points: number[];
}

export const SpaceDefenderGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState(false);

  const shipRef = useRef({ x: width / 2, y: height - 80, size: 30 });
  const bulletsRef = useRef<Bullet[]>([]);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const scoreRef = useRef(0);
  const particlesRef = useRef<{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string}[]>([]);
  const isDraggingRef = useRef(false);

  // Auto-shoot interval
  const nextShootRef = useRef(0);
  const nextAsteroidRef = useRef(0);

  const initGame = useCallback(() => {
    shipRef.current = { x: width / 2, y: height - Math.max(80, height * 0.1), size: Math.max(25, width * 0.04) };
    bulletsRef.current = [];
    asteroidsRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    setGameOverState(false);
  }, [width, height]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, initGame]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying || gameOverState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    shipRef.current.x = e.clientX - rect.left;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || gameOverState) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      shipRef.current.x = e.clientX - rect.left;
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const createExplosion = (x: number, y: number, color: string) => {
    playSound('shoot');
    for(let i=0; i<10; i++) {
       particlesRef.current.push({
         x, y,
         vx: (Math.random() - 0.5) * 10,
         vy: (Math.random() - 0.5) * 10,
         life: 0,
         max: 15 + Math.random() * 15,
         color
       });
    }
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
       ctx.fillText('飞船被毁！', width/2, height/2 - 20);
       ctx.fillStyle = '#fff';
       ctx.font = `bold 24px sans-serif`;
       ctx.fillText(`最终得分: ${scoreRef.current}`, width/2, height/2 + 30);
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    // Auto shoot
    if (frameCountRef.current > nextShootRef.current) {
       bulletsRef.current.push({ x: shipRef.current.x, y: shipRef.current.y - shipRef.current.size, vy: -height * 0.02, active: true });
       nextShootRef.current = frameCountRef.current + Math.max(10, 20 - level);
    }

    // Spawn asteroids
    if (frameCountRef.current > nextAsteroidRef.current) {
       const size = Math.max(30, width * 0.05) + Math.random() * 30;
       const pts = [];
       const numPts = 6 + Math.floor(Math.random() * 4);
       for(let i=0; i<numPts; i++) {
          pts.push(0.7 + Math.random() * 0.3);
       }
       asteroidsRef.current.push({
         x: Math.random() * width,
         y: -size,
         size: size,
         vy: height * 0.003 + Math.random() * height * 0.002 * level * 0.5,
         hp: Math.ceil(size / 20) + level - 1,
         maxHp: Math.ceil(size / 20) + level - 1,
         rotation: Math.random() * Math.PI * 2,
         vRot: (Math.random() - 0.5) * 0.05,
         points: pts
       });
       nextAsteroidRef.current = frameCountRef.current + Math.max(30, 90 - level * 10);
    }

    // Update & Draw bullets
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 10;
    bulletsRef.current.forEach(b => {
      if (!b.active) return;
      b.y += b.vy;
      ctx.beginPath();
      ctx.roundRect(b.x - 3, b.y, 6, 20, 3);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Update & Draw Asteroids + Collision
    for(let i=asteroidsRef.current.length-1; i>=0; i--) {
      const a = asteroidsRef.current[i];
      a.y += a.vy;
      a.rotation += a.vRot;

      // Check collision with ship
      const distShip = Math.hypot(a.x - shipRef.current.x, a.y - shipRef.current.y);
      if (distShip < a.size + shipRef.current.size * 0.6) {
         createExplosion(shipRef.current.x, shipRef.current.y, '#ef4444');
         playSound('wrong');
         setGameOverState(true);
         setTimeout(() => onGameOver(), 2000);
      }

      // Check bullet hits
      bulletsRef.current.forEach(b => {
         if (b.active && Math.hypot(b.x - a.x, b.y - a.y) < a.size) {
            b.active = false;
            a.hp--;
            createExplosion(b.x, b.y, '#f59e0b');
         }
      });

      if (a.hp <= 0) {
         scoreRef.current += a.maxHp * 10;
         onScore(a.maxHp * 10);
         createExplosion(a.x, a.y, '#9ca3af');
         asteroidsRef.current.splice(i, 1);
         if (scoreRef.current > level * 300) {
            setLevel(l => l + 1);
            playSound('correct');
         }
         continue;
      }
      
      if (a.y > height + a.size) {
        asteroidsRef.current.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.fillStyle = '#4b5563';
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(let j=0; j<a.points.length; j++) {
         const angle = (j / a.points.length) * Math.PI * 2;
         const r = a.size * a.points[j];
         if (j===0) ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r);
         else ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      
      // HP bar
      ctx.rotate(-a.rotation); // un-rotate for UI
      const barW = a.size;
      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(-barW/2, -a.size - 10, barW, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-barW/2, -a.size - 10, barW * (a.hp / a.maxHp), 4);
      ctx.restore();
    }

    // Clean inactive bullets
    bulletsRef.current = bulletsRef.current.filter(b => b.active && b.y > -50);

    // Particles update and draw
    for(let i=particlesRef.current.length-1; i>=0; i--) {
       const p = particlesRef.current[i];
       p.x += p.vx;
       p.y += p.vy;
       p.life++;
       if (p.life > p.max!) {
         particlesRef.current.splice(i, 1);
         continue;
       }
       ctx.fillStyle = p.color;
       ctx.globalAlpha = 1 - (p.life / p.max);
       ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (1 - p.life/p.max), 0, Math.PI*2); ctx.fill();
       ctx.globalAlpha = 1.0;
    }

    // Draw Ship
    const s = shipRef.current;
    ctx.fillStyle = '#e2e8f0';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.size);
    ctx.lineTo(s.x - s.size, s.y + s.size);
    ctx.lineTo(s.x, s.y + s.size * 0.5);
    ctx.lineTo(s.x + s.size, s.y + s.size);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Engine glow
    ctx.fillStyle = frameCountRef.current % 6 < 3 ? '#38bdf8' : '#0284c7';
    ctx.beginPath(); ctx.arc(s.x, s.y + s.size * 0.8, s.size * 0.3, 0, Math.PI*2); ctx.fill();

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(20, width * 0.02), Math.max(50, height * 0.08));
    ctx.shadowBlur = 0;
    
    // Hint
    if (scoreRef.current === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `bold ${Math.min(16, width * 0.018)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('按住并拖动飞船，自动射击', width / 2, height - 30);
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState]);

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
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="block touch-none cursor-crosshair" 
    />
  );
};
