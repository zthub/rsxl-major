import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

interface Shape {
  id: number;
  type: 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'heart';
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isDragging: boolean;
  isPlaced: boolean;
  radius: number;
}

interface Slot {
  id: number;
  type: string;
  x: number;
  y: number;
  radius: number;
  filled: boolean;
}

const SHAPES: { type: Shape['type']; color: string; draw: (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => void }[] = [
  {
    type: 'circle', color: '#ef4444',
    draw: (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  },
  {
    type: 'square', color: '#3b82f6',
    draw: (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, 4); ctx.fill(); }
  },
  {
    type: 'triangle', color: '#22c55e',
    draw: (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.9, y + r * 0.7); ctx.lineTo(x - r * 0.9, y + r * 0.7); ctx.fill(); }
  },
  {
    type: 'star', color: '#eab308',
    draw: (ctx, x, y, r, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const innerAngle = outerAngle + (2 * Math.PI) / 10;
        ctx.lineTo(x + Math.cos(outerAngle) * r, y + Math.sin(outerAngle) * r);
        ctx.lineTo(x + Math.cos(innerAngle) * r * 0.45, y + Math.sin(innerAngle) * r * 0.45);
      }
      ctx.closePath(); ctx.fill();
    }
  },
  {
    type: 'diamond', color: '#a855f7',
    draw: (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y); ctx.fill(); }
  },
  {
    type: 'heart', color: '#f43f5e',
    draw: (ctx, x, y, r, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(x, y + r * 0.7);
      ctx.bezierCurveTo(x - r * 1.5, y - r * 0.3, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
      ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.3, x, y + r * 0.7);
      ctx.fill();
    }
  },
];

const drawSlot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, type: string) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  const shape = SHAPES.find(s => s.type === type);
  if (shape) {
    shape.draw(ctx, x, y, r, 'transparent');
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

export const ShapeSortGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';
  const [level, setLevel] = useState(1);
  const shapesRef = useRef<Shape[]>([]);
  const slotsRef = useRef<Slot[]>([]);
  const draggingRef = useRef<Shape | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [completed, setCompleted] = useState(false);

  const getShapeCount = () => Math.min(3 + level, 6);

  const initGame = useCallback(() => {
    const count = getShapeCount();
    const selected = [...SHAPES].sort(() => Math.random() - 0.5).slice(0, count);
    const radius = Math.min(30, width * 0.035, (height * 0.35) / count);

    // Bottom area for shapes
    const shapeAreaTop = height * 0.7;
    const shapeSpacing = width / (count + 1);

    const shapes: Shape[] = selected.map((s, i) => ({
      id: i,
      type: s.type,
      color: s.color,
      x: shapeSpacing * (i + 1) + (Math.random() - 0.5) * 40,
      y: shapeAreaTop + Math.random() * (height * 0.2),
      targetX: 0,
      targetY: 0,
      isDragging: false,
      isPlaced: false,
      radius,
    }));

    // Top area for slots - shuffled positions
    const shuffledPositions = [...Array(count).keys()].sort(() => Math.random() - 0.5);
    const slotSpacing = width / (count + 1);
    const slotY = height * 0.3;

    const slots: Slot[] = selected.map((s, i) => ({
      id: i,
      type: s.type,
      x: slotSpacing * (shuffledPositions[i] + 1),
      y: slotY,
      radius,
      filled: false,
    }));

    // Match each shape to its slot
    slots.forEach((slot, i) => {
      shapes[i].targetX = slot.x;
      shapes[i].targetY = slot.y;
    });

    shapesRef.current = shapes;
    slotsRef.current = slots;
    setCompleted(false);
  }, [level, width, height]);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, level, initGame]);

  const getPointerPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPlaying || completed) return;
    const { x, y } = getPointerPos(e);
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i];
      if (shape.isPlaced) continue;
      if (Math.hypot(x - shape.x, y - shape.y) < shape.radius + 10) {
        draggingRef.current = shape;
        dragOffsetRef.current = { x: x - shape.x, y: y - shape.y };
        shape.isDragging = true;
        // Move to top
        shapesRef.current.splice(i, 1);
        shapesRef.current.push(shape);
        return;
      }
    }
  }, [isPlaying, completed]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const { x, y } = getPointerPos(e);
    draggingRef.current.x = x - dragOffsetRef.current.x;
    draggingRef.current.y = y - dragOffsetRef.current.y;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    const shape = draggingRef.current;
    shape.isDragging = false;

    // Check slots
    for (const slot of slotsRef.current) {
      if (slot.filled) continue;
      if (slot.type === shape.type && Math.hypot(shape.x - slot.x, shape.y - slot.y) < shape.radius + 20) {
        shape.x = slot.x;
        shape.y = slot.y;
        shape.isPlaced = true;
        slot.filled = true;
        playSound('correct');
        onScore(15);

        if (slotsRef.current.every(s => s.filled)) {
          setCompleted(true);
          playSound('correct');
          onScore(30);
          setTimeout(() => setLevel(prev => prev + 1), 1500);
        }
        draggingRef.current = null;
        return;
      }
    }

    playSound('wrong');
    draggingRef.current = null;
  }, [onScore]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frameCountRef.current++;

    renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.55);
    ctx.lineTo(width, height * 0.55);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(20, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(`第 ${level} 关  |  拖拽图形到对应轮廓`, width / 2, Math.max(60, height * 0.07));
    ctx.fillText('⬇ 拖下去 ⬇', width / 2, height * 0.6);
    ctx.shadowBlur = 0;

    // Draw slots
    slotsRef.current.forEach(slot => {
      if (!slot.filled) {
        drawSlot(ctx, slot.x, slot.y, slot.radius, slot.type);
      }
    });

    // Draw placed shapes on slots
    shapesRef.current.forEach(shape => {
      if (shape.isPlaced) {
        const def = SHAPES.find(s => s.type === shape.type);
        if (def) def.draw(ctx, shape.x, shape.y, shape.radius, shape.color);
      }
    });

    // Draw unplaced shapes
    shapesRef.current.forEach(shape => {
      if (shape.isPlaced) return;
      const def = SHAPES.find(s => s.type === shape.type);
      if (!def) return;
      ctx.save();
      if (shape.isDragging) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;
      }
      def.draw(ctx, shape.x, shape.y, shape.radius, shape.color);
      // White border for visibility
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // Level complete
    if (completed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#facc15';
      ctx.font = `bold ${Math.min(56, width * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
      ctx.fillText('🎉 完美匹配！', width / 2, height / 2 - 10);
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
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="block touch-none cursor-grab"
    />
  );
};
