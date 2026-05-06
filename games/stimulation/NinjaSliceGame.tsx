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
  owner?: 'left' | 'right';
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
  const [isTwoPlayer, setIsTwoPlayer] = useState(() => localStorage.getItem('ninjaSliceTwoPlayer') === 'true');
  const [leftFailed, setLeftFailed] = useState(false);
  const [rightFailed, setRightFailed] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const leftTrailRef = useRef<Point[]>([]);
  const rightTrailRef = useRef<Point[]>([]);
  const scoreRef = useRef(0);
  const leftScoreRef = useRef(0);
  const rightScoreRef = useRef(0);
  const nextSpawnRef = useRef(0);

  const leftFailedRef = useRef(false);
  const rightFailedRef = useRef(false);

  const comboRef = useRef({ hits: 0, lastHitFrame: 0 });
  const leftComboRef = useRef({ hits: 0, lastHitFrame: 0 });
  const rightComboRef = useRef({ hits: 0, lastHitFrame: 0 });
  const freezeFramesRef = useRef(0);

  const getGravity = () => {
     let g = Math.min(height * 0.0004 + level * 0.00005, height * 0.0008);
     if (freezeFramesRef.current > 0) g *= 0.3; // Slow motion
     return g;
  };

  const createParticles = (x: number, y: number, color: string, amount: number = 15) => {
    if (particlesRef.current.length > 100) return;
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
    leftTrailRef.current = [];
    rightTrailRef.current = [];
    scoreRef.current = 0;
    leftScoreRef.current = 0;
    rightScoreRef.current = 0;
    nextSpawnRef.current = 0;
    comboRef.current = { hits: 0, lastHitFrame: 0 };
    leftComboRef.current = { hits: 0, lastHitFrame: 0 };
    rightComboRef.current = { hits: 0, lastHitFrame: 0 };
    freezeFramesRef.current = 0;
    leftFailedRef.current = false;
    rightFailedRef.current = false;
    setGameOverState(false);
    setLeftFailed(false);
    setRightFailed(false);
  }, []);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (gameOverState) {
      if (isTwoPlayer) {
        const centerX = width / 2;
        const panelW = Math.min(200, width * 0.4);
        const panelH = height * 0.55;
        const panelY = height * 0.18;
        const btnW = Math.min(120, width * 0.26);
        const btnH = 38;
        const btnY = panelY + panelH + 25;
        const leftBtnX = centerX - btnW - 10;
        const rightBtnX = centerX + 10;

        if (y >= btnY && y <= btnY + btnH) {
          if (x >= leftBtnX && x <= leftBtnX + btnW) {
            setGameOverState(false);
            initGame();
            return;
          }
          if (x >= rightBtnX && x <= rightBtnX + btnW) {
            onGameOver();
            return;
          }
        }
      } else {
        const btnW = Math.min(140, width * 0.3);
        const btnH = 42;
        const btnY = height / 2 + 40;
        if (y >= btnY && y <= btnY + btnH && x >= width/2 - btnW/2 && x <= width/2 + btnW/2) {
          onGameOver();
          return;
        }
      }
      return;
    }

    const isLeftSide = !isTwoPlayer || x < width / 2;
    const trail = isLeftSide ? leftTrailRef.current : rightTrailRef.current;
    trail.push({ x, y, age: 0 });
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
    if (!isPlaying || gameOverState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;

    const isLeftSide = !isTwoPlayer || nx < width / 2;
    const trail = isLeftSide ? leftTrailRef.current : rightTrailRef.current;
    const comboRefToUse = isTwoPlayer ? (isLeftSide ? leftComboRef.current : rightComboRef.current) : comboRef.current;

    if (trail.length === 0) return;

    const last = trail[trail.length - 1];
    const p1 = last;
    const p2 = { x: nx, y: ny, age: 0 };
    trail.push(p2);

    const ctx = canvas.getContext('2d');

    itemsRef.current.forEach(item => {
      if (item.sliced) return;
      if (isTwoPlayer && item.owner && item.owner !== (isLeftSide ? 'left' : 'right')) return;

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
          if (isTwoPlayer) {
            if (isLeftSide) {
              leftFailedRef.current = true;
              setLeftFailed(true);
              drawFloatingText(ctx!, '💥 切到炸弹了!', width / 4, height / 2, '#ef4444', Math.max(36, width * 0.05));
            } else {
              rightFailedRef.current = true;
              setRightFailed(true);
              drawFloatingText(ctx!, '💥 切到炸弹了!', width * 3 / 4, height / 2, '#ef4444', Math.max(36, width * 0.05));
            }
            if (leftFailedRef.current && rightFailedRef.current) {
              setTimeout(() => setGameOverState(true), 1500);
            }
          } else {
            setGameOverState(true);
            setTimeout(() => onGameOver(), 2000);
          }
        } else if (item.type === 'freeze') {
           playSound('shoot');
           freezeFramesRef.current = 300;
           createParticles(item.x, item.y, '#38bdf8', 20);
        } else {
          playSound('shoot');
          createParticles(item.x, item.y, item.color);

          if (frameCountRef.current - comboRefToUse.lastHitFrame < 45) {
             comboRefToUse.hits++;
          } else {
             comboRefToUse.hits = 1;
          }
          comboRefToUse.lastHitFrame = frameCountRef.current;

          const pts = 10 + (comboRefToUse.hits > 1 ? comboRefToUse.hits * 5 : 0);

          if (isTwoPlayer) {
            if (isLeftSide) {
              leftScoreRef.current += pts;
              onScore(pts);
              if (ctx && comboRefToUse.hits > 1) {
                drawFloatingText(ctx, `${comboRefToUse.hits} COMBO!`, item.x, item.y - 40, '#facc15', 30);
              }
              if (leftScoreRef.current >= level * 150) {
                playSound('correct');
                setTimeout(() => setLevel(l => l + 1), 1000);
              }
            } else {
              rightScoreRef.current += pts;
              onScore(pts);
              if (ctx && comboRefToUse.hits > 1) {
                drawFloatingText(ctx, `${comboRefToUse.hits} COMBO!`, item.x, item.y - 40, '#facc15', 30);
              }
              if (rightScoreRef.current >= level * 150) {
                playSound('correct');
                setTimeout(() => setLevel(l => l + 1), 1000);
              }
            }
          } else {
            scoreRef.current += pts;
            onScore(pts);
            if (ctx && comboRefToUse.hits > 1) {
              drawFloatingText(ctx, `${comboRefToUse.hits} COMBO!`, item.x, item.y - 40, '#facc15', 30);
            }
            if (scoreRef.current >= level * 150) {
              playSound('correct');
              setTimeout(() => setLevel(l => l + 1), 1000);
            }
          }
        }
      }
    });
  };

  const handlePointerUp = () => {
    leftTrailRef.current = [];
    rightTrailRef.current = [];
  };

  // Fruit Drawing Helpers - Redesigned for high recognition
  const drawApple = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#dc2626';
     ctx.beginPath(); ctx.arc(0, r*0.1, r*0.85, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#fca5a5';
     ctx.beginPath(); ctx.ellipse(-r*0.25, -r*0.25, r*0.2, r*0.35, -0.3, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#65a30d';
     ctx.lineWidth = r*0.12;
     ctx.lineCap = 'round';
     ctx.beginPath(); ctx.moveTo(0, -r*0.75); ctx.quadraticCurveTo(r*0.15, -r*1.05, r*0.35, -r*0.85); ctx.stroke();
     ctx.beginPath(); ctx.moveTo(0, -r*0.72); ctx.quadraticCurveTo(-r*0.12, -r*0.95, -r*0.2, -r*0.8); ctx.stroke();
     ctx.fillStyle = '#22c55e';
     ctx.beginPath(); ctx.ellipse(r*0.28, -r*0.82, r*0.18, r*0.1, 0.4, 0, Math.PI*2); ctx.fill();
  };

  const drawWatermelon = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#15803d';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(0, 0, r*0.88, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(0, 0, r*0.82, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#166534'; ctx.lineWidth = r*0.1; ctx.lineCap = 'round';
     for(let i=0; i<6; i++) {
        let angle = i * Math.PI / 3 + 0.3;
        let innerR = r * 0.78;
        let outerR = r * 0.88;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle)*innerR, Math.sin(angle)*innerR);
        ctx.lineTo(Math.cos(angle)*outerR, Math.sin(angle)*outerR);
        ctx.stroke();
     }
     ctx.strokeStyle = '#166534'; ctx.lineWidth = r*0.06;
     for(let i=0; i<6; i++) {
        let angle = i * Math.PI / 3 + 0.8;
        let innerR = r * 0.8;
        let outerR = r * 0.86;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle)*innerR, Math.sin(angle)*innerR);
        ctx.lineTo(Math.cos(angle)*outerR, Math.sin(angle)*outerR);
        ctx.stroke();
     }
  };

  const drawOrange = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.fillStyle = '#f97316';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = 'rgba(255,255,255,0.3)';
     for(let i=0; i<10; i++) {
        let a = i * Math.PI/5 + 0.3;
        let dist = r * (0.4 + (i%2)*0.25);
        ctx.beginPath(); ctx.arc(Math.cos(a)*dist, Math.sin(a)*dist, r*0.06, 0, Math.PI*2); ctx.fill();
     }
     ctx.fillStyle = '#22c55e';
     ctx.beginPath(); ctx.ellipse(r*0.05, -r*0.9, r*0.15, r*0.08, 0.3, 0, Math.PI*2); ctx.fill();
  };

  const drawPineapple = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.save(); ctx.scale(0.75, 1.15);
     ctx.fillStyle = '#eab308';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#a16207'; ctx.lineWidth = r*0.06;
     for(let row=-r*0.7; row<=r*0.7; row+=r*0.32) {
        let offset = ((row + r*0.7) % (r*0.64)) < r*0.32 ? r*0.18 : 0;
        for(let col=-r*0.5+offset; col<=r*0.5; col+=r*0.36) {
           ctx.beginPath(); ctx.arc(col, row, r*0.07, 0, Math.PI*2); ctx.stroke();
        }
     }
     ctx.restore();
     ctx.fillStyle = '#16a34a';
     ctx.beginPath(); ctx.moveTo(-r*0.35, -r*1.0); ctx.lineTo(-r*0.15, -r*1.45); ctx.lineTo(0, -r*1.15);
     ctx.lineTo(r*0.15, -r*1.5); ctx.lineTo(r*0.35, -r*1.05); ctx.closePath(); ctx.fill();
     ctx.fillStyle = '#15803d';
     ctx.beginPath(); ctx.moveTo(-r*0.18, -r*1.18); ctx.lineTo(0, -r*1.42); ctx.lineTo(r*0.18, -r*1.2); ctx.closePath(); ctx.fill();
  };

  const drawKiwi = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.save(); ctx.scale(0.82, 1);
     ctx.fillStyle = '#78350f';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.restore();
     ctx.fillStyle = '#fef08a';
     ctx.beginPath(); ctx.arc(0, 0, r*0.92, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#84cc16';
     ctx.beginPath(); ctx.arc(0, 0, r*0.78, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#fff';
     ctx.beginPath(); ctx.arc(0, 0, r*0.35, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#451a03';
     for(let i=0; i<8; i++) {
        let a = i * Math.PI/4 + 0.2;
        ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.48, Math.sin(a)*r*0.48, r*0.045, 0, Math.PI*2); ctx.fill();
     }
  };

  const drawCoconut = (ctx: CanvasRenderingContext2D, r: number) => {
     ctx.save(); ctx.scale(0.88, 1);
     ctx.fillStyle = '#451a03';
     ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
     ctx.strokeStyle = '#292524'; ctx.lineWidth = r*0.06;
     ctx.beginPath(); ctx.ellipse(0, 0, r*0.82, r*0.94, 0, 0, Math.PI*2); ctx.stroke();
     ctx.restore();
     ctx.fillStyle = '#1c1917';
     ctx.beginPath(); ctx.ellipse(-r*0.28, -r*0.15, r*0.17, r*0.22, -0.2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.ellipse(r*0.26, -r*0.12, r*0.16, r*0.21, 0.2, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.ellipse(0, r*0.28, r*0.14, r*0.18, 0, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#292524';
     ctx.beginPath(); ctx.arc(-r*0.28, -r*0.15, r*0.07, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(r*0.26, -r*0.12, r*0.065, 0, Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(0, r*0.28, r*0.06, 0, Math.PI*2); ctx.fill();
  };

  const drawHalf = (ctx: CanvasRenderingContext2D, type: ItemType, r: number, isRight: boolean) => {
     ctx.save();
     ctx.beginPath();
     if (isRight) { ctx.rect(0, -r*1.5, r*1.5, r*3); }
     else { ctx.rect(-r*1.5, -r*1.5, r*1.5, r*3); }
     ctx.clip();

     if (type === 'watermelon') {
        ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(0, 0, r*0.82, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.arc(0, -r*0.15, r*0.25, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1c1917';
        const seedSide = isRight ? 1 : -1;
        for(let i=0; i<3; i++) {
           ctx.beginPath(); ctx.ellipse(seedSide*r*0.28, (i-1)*r*0.32, r*0.055, r*0.038, 0, 0, Math.PI*2); ctx.fill();
           ctx.beginPath(); ctx.ellipse(seedSide*r*0.48, (i-0.5)*r*0.32, r*0.05, r*0.035, 0, 0, Math.PI*2); ctx.fill();
        }
     }
     else if (type === 'orange') {
        ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, r*0.88, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        for(let i=0; i<8; i++) {
           let a = i * Math.PI*2/8;
           ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, r*0.8, a, a+Math.PI*2/8 - 0.12); ctx.fill();
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r*0.18, 0, Math.PI*2); ctx.fill();
     }
     else if (type === 'pineapple') {
        ctx.save(); ctx.scale(0.75, 1.15);
        ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(0, 0, r*0.88, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, 0, r*0.55, 0, Math.PI*2); ctx.fill();
        ctx.restore();
     }
     else if (type === 'kiwi') {
        ctx.save(); ctx.scale(0.82, 1);
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(0, 0, r*0.92, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#84cc16'; ctx.beginPath(); ctx.arc(0, 0, r*0.78, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r*0.35, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#451a03';
        for(let i=0; i<10; i++) {
           let a = i * Math.PI/5 + 0.15;
           if ((isRight && Math.cos(a) > 0) || (!isRight && Math.cos(a) < 0)) {
              ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.48, Math.sin(a)*r*0.48, r*0.04, 0, Math.PI*2); ctx.fill();
           }
        }
     }
     else if (type === 'coconut') {
        ctx.save(); ctx.scale(0.88, 1);
        ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, r*0.88, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        if (isRight) { ctx.fillRect(r*0.15, -r*0.35, r*0.65, r*0.7); }
        else { ctx.fillRect(-r*0.8, -r*0.35, r*0.65, r*0.7); }
     }
     else if (type === 'apple') {
        drawApple(ctx, r);
        ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(0, 0, r*0.72, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#dc2626';
        const coreSide = isRight ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(coreSide*r*0.22, 0, r*0.1, r*0.14, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#78350f';
        if (isRight) { ctx.beginPath(); ctx.arc(r*0.22, -r*0.06, r*0.05, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(-r*0.22, -r*0.06, r*0.05, 0, Math.PI*2); ctx.fill(); }
        if (isRight) { ctx.beginPath(); ctx.arc(r*0.15, r*0.08, r*0.04, 0, Math.PI*2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(-r*0.15, r*0.08, r*0.04, 0, Math.PI*2); ctx.fill(); }
     }
     else if (type === 'freeze') {
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(-r, -r, r*2, r*2);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = `${r*0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('❄', 0, 0);
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

    if (freezeFramesRef.current > 0) {
       freezeFramesRef.current--;
       // Freeze indicator tint
       ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
       ctx.fillRect(0, 0, width, height);
    }

    if (isTwoPlayer && (leftFailedRef.current || rightFailedRef.current) && !gameOverState) {
      const pulse = Math.abs(Math.sin(frameCountRef.current * 0.08));
      if (leftFailedRef.current && !rightFailedRef.current) {
        ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + pulse * 0.2})`;
        ctx.fillRect(0, 0, width / 2, height);
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.min(28, width * 0.04)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fillText('💥 切到炸弹了!', width / 4, height / 2);
        ctx.shadowBlur = 0;
      }
      if (rightFailedRef.current && !leftFailedRef.current) {
        ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + pulse * 0.2})`;
        ctx.fillRect(width / 2, 0, width / 2, height);
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.min(28, width * 0.04)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.fillText('💥 切到炸弹了!', width * 3 / 4, height / 2);
        ctx.shadowBlur = 0;
      }
    }

    if (gameOverState) {
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(0, 0, width, height);

       if (isTwoPlayer) {
         const centerX = width / 2;
         const panelW = Math.min(200, width * 0.4);
         const panelH = height * 0.55;
         const panelY = height * 0.18;
         const leftPanelX = centerX - panelW - 20;
         const rightPanelX = centerX + 20;
         const radius = 16;

         [leftPanelX, rightPanelX].forEach((px, idx) => {
           const failed = idx === 0 ? leftFailedRef.current : rightFailedRef.current;
           const score = idx === 0 ? leftScoreRef.current : rightScoreRef.current;
           const label = idx === 0 ? '左边' : '右边';

           ctx.fillStyle = failed ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
           ctx.beginPath();
           ctx.roundRect(px, panelY, panelW, panelH, radius);
           ctx.fill();

           ctx.strokeStyle = failed ? '#ef4444' : '#22c55e';
           ctx.lineWidth = 2;
           ctx.stroke();

           ctx.fillStyle = '#fff';
           ctx.font = `bold ${Math.min(22, width * 0.03)}px sans-serif`;
           ctx.textAlign = 'center';
           ctx.fillText(label, px + panelW / 2, panelY + 35);

           if (failed) {
             ctx.font = `${Math.min(70, width * 0.1)}px sans-serif`;
             ctx.fillText('💥', px + panelW / 2, panelY + panelH * 0.42);
           }

           ctx.fillStyle = failed ? '#ef4444' : '#22c55e';
           ctx.font = `bold ${Math.min(32, width * 0.045)}px sans-serif`;
           ctx.fillText(`${score}`, px + panelW / 2, panelY + panelH * 0.7);

           ctx.fillStyle = 'rgba(255,255,255,0.5)';
           ctx.font = `${Math.min(14, width * 0.02)}px sans-serif`;
           ctx.fillText('分', px + panelW / 2, panelY + panelH * 0.82);
         });

         ctx.fillStyle = '#fff';
         ctx.font = `bold ${Math.min(28, width * 0.04)}px sans-serif`;
         ctx.textAlign = 'center';
         ctx.fillText('🏆 游戏结束 🏆', centerX, panelY - 25);

         const btnW = Math.min(120, width * 0.26);
         const btnH = 38;
         const btnY = panelY + panelH + 25;
         const leftBtnX = centerX - btnW - 10;
         const rightBtnX = centerX + 10;

         [{ x: leftBtnX, color: '#22c55e', text: '继续游戏' }, { x: rightBtnX, color: '#ef4444', text: '返回列表' }].forEach(btn => {
           ctx.fillStyle = btn.color;
           ctx.beginPath();
           ctx.roundRect(btn.x, btnY, btnW, btnH, 10);
           ctx.fill();
           ctx.fillStyle = '#fff';
           ctx.font = `bold ${Math.min(15, width * 0.02)}px sans-serif`;
           ctx.textAlign = 'center';
           ctx.fillText(btn.text, btn.x + btnW / 2, btnY + btnH / 2 + 5);
         });
       } else {
         ctx.fillStyle = '#ef4444';
         ctx.font = `bold ${Math.min(50, width * 0.05)}px sans-serif`;
         ctx.textAlign = 'center';
         ctx.fillText('💥 切到炸弹了！', width/2, height/2);

         const btnW = Math.min(140, width * 0.3);
         const btnH = 42;
         ctx.fillStyle = '#ef4444';
         ctx.beginPath();
         ctx.roundRect(width/2 - btnW/2, height/2 + 40, btnW, btnH, 10);
         ctx.fill();
         ctx.fillStyle = '#fff';
         ctx.font = `bold ${Math.min(16, width * 0.022)}px sans-serif`;
         ctx.textAlign = 'center';
         ctx.fillText('返回列表', width/2, height/2 + 40 + btnH/2 + 6);
       }
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
          if (t === 'watermelon') r *= 1.3;

          const isSlowMoOut = freezeFramesRef.current > 0;

          if (isTwoPlayer) {
             const shouldSpawnLeft = !leftFailedRef.current;
             const shouldSpawnRight = !rightFailedRef.current;

             if (shouldSpawnLeft) {
               const leftX = width * 0.1 + Math.random() * width * 0.3;
               const vxBase = (Math.random() - 0.5) * width * 0.006 * (isSlowMoOut ? 0.3 : 1);

               itemsRef.current.push({
                 id: Math.random(),
                 x: leftX,
                 y: height + r,
                 vx: Math.abs(vxBase),
                 vy: -height * (0.018 + Math.random() * 0.006) * (isSlowMoOut ? 0.6 : 1),
                 radius: r,
                 type: t,
                 rotation: Math.random() * Math.PI * 2,
                 vRot: (Math.random() - 0.5) * 0.2 * (isSlowMoOut ? 0.3 : 1),
                 sliced: false,
                 color: c,
                 owner: 'left'
               });
             }
             if (shouldSpawnRight) {
               const rightX = width * 0.6 + Math.random() * width * 0.3;
               const vxBase = (Math.random() - 0.5) * width * 0.006 * (isSlowMoOut ? 0.3 : 1);

               itemsRef.current.push({
                 id: Math.random(),
                 x: rightX,
                 y: height + r,
                 vx: -Math.abs(vxBase),
                 vy: -height * (0.018 + Math.random() * 0.006) * (isSlowMoOut ? 0.6 : 1),
                 radius: r,
                 type: t,
                 rotation: Math.random() * Math.PI * 2,
                 vRot: (Math.random() - 0.5) * 0.2 * (isSlowMoOut ? 0.3 : 1),
                 sliced: false,
                 color: c,
                 owner: 'right'
               });
             }
          } else {
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

      if (isTwoPlayer && item.owner === 'left') {
        const maxX = width / 2 - item.radius - 5;
        if (item.x > maxX) {
          item.x = maxX;
          item.vx = -Math.abs(item.vx) * 0.5;
        }
      }
      if (isTwoPlayer && item.owner === 'right') {
        const minX = width / 2 + item.radius + 5;
        if (item.x < minX) {
          item.x = minX;
          item.vx = Math.abs(item.vx) * 0.5;
        }
      }

      if (item.y > height + item.radius + 100) {
         itemsRef.current.splice(i, 1);
         if (!item.sliced && item.type !== 'bomb' && item.type !== 'freeze') {
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
         if (item.type === 'bomb') {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 8;
         } else if (item.type === 'freeze') {
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
         }
         
         if (item.type === 'bomb') {
            const bombR = item.radius;
            ctx.fillStyle = '#1f2937';
            ctx.beginPath(); ctx.arc(0, 0, bombR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#111827'; ctx.lineWidth = bombR*0.08;
            ctx.beginPath(); ctx.arc(0, 0, bombR*0.88, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.arc(-bombR*0.35, -bombR*0.35, bombR*0.3, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = bombR*0.12; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, -bombR);
            ctx.quadraticCurveTo(bombR*0.3, -bombR*1.35, 0, -bombR*1.5);
            ctx.quadraticCurveTo(-bombR*0.15, -bombR*1.25, -bombR*0.08, -bombR*1.08);
            ctx.stroke();
            const flicker = frameCountRef.current % 8 < 4;
            const sparkColor = flicker ? '#fbbf24' : '#f97316';
            const sparkSize = bombR * (0.28 + (frameCountRef.current % 6) * 0.04);
            ctx.fillStyle = sparkColor;
            ctx.beginPath(); ctx.arc(0, -bombR*1.45, sparkSize, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath(); ctx.arc(0, -bombR*1.45, sparkSize*0.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${bombR*0.65}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('💀', 0, bombR*0.05);
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

    for (let t = 0; t < 2; t++) {
      const trail = t === 0 ? leftTrailRef.current : rightTrailRef.current;
      if (trail.length > 0) {
        for(let i=0; i<trail.length; i++) trail[i].age++;
        const filtered = trail.filter(p => p.age < 15);
        if (t === 0) leftTrailRef.current = filtered; else rightTrailRef.current = filtered;

        if (filtered.length > 1) {
           ctx.beginPath();
           ctx.moveTo(filtered[0].x, filtered[0].y);
           for(let i=1; i<filtered.length; i++) {
              ctx.lineTo(filtered[i].x, filtered[i].y);
           }
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
           ctx.lineWidth = Math.max(5, width * 0.008);
           ctx.strokeStyle = t === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,200,100,0.8)';
           if (freezeFramesRef.current > 0) {
             ctx.shadowColor = '#38bdf8';
             ctx.shadowBlur = 10;
           }
           ctx.stroke();
           ctx.shadowBlur = 0;
        }
      }
    }

    if (isTwoPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    if (isTwoPlayer) {
      const scoreY = Math.max(100, height * 0.15);
      ctx.fillText(`左边: ${leftScoreRef.current}`, Math.max(20, width * 0.02), scoreY);
      ctx.fillText(`右边: ${rightScoreRef.current}`, width * 0.52, scoreY);
      ctx.fillText(`关卡: ${level}`, width * 0.02, Math.max(70, height * 0.11));
    } else {
      ctx.fillText(`关卡: ${level}  得分: ${scoreRef.current}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));
    }

    if (freezeFramesRef.current > 0 && freezeFramesRef.current < 60 && frameCountRef.current % 10 < 5) {
       drawFloatingText(ctx, "冻结即将结束...", width/2, height*0.1, '#38bdf8', Math.max(20, width*0.03));
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState, isTwoPlayer]);

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
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="block touch-none cursor-crosshair"
      />
      <button
        onClick={() => { const next = !isTwoPlayer; setIsTwoPlayer(next); localStorage.setItem('ninjaSliceTwoPlayer', String(next)); }}
        title={isTwoPlayer ? '双人模式 - 点击切换为单人模式' : '单人模式 - 点击切换为双人模式'}
        className={`absolute top-20 right-20 w-12 h-12 rounded-full shadow-lg z-10 flex items-center justify-center transition-all active:scale-95 ${
          isTwoPlayer
            ? 'bg-brand-orange hover:bg-brand-orange/90'
            : 'bg-slate-700 hover:bg-slate-600'
        }`}
      >
        {isTwoPlayer ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        )}
      </button>
    </div>
  );
};
