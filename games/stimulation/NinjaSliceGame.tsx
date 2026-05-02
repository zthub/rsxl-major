import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface Point {
  x: number;
  y: number;
  age: number;
}

type ItemType = 'apple' | 'watermelon' | 'orange' | 'bomb' | 'freeze' | 'pineapple' | 'kiwi' | 'coconut';

interface Item {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: ItemType;
  rotation: number;
  vRot: number;
  sliced: boolean;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const NinjaSliceGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState(false);
  
  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<Point[]>([]);
  const scoreRef = useRef(0);
  const nextSpawnRef = useRef(0);
  
  // Fun Mechanics
  const comboRef = useRef({ hits: 0, lastHitFrame: 0 });
  const freezeFramesRef = useRef(0);

  const getGravity = () => {
     let g = Math.min(height * 0.0004 + level * 0.00005, height * 0.0008);
     if (freezeFramesRef.current > 0) g *= 0.3; // Slow motion
     return g;
  };

  const createParticles = (x: number, y: number, color: string, amount: number = 15) => {
    for(let i = 0; i < amount; i++) {
       particlesRef.current.push({
         x, y,
         vx: (Math.random() - 0.5) * width * 0.015,
         vy: (Math.random() - 0.5) * height * 0.015,
         life: 1,
         maxLife: 30 + Math.random() * 20,
         color,
         size: width * 0.008 + Math.random() * width * 0.005
       });
    }
  };

