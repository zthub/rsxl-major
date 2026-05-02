import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

type Suit = '♥' | '♦' | '♠' | '♣';
type Color = 'R' | 'B';

interface Card {
  id: string;
  suit: Suit;
  color: Color;
  value: number; // 1 (A) to 13 (K)
  faceUp: boolean;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}

interface Column {
  cards: Card[];
}

export const SolitaireGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

  const [level, setLevel] = useState(1);
  const [gameOverState, setGameOverState] = useState<'playing' | 'win' | 'stuck'>('playing');

  const columnsRef = useRef<Column[]>([]);
  const foundationsRef = useRef<Column[]>([]);
  const dragStateRef = useRef<{
    sourceCol: number;
    cardIndex: number;
    offsetX: number;
    offsetY: number;
    cards: Card[];
  } | null>(null);

  const cardW = Math.max(30, width * 0.08);
  const cardH = cardW * 1.45;
  const colCount = 6;
  const marginX = (width - colCount * cardW) / (colCount + 1);

  const initGame = useCallback(() => {
    // Generate a mini deck (values 1 to 5 + level)
    const maxVal = Math.min(13, 3 + level * 2);
    const deck: Card[] = [];
    const suits: {s:Suit, c:Color}[] = [
      {s:'♥', c:'R'}, {s:'♦', c:'R'}, {s:'♠', c:'B'}, {s:'♣', c:'B'}
    ];
    suits.forEach(suitInfo => {
       for(let v=1; v<=maxVal; v++) {
          deck.push({
             id: `${suitInfo.s}${v}`,
             suit: suitInfo.s, color: suitInfo.c, value: v,
             faceUp: false, x: 0, y: 0
          });
       }
    });
    
    // Shuffle
    deck.sort(() => Math.random() - 0.5);

    // Distribute to 6 columns
    const cols: Column[] = Array.from({length: 6}, () => ({ cards: [] }));
    deck.forEach((card, idx) => {
       cols[idx % 6].cards.push(card);
    });

    cols.forEach(col => {
       if (col.cards.length > 0) col.cards[col.cards.length - 1].faceUp = true;
    });

    columnsRef.current = cols;
    
    // 4 Foundations
    foundationsRef.current = Array.from({length: 4}, () => ({ cards: [] }));
    setGameOverState('playing');
  }, [level]);

  const checkStuck = useCallback(() => {
    for (let c = 0; c < 6; c++) {
       const col = columnsRef.current[c].cards;
       if (col.length > 0) {
          const bottomCard = col[col.length - 1];
          if (bottomCard.faceUp) {
             for (let f = 0; f < 4; f++) {
                const fCol = foundationsRef.current[f].cards;
                const topF = fCol[fCol.length - 1];
                if ((!topF && bottomCard.value === 1) || 
                    (topF && topF.suit === bottomCard.suit && topF.value === bottomCard.value - 1)) {
                   return false; // Move possible
                }
             }
          }
       }
    }
    for (let sourceCol = 0; sourceCol < 6; sourceCol++) {
       const sCol = columnsRef.current[sourceCol].cards;
       for (let i = 0; i < sCol.length; i++) {
          const dragCard = sCol[i];
          if (!dragCard.faceUp) continue;
          for (let targetCol = 0; targetCol < 6; targetCol++) {
             if (sourceCol === targetCol) continue;
             const tCol = columnsRef.current[targetCol].cards;
             const topTarget = tCol[tCol.length - 1];
             if (!topTarget) {
                if (i > 0 && !sCol[i-1].faceUp) return false;
             } else {
                if (topTarget.color !== dragCard.color && topTarget.value === dragCard.value + 1) {
                   if (i > 0 && !sCol[i-1].faceUp) return false;
                   if (i === 0) return false;
                   if (i > 0 && sCol[i-1].faceUp) {
                      const leftBehind = sCol[i-1];
                      for (let f = 0; f < 4; f++) {
                         const fC = foundationsRef.current[f].cards;
                         const tF = fC[fC.length - 1];
                         if ((!tF && leftBehind.value === 1) || 
                             (tF && tF.suit === leftBehind.suit && tF.value === leftBehind.value - 1)) {
                            return false;
                         }
                      }
                   }
                }
             }
          }
       }
    }
    return true; // Stuck
  }, []);

  useEffect(() => {
    if (isPlaying) initGame();
  }, [isPlaying, initGame]);

  const placeCards = () => {
     // Animate towards layout positions
     const topOffset = Math.max(80, height * 0.1);
     
     // Foundations
     foundationsRef.current.forEach((found, i) => {
        const cx = marginX + i * (cardW + marginX);
        const cy = topOffset;
        found.cards.forEach(card => {
           card.targetX = cx;
           card.targetY = cy;
           card.x += (card.targetX - card.x) * 0.2;
           card.y += (card.targetY - card.y) * 0.2;
        });
     });

     // Columns
     const colTop = topOffset + cardH + 20;
     columnsRef.current.forEach((col, i) => {
        const cx = marginX + i * (cardW + marginX);
        let cy = colTop;
        col.cards.forEach((card, j) => {
           if (!dragStateRef.current || !dragStateRef.current.cards.some(c => c.id === card.id)) {
              card.targetX = cx;
              card.targetY = cy;
              card.x += ((card.targetX ?? cx) - card.x) * 0.3;
              card.y += ((card.targetY ?? cy) - card.y) * 0.3;
           }
           cy += card.faceUp ? cardH * 0.3 : cardH * 0.1;
        });
     });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Refresh Button Hit Test
    const btnW = 120;
    const btnH = 40;
    const btnX = width - btnW - Math.max(20, width * 0.02);
    const btnY = Math.max(70, height * 0.1) - 25;
    
    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
       initGame();
       playSound('shoot');
       return;
    }

    if (gameOverState !== 'playing') {
       const goBtnW = 200, goBtnH = 50;
       const goBtnX = width/2 - goBtnW/2, goBtnY = height/2 + 40;
       if (x > goBtnX && x < goBtnX + goBtnW && y > goBtnY && y < goBtnY + goBtnH) {
          if (gameOverState === 'stuck') initGame(); 
          playSound('shoot');
       }
       return;
    }

    if (!isPlaying) return;

    // Check columns from right to left, top card to bottom card
    for(let c = columnsRef.current.length - 1; c >= 0; c--) {
       const col = columnsRef.current[c];
       for(let i = col.cards.length - 1; i >= 0; i--) {
          const card = col.cards[i];
          if (!card.faceUp) continue;
          if (x >= card.x && x <= card.x + cardW && y >= card.y && y <= card.y + cardH) {
             // Can drag this card and all above it
             const dragCards = col.cards.slice(i);
             // Verify valid sub-stack
             let valid = true;
             for(let k=1; k<dragCards.length; k++) {
                if (dragCards[k].color === dragCards[k-1].color || dragCards[k].value !== dragCards[k-1].value - 1) {
                   valid = false; break;
                }
             }
             if (valid) {
                 dragStateRef.current = {
                    sourceCol: c,
                    cardIndex: i,
                    offsetX: x - card.x,
                    offsetY: y - card.y,
                    cards: dragCards
                 };
                 playSound('shoot');
                 canvas.setPointerCapture(e.pointerId);
                 return;
             }
          }
       }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ds = dragStateRef.current;
    let currY = y - ds.offsetY;
    ds.cards.forEach(card => {
       card.x = x - ds.offsetX;
       card.y = currY;
       currY += cardH * 0.3;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    const ds = dragStateRef.current;
    const firstCard = ds.cards[0];
    
    // Check drop on foundations first (if only 1 card)
    let dropped = false;
    if (ds.cards.length === 1) {
       for(let i=0; i<4; i++) {
          const fx = marginX + i * (cardW + marginX);
          const fy = Math.max(80, height * 0.1);
          if (firstCard.x + cardW/2 > fx && firstCard.x + cardW/2 < fx + cardW &&
              firstCard.y + cardH/2 > fy && firstCard.y + cardH/2 < fy + cardH) {
              
              const fCol = foundationsRef.current[i].cards;
              const topF = fCol[fCol.length - 1];
              if ((!topF && firstCard.value === 1) || (topF && topF.suit === firstCard.suit && topF.value === firstCard.value - 1)) {
                 // Success drop on foundation
                 columnsRef.current[ds.sourceCol].cards.splice(ds.cardIndex, ds.cards.length);
                 foundationsRef.current[i].cards.push(firstCard);
                 playSound('correct');
                 onScore(10);
                 dropped = true;
                 break;
              }
          }
       }
    }

    // Check drop on columns
    if (!dropped) {
       for(let c = 0; c < 6; c++) {
          const colTop = Math.max(80, height * 0.1) + cardH + 20;
          const cx = marginX + c * (cardW + marginX);
          let dropY = colTop;
          const colCards = columnsRef.current[c].cards;
          if (colCards.length > 0) {
             dropY = colCards[colCards.length - 1].y;
          }

          if (firstCard.x + cardW/2 > cx - marginX/2 && firstCard.x + cardW/2 < cx + cardW + marginX/2 &&
              firstCard.y + cardH/2 > colTop - 50) { // relaxed hit test
              
              const topCol = colCards[colCards.length - 1];
              if ((!topCol) || // allow any sequence on empty
                  (topCol && topCol.faceUp && topCol.color !== firstCard.color && topCol.value === firstCard.value + 1)) {
                  // Success drop on column
                  columnsRef.current[ds.sourceCol].cards.splice(ds.cardIndex, ds.cards.length);
                  columnsRef.current[c].cards.push(...ds.cards);
                  playSound('shoot');
                  dropped = true;
                  break;
              }
          }
       }
    }

    if (!dropped) playSound('wrong');

    // Reveal new top card in source column
    const sourceColCards = columnsRef.current[ds.sourceCol].cards;
    if (sourceColCards.length > 0 && !sourceColCards[sourceColCards.length - 1].faceUp) {
       sourceColCards[sourceColCards.length - 1].faceUp = true;
       onScore(5);
    }
    
    dragStateRef.current = null;

    // Check Win or Stuck
    const totalFoundations = foundationsRef.current.reduce((sum, col) => sum + col.cards.length, 0);
    const maxVal = Math.min(13, 3 + level * 2);
    if (totalFoundations === 4 * maxVal) {
       setGameOverState('win');
       playSound('correct');
       onScore(200);
       setTimeout(() => setLevel(l => l + 1), 2000);
    } else {
       if (checkStuck()) {
          setGameOverState('stuck');
       }
    }
  };

  const drawCard = (ctx: CanvasRenderingContext2D, card: Card) => {
     ctx.save();
     ctx.shadowColor = 'rgba(0,0,0,0.3)';
     ctx.shadowBlur = 8;
     ctx.shadowOffsetY = 4;
     
     ctx.fillStyle = '#fff';
     ctx.beginPath(); ctx.roundRect(card.x, card.y, cardW, cardH, 5); ctx.fill();
     ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
     
     ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();

     if (!card.faceUp) {
        // Back pattern
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.roundRect(card.x + 4, card.y + 4, cardW - 8, cardH - 8, 3); ctx.fill();
        ctx.fillStyle = '#60a5fa';
        for(let i=0; i<3; i++) {
           ctx.beginPath(); ctx.arc(card.x + cardW/2, card.y + cardH/2, cardW*0.2 + i*5, 0, Math.PI*2); ctx.stroke();
        }
     } else {
        const valStr = card.value === 1 ? 'A' : (card.value === 11 ? 'J' : (card.value === 12 ? 'Q' : (card.value === 13 ? 'K' : String(card.value))));
        ctx.fillStyle = card.color === 'R' ? '#ef4444' : '#111827';
        
        ctx.font = `bold ${cardW * 0.3}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(valStr, card.x + 5, card.y + 5);
        
        ctx.font = `${cardW * 0.25}px sans-serif`;
        ctx.fillText(card.suit, card.x + 5, card.y + cardW * 0.35);

        // Center big suit
        ctx.font = `${cardW * 0.5}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(card.suit, card.x + cardW/2, card.y + cardH/2 + 5);
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

    if (gameOverState !== 'playing') {
       ctx.fillStyle = 'rgba(0,0,0,0.6)';
       ctx.fillRect(0, 0, width, height);
       if (gameOverState === 'win') {
         ctx.fillStyle = '#4ade80';
         ctx.font = `bold ${Math.min(48, width * 0.06)}px sans-serif`;
         ctx.textAlign = 'center';
         ctx.fillText('🎊 完美解开！', width/2, height/2 - 20);
       } else if (gameOverState === 'stuck') {
         ctx.fillStyle = '#ef4444';
         ctx.font = `bold ${Math.min(45, width * 0.06)}px sans-serif`;
         ctx.textAlign = 'center';
         ctx.fillText('🤔 牌局卡死了', width/2, height/2 - 20);
         
         const btnW = 200, btnH = 50;
         const btnX = width/2 - btnW/2, btnY = height/2 + 40;
         ctx.fillStyle = '#3b82f6';
         ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.fill();
         ctx.fillStyle = '#fff';
         ctx.font = 'bold 20px sans-serif';
         ctx.textBaseline = 'middle';
         ctx.fillText('重新生成本关', width/2, btnY + btnH/2);
       }
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    placeCards();

    // Draw Foundations placeholders
    const topOffset = Math.max(80, height * 0.1);
    for(let i=0; i<4; i++) {
       const fx = marginX + i * (cardW + marginX);
       ctx.strokeStyle = 'rgba(255,255,255,0.3)';
       ctx.lineWidth = 2;
       ctx.setLineDash([5, 5]);
       ctx.beginPath(); ctx.roundRect(fx, topOffset, cardW, cardH, 5); ctx.stroke();
       ctx.setLineDash([]);
       ctx.fillStyle = 'rgba(255,255,255,0.1)';
       ctx.fill();
    }

    // Draw Column placeholders
    const colTop = topOffset + cardH + 20;
    for(let c=0; c<6; c++) {
       const cx = marginX + c * (cardW + marginX);
       ctx.fillStyle = 'rgba(255,255,255,0.05)';
       ctx.beginPath(); ctx.roundRect(cx, colTop, cardW, cardH, 5); ctx.fill();
    }

    // Draw non-dragging cards
    foundationsRef.current.forEach(f => {
       f.cards.forEach(c => drawCard(ctx, c));
    });
    columnsRef.current.forEach(col => {
       col.cards.forEach(c => {
          if (!dragStateRef.current || !dragStateRef.current.cards.some(dc => dc.id === c.id)) {
             drawCard(ctx, c);
          }
       });
    });

    // Draw dragging cards top-most
    if (dragStateRef.current) {
       dragStateRef.current.cards.forEach(c => drawCard(ctx, c));
    }

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(22, width * 0.025)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(`关卡: ${level}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));
    ctx.shadowBlur = 0;

    // Refresh Button
    const btnW = 120;
    const btnH = 40;
    const btnX = width - btnW - Math.max(20, width * 0.02);
    const btnY = Math.max(70, height * 0.1) - 25;
    
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1; ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = `bold 16px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔄 重新生成', btnX + btnW/2, btnY + btnH/2);

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState, cardW, cardH, marginX]);

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
      className="block touch-none cursor-grab active:cursor-grabbing" 
    />
  );
};
