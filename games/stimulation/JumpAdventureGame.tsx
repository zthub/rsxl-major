import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface Platform {
  x: number;
  y: number;
  width: number;
  type: 'normal' | 'moving' | 'spring';
  vx: number;
}

export const JumpAdventureGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState(false);

  const playerRef = useRef({ x: width / 2, y: height - 100, vx: 0, vy: 0, size: 20 });
  const platformsRef = useRef<Platform[]>([]);
  const cameraYRef = useRef(0);
  const scoreRef = useRef(0);
  const pointerXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const initGame = useCallback(() => {
    playerRef.current = { x: width / 2, y: height - 150, vx: 0, vy: -15, size: Math.max(15, width * 0.03) };
    cameraYRef.current = 0;
    scoreRef.current = 0;
    setGameOverState(false);

    const initialPlatforms: Platform[] = [];
    const platWidth = Math.max(60, width * 0.15);
    // Base platform
    initialPlatforms.push({ x: width / 2 - platWidth/2, y: height - 50, width: platWidth, type: 'normal', vx: 0 });
    
    // Generate platforms up
    let y = height - 150;
    let lastX = width / 2 - platWidth/2;
    while(y > -height) {
      let nextX = lastX + (Math.random() - 0.5) * width * 0.6;
      nextX = Math.max(0, Math.min(width - platWidth, nextX));
      initialPlatforms.push({ 
        x: nextX, 
        y, 
        width: platWidth, 
        type: Math.random() > 0.8 ? 'moving' : (Math.random() > 0.9 ? 'spring' : 'normal'),
        vx: Math.random() > 0.5 ? (Math.random() * 2 + 1) : -(Math.random() * 2 + 1)
      });
      lastX = nextX;
      y -= Math.max(60, height * 0.12); // Reduced gap
    }
    platformsRef.current = initialPlatforms;
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
    pointerXRef.current = e.clientX - rect.left;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerXRef.current = e.clientX - rect.left;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    pointerXRef.current = null;
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
       ctx.fillStyle = '#ef4444';
       ctx.font = `bold ${Math.min(48, width * 0.06)}px sans-serif`;
       ctx.textAlign = 'center';
       ctx.fillText('跌落虚空！', width/2, height/2 - 20);
       ctx.fillStyle = '#fff';
       ctx.font = `bold 24px sans-serif`;
       ctx.fillText(`最终得分: ${scoreRef.current}`, width/2, height/2 + 30);
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    const p = playerRef.current;
    const speed = width * 0.015;
    
    // Horizontal movement via pointer tracking
    if (pointerXRef.current !== null) {
       const targetX = pointerXRef.current - p.size / 2;
       p.vx = (targetX - p.x) * 0.2; // Smooth interpolation
       // Clamp max horizontal speed
       const maxSpeed = width * 0.03;
       if (p.vx > maxSpeed) p.vx = maxSpeed;
       if (p.vx < -maxSpeed) p.vx = -maxSpeed;
    } else {
       p.vx *= 0.8; // Friction
    }

    p.x += p.vx;
    // Hard boundary
    if (p.x < 0) p.x = 0;
    if (p.x > width - p.size) p.x = width - p.size;

    // Physics
    const gravity = Math.min(0.6, height * 0.001);
    p.vy += gravity;
    p.y += p.vy;

    // Camera follow
    if (p.y < height * 0.4) {
      const diff = height * 0.4 - p.y;
      p.y = height * 0.4;
      cameraYRef.current += diff;
      platformsRef.current.forEach(plat => plat.y += diff);
      const inc = Math.floor(diff);
      scoreRef.current += inc;
      if (inc > 0 && Math.floor(scoreRef.current / 1000) > level - 1) {
         setLevel(l => l + 1);
         onScore(50);
         playSound('correct');
      }
    }

    // Platforms update & collision
    const platHeight = 15;
    platformsRef.current.forEach(plat => {
       if (plat.type === 'moving') {
          plat.x += plat.vx;
          if (plat.x < 0 || plat.x + plat.width > width) plat.vx *= -1;
       }
       
       // Collision only when falling
       if (p.vy > 0) {
         if (p.x + p.size > plat.x && p.x < plat.x + plat.width) {
           if (p.y + p.size >= plat.y && p.y + p.size <= plat.y + platHeight + p.vy) {
             playSound('shoot');
             p.vy = plat.type === 'spring' ? -height * 0.025 : -height * 0.018;
             p.y = plat.y - p.size;
           }
         }
       }
    });

    // Remove old platforms and generate new ones
    platformsRef.current = platformsRef.current.filter(plat => plat.y < height + 50);
    const highestPlat = platformsRef.current.length > 0 ? Math.min(...platformsRef.current.map(pl => pl.y)) : height;
    if (highestPlat > -height * 0.5) {
      const platWidth = Math.max(50, width * 0.15 * Math.max(0.4, 1 - level * 0.05));
      
      const lastPlat = platformsRef.current.find(pl => pl.y === highestPlat) || platformsRef.current[0];
      let nextX = (lastPlat?.x || width/2) + (Math.random() - 0.5) * width * 0.6;
      nextX = Math.max(0, Math.min(width - platWidth, nextX));

      platformsRef.current.push({
        x: nextX,
        y: highestPlat - Math.max(60, height * 0.12),
        width: platWidth,
        type: Math.random() > 0.7 ? 'moving' : (Math.random() > 0.85 ? 'spring' : 'normal'),
        vx: Math.random() > 0.5 ? (Math.random() * 2 + 1 + level * 0.5) : -(Math.random() * 2 + 1 + level * 0.5)
      });
    }

    // Game Over condition
    if (p.y > height + p.size * 2) {
       playSound('wrong');
       setGameOverState(true);
       setTimeout(() => onGameOver(), 2000);
    }

    // Drawing
    // Draw Platforms
    platformsRef.current.forEach(plat => {
      ctx.fillStyle = plat.type === 'spring' ? 'rgba(234, 179, 8, 0.9)' : (plat.type === 'moving' ? 'rgba(56, 189, 248, 0.9)' : 'rgba(34, 197, 94, 0.9)');
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.width, platHeight, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // glossy shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.roundRect(plat.x + 2, plat.y + 2, plat.width - 4, platHeight / 3, 2);
      ctx.fill();
    });

    // Draw Player
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.size, p.size, p.size * 0.3);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x + p.size*0.3, p.y + p.size*0.3, p.size*0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + p.size*0.7, p.y + p.size*0.3, p.size*0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    const lookX = p.vx > 0 ? 1 : (p.vx < 0 ? -1 : 0);
    ctx.beginPath(); ctx.arc(p.x + p.size*0.3 + lookX, p.y + p.size*0.3, p.size*0.07, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + p.size*0.7 + lookX, p.y + p.size*0.3, p.size*0.07, 0, Math.PI*2); ctx.fill();


    // UI
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));
    ctx.shadowBlur = 0;
    
    // Hint
    if (scoreRef.current < 500) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `bold ${Math.min(16, width * 0.018)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('按住并在屏幕左右滑动控制移动', width / 2, height - 30);
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
      className="block touch-none cursor-pointer" 
    />
  );
};