  const initGame = useCallback(() => {
    itemsRef.current = [];
    particlesRef.current = [];
    trailRef.current = [];
    scoreRef.current = 0;
    nextSpawnRef.current = 0;
    comboRef.current = { hits: 0, lastHitFrame: 0 };
    freezeFramesRef.current = 0;
    setGameOverState(false);
  }, []);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying || gameOverState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    trailRef.current = [{
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      age: 0
    }];
  };

  const drawFloatingText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.font = `bold ${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y);
      ctx.restore();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPlaying || gameOverState || trailRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;
    
    const last = trailRef.current[trailRef.current.length - 1];
    const p1 = last;
    const p2 = { x: nx, y: ny, age: 0 };
    trailRef.current.push(p2);

    // Collision detection
    itemsRef.current.forEach(item => {
      if (item.sliced) return;
      const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
      let t = 0;
      if (l2 !== 0) {
        t = Math.max(0, Math.min(1, ((item.x - p1.x)*(p2.x - p1.x) + (item.y - p1.y)*(p2.y - p1.y)) / l2));
      }
      const projX = p1.x + t * (p2.x - p1.x);
      const projY = p1.y + t * (p2.y - p1.y);
      const dist = Math.hypot(item.x - projX, item.y - projY);
      
      if (dist < item.radius) {
        item.sliced = true;
        
        if (item.type === 'bomb') {
          playSound('wrong');
          createParticles(item.x, item.y, '#ef4444', 30);
          setGameOverState(true);
          setTimeout(() => onGameOver(), 2000);
        } else if (item.type === 'freeze') {
           playSound('shoot');
           freezeFramesRef.current = 300; // 5 seconds of slow mo
           createParticles(item.x, item.y, '#38bdf8', 20);
        } else {
          playSound('shoot');
          createParticles(item.x, item.y, item.color);
          
          // Combo mechanic
          if (frameCountRef.current - comboRef.current.lastHitFrame < 45) {
             comboRef.current.hits++;
          } else {
             comboRef.current.hits = 1;
          }
          comboRef.current.lastHitFrame = frameCountRef.current;
          
          const pts = 10 + (comboRef.current.hits > 1 ? comboRef.current.hits * 5 : 0);
          scoreRef.current += pts;
          onScore(pts);
          
          if (ctx && comboRef.current.hits > 1) {
             drawFloatingText(ctx, `${comboRef.current.hits} COMBO!`, item.x, item.y - 40, '#facc15', 30);
          }
          
          if (scoreRef.current >= level * 150) { 
             playSound('correct');
             setTimeout(() => setLevel(l => l + 1), 1000);
          }
        }
      }
    });
  };

  const handlePointerUp = () => {
    trailRef.current = [];
  };

  // Fruit Drawing Helpers
  const drawApple = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#ef4444';
     ctx.beginPath(); ctx.arc(-r*0.2, 0, r*0.8, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(r*0.2, 0, r*0.8, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#65a30d'; ctx.lineWidth = r*0.15; ctx.beginPath(); ctx.moveTo(0, -r*0.6); ctx.quadraticCurveTo(r*0.2, -r*1.1, r*0.4, -r*0.9); ctx.stroke();
  };

  const drawWatermelon = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#166534'; // Dark green
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#4ade80'; // Light green zig-zags
     ctx.lineWidth = r * 0.15;
     ctx.lineCap = 'round';
     ctx.lineJoin = 'round';
     for(let i=0; i<3; i++) {
        ctx.beginPath();
        let angle = i * Math.PI*2/3;
        for(let step=-r*0.8; step<r*0.8; step+=r*0.4) {
           let offset = (Math.abs(step) % (r*0.8)) === 0 ? r*0.1 : -r*0.1;
           ctx.lineTo(Math.cos(angle)*step + Math.sin(angle)*offset, Math.sin(angle)*step - Math.cos(angle)*offset);
        }
        ctx.stroke();
     }
  };

  const drawOrange = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#f97316';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#fdba74';
     for(let i=0; i<8; i++) {
        let a = i * Math.PI/4;
        ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.5, Math.sin(a)*r*0.5, r*0.05, 0, Math.PI*2); ctx.fill();
     }
  };

  const drawPineapple = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.save(); ctx.scale(0.8, 1.2);
     ctx.fillStyle = '#eab308';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = r*0.05;
     for(let i=-r; i<=r; i+=r*0.4) {
        ctx.beginPath(); ctx.moveTo(i, -r); ctx.lineTo(i+r, r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, -r); ctx.lineTo(i-r, r); ctx.stroke();
     }
     ctx.restore();
     ctx.fillStyle = '#4ade80';
     ctx.beginPath(); ctx.moveTo(-r*0.3, -r*0.9); ctx.lineTo(0, -r*1.5); ctx.lineTo(r*0.3, -r*0.9); ctx.fill();
  };

  const drawKiwi = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.save(); ctx.scale(0.8, 1);
     ctx.fillStyle = '#78350f'; // brown
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.restore();
  };

  const drawCoconut = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#451a03'; // dark brown
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#78350f';
     ctx.beginPath(); ctx.arc(-r*0.3, -r*0.3, r*0.2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(r*0.3, -r*0.3, r*0.2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(0, 0, r*0.2, 0, Math.PI*2); ctx.fill();
  };

  const drawHalf = (ctx: CanvasRenderingContext2D, type: ItemType, r: number, isRight: boolean) => {
     ctx.save();
     ctx.beginPath();
     if (isRight) { ctx.rect(0, -r*1.5, r*1.5, r*3); } 
     else { ctx.rect(-r*1.5, -r*1.5, r*1.5, r*3); }
     ctx.clip();
     
     if (type === 'watermelon') {
        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, r*0.8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        const seedSide = isRight ? 1 : -1;
        for(let i=0; i<3; i++) {
           ctx.beginPath(); ctx.arc(seedSide*r*0.3, (i-1)*r*0.3, r*0.05, 0, Math.PI*2); ctx.fill();
           ctx.beginPath(); ctx.arc(seedSide*r*0.5, (i-0.5)*r*0.3, r*0.05, 0, Math.PI*2); ctx.fill();
        }
     }
     else if (type === 'orange') {
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f97316';
        for(let i=0; i<6; i++) {
           let a = i * Math.PI*2/6;
           ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, r*0.85, a, a+Math.PI*2/6 - 0.1); ctx.fill();
        }
     }
     else if (type === 'pineapple') {
        ctx.save(); ctx.scale(0.8, 1.2);
        ctx.fillStyle = '#ca8a04'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.arc(0, 0, r*0.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
     }
     else if (type === 'kiwi') {
        ctx.save(); ctx.scale(0.8, 1);
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#84cc16'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, r*0.3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        for(let i=0; i<8; i++) {
           let a = i * Math.PI/4;
           if ((isRight && Math.cos(a) > 0) || (!isRight && Math.cos(a) < 0)) {
              ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.4, Math.sin(a)*r*0.4, r*0.04, 0, Math.PI*2); ctx.fill();
           }
        }
        ctx.restore();
     }
     else if (type === 'coconut') {
        ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        if (isRight) {
           ctx.clearRect(r*0.2, -r*0.4, r*0.7, r*0.8);
        } else {
           ctx.clearRect(-r*0.9, -r*0.4, r*0.7, r*0.8);
        }
     }
     else if (type === 'apple') {
        drawApple(ctx, r);
        ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(0, 0, r*0.7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#451a03';
        if (isRight) { ctx.beginPath(); ctx.arc(r*0.25, 0, r*0.08, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(-r*0.25, 0, r*0.08, 0, Math.PI*2); ctx.fill(); }
     }
     else if (type === 'freeze') {
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(-r, -r, r*2, r*2);
     }
     ctx.restore();
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

    if (freezeFramesRef.current > 0) {
       freezeFramesRef.current--;
       // Freeze indicator tint
       ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
       ctx.fillRect(0, 0, width, height);
    }

    if (gameOverState) {
       ctx.fillStyle = 'rgba(0,0,0,0.5)';
       ctx.fillRect(0, 0, width, height);
       ctx.fillStyle = '#ef4444';
       ctx.font = `bold ${Math.min(50, width * 0.05)}px sans-serif`;
       ctx.textAlign = 'center';
       ctx.fillText('💥 切到炸弹了！', width/2, height/2);
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    const gravity = getGravity();

    if (frameCountRef.current > nextSpawnRef.current) {
       const count = Math.min(1 + Math.floor(Math.random() * (1 + level * 0.4)), 5);
       for(let i=0; i<count; i++) {
          const rand = Math.random();
          let t: ItemType = 'apple';
          let c = '#ef4444';
          
          if (rand < 0.15 + Math.min(level*0.02, 0.1)) { t = 'bomb'; c = '#111'; }
          else if (rand < 0.25 && freezeFramesRef.current === 0) { t = 'freeze'; c = '#bae6fd'; }
          else if (rand < 0.40) { t = 'watermelon'; c = '#22c55e'; }
          else if (rand < 0.55) { t = 'orange'; c = '#f97316'; }
          else if (rand < 0.70) { t = 'pineapple'; c = '#eab308'; }
          else if (rand < 0.85) { t = 'kiwi'; c = '#84cc16'; }
          else { t = 'coconut'; c = '#f8fafc'; }

          let r = Math.max(30, width * 0.04);
          if (t === 'watermelon') r *= 1.3; // larger watermelon
          
          const isSlowMoOut = freezeFramesRef.current > 0;

          itemsRef.current.push({
            id: Math.random(),
            x: width * 0.2 + Math.random() * width * 0.6,
            y: height + r,
            vx: (Math.random() - 0.5) * width * 0.008 * (isSlowMoOut ? 0.3 : 1),
            vy: -height * (0.018 + Math.random() * 0.006) * (isSlowMoOut ? 0.6 : 1),
            radius: r,
            type: t,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.2 * (isSlowMoOut ? 0.3 : 1),
            sliced: false,
            color: c
          });
       }
       const spawnRate = (freezeFramesRef.current > 0) ? 120 : (60 + Math.random() * (90 - level * 5));
       nextSpawnRef.current = frameCountRef.current + Math.max(20, spawnRate);
    }

    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const item = itemsRef.current[i];
      item.x += item.vx;
      item.y += item.vy;
      item.vy += gravity;
      item.rotation += item.vRot;

      if (item.y > height + item.radius + 100) {
         itemsRef.current.splice(i, 1);
         if (!item.sliced && item.type !== 'bomb' && item.type !== 'freeze') {
            // Miss mechanic? Optional.
         }
         continue;
      }

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      
      if (item.sliced && item.type !== 'bomb') {
         // Halves drifting apart horizontally
         const drift = (Math.abs(item.vy) + 2);
         ctx.save(); ctx.translate(-drift, 0); drawHalf(ctx, item.type, item.radius, false); ctx.restore();
         ctx.save(); ctx.translate(drift, 0); drawHalf(ctx, item.type, item.radius, true); ctx.restore();
      } else {
         ctx.shadowColor = 'rgba(0,0,0,0.5)';
         ctx.shadowBlur = 10;
         
         if (item.type === 'bomb') {
            ctx.beginPath();
            ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#111'; ctx.fill();
            const sparkOffset = item.radius * 0.8;
            ctx.fillStyle = frameCountRef.current % 10 < 5 ? '#f97316' : '#fde047';
            ctx.beginPath(); ctx.arc(sparkOffset, -sparkOffset, item.radius * 0.3, 0, Math.PI*2); ctx.fill();
         } else if (item.type === 'freeze') {
            ctx.fillStyle = '#7dd3fc';
            ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15;
            ctx.fillRect(-item.radius, -item.radius, item.radius*2, item.radius*2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(-item.radius*0.6, -item.radius*0.6, item.radius*0.4, item.radius*0.4);
         } else if (item.type === 'apple') drawApple(ctx, item.radius);
           else if (item.type === 'watermelon') drawWatermelon(ctx, item.radius);
           else if (item.type === 'orange') drawOrange(ctx, item.radius);
           else if (item.type === 'pineapple') drawPineapple(ctx, item.radius);
           else if (item.type === 'kiwi') drawKiwi(ctx, item.radius);
           else if (item.type === 'coconut') drawCoconut(ctx, item.radius);
      }
      ctx.restore();
    }

    for(let i = particlesRef.current.length-1; i>=0; i--) {
       const p = particlesRef.current[i];
       p.x += p.vx;
       p.y += p.vy;
       p.vy += gravity * 0.5;
       p.life++;
       if(p.life > p.maxLife) {
          particlesRef.current.splice(i, 1);
          continue;
       }
       ctx.fillStyle = p.color;
       ctx.globalAlpha = 1 - (p.life / p.maxLife);
       ctx.beginPath();
       ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
       ctx.fill();
       ctx.globalAlpha = 1.0;
    }

    if (trailRef.current.length > 0) {
      for(let i=0; i<trailRef.current.length; i++) trailRef.current[i].age++;
      trailRef.current = trailRef.current.filter(p => p.age < 15);
      
      if (trailRef.current.length > 1) {
         ctx.beginPath();
         ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
         for(let i=1; i<trailRef.current.length; i++) {
            ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
         }
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.lineWidth = Math.max(5, width * 0.008);
         ctx.strokeStyle = 'rgba(255,255,255,0.8)';
         ctx.shadowColor = freezeFramesRef.current > 0 ? '#38bdf8' : '#60a5fa'; // Blue sword during freeze
         ctx.shadowBlur = 15;
         ctx.stroke();
         ctx.shadowBlur = 0;
      }
    }

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
    ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));
    ctx.shadowBlur = 0;

    if (freezeFramesRef.current > 0 && freezeFramesRef.current < 60 && frameCountRef.current % 10 < 5) {
       drawFloatingText(ctx, "冻结即将结束...", width/2, height*0.1, '#38bdf8', Math.max(20, width*0.03));
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
