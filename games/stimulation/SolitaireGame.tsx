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

  const LEVEL_STORAGE_KEY = 'solitaire_level_v1';
  const MAX_LEVEL = 6;
  const [level, setLevel] = useState(() => {
    const saved = Number(localStorage.getItem(LEVEL_STORAGE_KEY) || '1');
    return Number.isFinite(saved) ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(saved))) : 1;
  });
  const [gameOverState, setGameOverState] = useState<'playing' | 'win' | 'stuck' | 'stuck-closed'>('playing');
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  const columnsRef = useRef<Column[]>([]);
  const foundationsRef = useRef<Column[]>([]);
  const dragStateRef = useRef<{
    sourceCol: number;
    cardIndex: number;
    offsetX: number;
    offsetY: number;
    cards: Card[];
  } | null>(null);

  const cardW = Math.max(28, width * 0.065);
  const cardH = cardW * 1.4;
  const colCount = 6;
  const marginX = (width - colCount * cardW) / (colCount + 1);

  const getMaxVal = useCallback((lv: number) => Math.min(13, 3 + lv * 2), []);

  const canMoveFromState = useCallback((cols: Column[], fnds: Column[]) => {
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c].cards;
      if (col.length === 0) continue;
      const bottom = col[col.length - 1];
      if (!bottom.faceUp) continue;
      for (let f = 0; f < fnds.length; f++) {
        const fCol = fnds[f].cards;
        const topF = fCol[fCol.length - 1];
        if ((!topF && bottom.value === 1) || (topF && topF.suit === bottom.suit && topF.value === bottom.value - 1)) {
          return true;
        }
      }
      for (let targetCol = 0; targetCol < cols.length; targetCol++) {
        if (c === targetCol) continue;
        const tCol = cols[targetCol].cards;
        const topTarget = tCol[tCol.length - 1];
        if (!topTarget && col.length > 1) return true;
        if (topTarget?.faceUp && topTarget.color !== bottom.color && topTarget.value === bottom.value + 1) return true;
      }
    }
    return false;
  }, []);

  const countAvailableMoves = useCallback((cols: Column[], fnds: Column[]): number => {
    let moves = 0;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c].cards;
      if (col.length === 0) continue;
      const bottom = col[col.length - 1];
      if (!bottom.faceUp) continue;
      for (let f = 0; f < fnds.length; f++) {
        const fCol = fnds[f].cards;
        const topF = fCol[fCol.length - 1];
        if ((!topF && bottom.value === 1) || (topF && topF.suit === bottom.suit && topF.value === bottom.value - 1)) {
          moves++;
          break;
        }
      }
      for (let targetCol = 0; targetCol < cols.length; targetCol++) {
        if (c === targetCol) continue;
        const tCol = cols[targetCol].cards;
        const topTarget = tCol[tCol.length - 1];
        if (!topTarget && col.length > 1) { moves++; }
        else if (topTarget?.faceUp && topTarget.color !== bottom.color && topTarget.value === bottom.value + 1) { moves++; }
      }
    }
    return moves;
  }, []);

  const countMovesWithDepth = useCallback((cols: Column[], fnds: Column[]): number => {
    const deepCopyCols = cols.map(col => ({
      cards: col.cards.map(c => ({ ...c }))
    }));
    const deepCopyFnds = fnds.map(f => ({
      cards: f.cards.map(c => ({ ...c }))
    }));
    let totalScore = 0;
    for (let c = 0; c < deepCopyCols.length; c++) {
      const col = deepCopyCols[c].cards;
      if (col.length === 0) continue;
      const bottom = col[col.length - 1];
      if (!bottom.faceUp) continue;
      const colCards = [...col];
      const fndsCopy = deepCopyFnds.map(f => ({ cards: [...f.cards] }));
      let movedThisCol = false;
      for (let f = 0; f < 4; f++) {
        const fCol = fndsCopy[f].cards;
        const topF = fCol[fCol.length - 1];
        if ((!topF && bottom.value === 1) || (topF && topF.suit === bottom.suit && topF.value === bottom.value - 1)) {
          fndsCopy[f].cards.push(bottom);
          colCards.pop();
          if (colCards.length > 0 && !colCards[colCards.length - 1].faceUp) {
            colCards[colCards.length - 1].faceUp = true;
          }
          totalScore += 1 + countAvailableMoves(deepCopyCols.map((oc, ocIdx) => ocIdx === c ? { cards: colCards } : oc), fndsCopy) * 0.5;
          movedThisCol = true;
          break;
        }
      }
      if (!movedThisCol) {
        for (let targetCol = 0; targetCol < deepCopyCols.length; targetCol++) {
          if (c === targetCol) continue;
          const tCol = deepCopyCols[targetCol].cards;
          const topTarget = tCol[tCol.length - 1];
          if ((!topTarget && colCards.length > 1) || (topTarget?.faceUp && topTarget.color !== bottom.color && topTarget.value === bottom.value + 1)) {
            const targetCards = [...tCol, bottom];
            const srcCards = colCards.slice(0, -1);
            if (srcCards.length > 0 && !srcCards[srcCards.length - 1].faceUp) {
              srcCards[srcCards.length - 1].faceUp = true;
            }
            totalScore += 1 + countAvailableMoves(deepCopyCols.map((oc, ocIdx) => ocIdx === c ? { cards: srcCards } : ocIdx === targetCol ? { cards: targetCards } : oc), fndsCopy) * 0.5;
            break;
          }
        }
      }
    }
    return Math.round(totalScore);
  }, [countAvailableMoves]);

  const dealNewGame = useCallback((lv: number) => {
    const maxVal = getMaxVal(lv);
    const deck: Card[] = [];
    const suits: { s: Suit; c: Color }[] = [
      { s: '♥', c: 'R' }, { s: '♦', c: 'R' }, { s: '♠', c: 'B' }, { s: '♣', c: 'B' }
    ];
    suits.forEach((suitInfo) => {
      for (let v = 1; v <= maxVal; v++) {
        deck.push({ id: `${suitInfo.s}${v}`, suit: suitInfo.s, color: suitInfo.c, value: v, faceUp: false, x: 0, y: 0 });
      }
    });

    const makeAttempt = () => {
      const d = [...deck].sort(() => Math.random() - 0.5).map(c => ({ ...c, faceUp: false }));
      const cols: Column[] = Array.from({ length: 6 }, () => ({ cards: [] }));
      const total = d.length;
      const basePerCol = Math.max(2, Math.floor((total - 21) / 6));
      let idx = 0;
      for (let c = 0; c < 6; c++) {
        const count = basePerCol + c + 1;
        for (let i = 0; i < count && idx < total; i++) {
          cols[c].cards.push(d[idx++]);
        }
      }
      while (idx < total) {
        const targetCol = idx % 6;
        cols[targetCol].cards.push(d[idx++]);
      }
      cols.forEach((col) => {
        if (col.cards.length === 0) return;
        col.cards[col.cards.length - 1].faceUp = true;
        if (col.cards.length > 1 && !col.cards[col.cards.length - 2].faceUp) {
          col.cards[col.cards.length - 2].faceUp = true;
        }
      });
      const hasAllFaceUp = cols.every(col => col.cards.length === 0 || col.cards[col.cards.length - 1].faceUp);
      if (!hasAllFaceUp) {
        cols.forEach(col => {
          if (col.cards.length > 0) col.cards[col.cards.length - 1].faceUp = true;
        });
      }
      const fnds: Column[] = Array.from({ length: 4 }, () => ({ cards: [] }));
      return { cols, fnds };
    };

    const minRequiredMoves = lv <= 2 ? 2 : 3 + lv * 2;
    let bestAttempt = makeAttempt();
    let bestMoveCount = countMovesWithDepth(bestAttempt.cols, bestAttempt.fnds);
    let tries = 0;
    const maxTries = lv <= 2 ? 100 : Math.min(300, 100 + lv * 30);

    while (tries < maxTries) {
      const attempt = makeAttempt();
      const moveCount = countMovesWithDepth(attempt.cols, attempt.fnds);
      if (moveCount > bestMoveCount) {
        bestAttempt = attempt;
        bestMoveCount = moveCount;
        if (bestMoveCount >= minRequiredMoves) break;
      }
      tries++;
    }

    if (bestMoveCount < 1) {
      const fallbackTries = lv <= 2 ? 30 : 60 + lv * 10;
      for (let t = 0; t < fallbackTries; t++) {
        const attempt = makeAttempt();
        if (canMoveFromState(attempt.cols, attempt.fnds)) {
          bestAttempt = attempt;
          break;
        }
      }
    }

    columnsRef.current = bestAttempt.cols;
    foundationsRef.current = bestAttempt.fnds;
    setGameOverState('playing');
  }, [canMoveFromState, getMaxVal, countAvailableMoves]);

  const initGame = useCallback(() => {
    localStorage.setItem(LEVEL_STORAGE_KEY, String(level));
    dealNewGame(level);
  }, [dealNewGame, level]);

  const checkStuck = useCallback(() => {
    console.log('=== Checking if stuck ===');
    for (let c = 0; c < 6; c++) {
       const col = columnsRef.current[c].cards;
       if (col.length > 0) {
          const bottomCard = col[col.length - 1];
          console.log(`Col ${c}: top card = ${bottomCard.value}${bottomCard.suit}, faceUp=${bottomCard.faceUp}`);
          if (bottomCard.faceUp) {
             for (let f = 0; f < 4; f++) {
                const fCol = foundationsRef.current[f].cards;
                const topF = fCol[fCol.length - 1];
                if ((!topF && bottomCard.value === 1) || 
                    (topF && topF.suit === bottomCard.suit && topF.value === bottomCard.value - 1)) {
                   console.log('Move to foundation possible');
                   return false;
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
                if (i > 0 && !sCol[i-1].faceUp) {
                   console.log(`Move ${dragCard.value}${dragCard.suit} to empty col ${targetCol} possible`);
                   return false;
                }
             } else {
                if (topTarget.color !== dragCard.color && topTarget.value === dragCard.value + 1) {
                   if (i > 0 && !sCol[i-1].faceUp) {
                      console.log(`Move ${dragCard.value}${dragCard.suit} to ${topTarget.value}${topTarget.suit} possible`);
                      return false;
                   }
                   if (i === 0) {
                      console.log(`Move ${dragCard.value}${dragCard.suit} to ${topTarget.value}${topTarget.suit} possible`);
                      return false;
                   }
                   if (i > 0 && sCol[i-1].faceUp) {
                      const leftBehind = sCol[i-1];
                      for (let f = 0; f < 4; f++) {
                         const fC = foundationsRef.current[f].cards;
                         const tF = fC[fC.length - 1];
                         if ((!tF && leftBehind.value === 1) || 
                             (tF && tF.suit === leftBehind.suit && tF.value === leftBehind.value - 1)) {
                            console.log(`Move ${dragCard.value}${dragCard.suit} to ${topTarget.value}${topTarget.suit} possible (left behind can go to foundation)`);
                            return false;
                         }
                      }
                   }
                }
             }
          }
       }
    }
    console.log('NO MOVES FOUND - GAME STUCK');
    return true;
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
           cy += card.faceUp ? cardH * 0.25 : cardH * 0.08;
        });
     });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (gameOverState !== 'playing') {
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
       currY += cardH * 0.25;
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
    const maxVal = getMaxVal(level);
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

     ctx.fillStyle = '#fff';
     ctx.beginPath(); ctx.roundRect(card.x, card.y, cardW, cardH, 5); ctx.fill();

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

    if (gameOverState === 'win') {
       ctx.fillStyle = 'rgba(0,0,0,0.6)';
       ctx.fillRect(0, 0, width, height);
       ctx.fillStyle = '#4ade80';
       ctx.font = `bold ${Math.min(48, width * 0.06)}px sans-serif`;
       ctx.textAlign = 'center';
       ctx.fillText('🎊 完美解开！', width/2, height/2 - 20);
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
    ctx.fillText(`关卡: ${level}`, Math.max(20, width * 0.02), Math.max(70, height * 0.1));

    requestRef.current = requestAnimationFrame(animate);
  }, [width, height, visualAcuity, level, gameOverState, cardW, cardH, marginX, getMaxVal]);

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
        className="block touch-none cursor-grab active:cursor-grabbing"
      />

      {/* Level controls (refresh is handled by GamePlayer's top-right button) */}
      <div className="absolute top-14 md:top-16 right-16 md:right-20 z-10 pointer-events-auto flex items-center gap-2">
        <button
          onClick={() => setShowLevelSelect(true)}
          className="px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-800 text-xs md:text-sm font-black shadow"
        >
          选关
        </button>
      </div>

      {showLevelSelect && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="text-lg font-black text-slate-800">经典纸牌 - 选择关卡</div>
                <div className="text-xs text-slate-500">刷新会重新发当前关的牌，不会回到第 1 关</div>
              </div>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                关闭
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Array.from({ length: MAX_LEVEL }).map((_, idx) => {
                  const lv = idx + 1;
                  const active = lv === level;
                  return (
                    <button
                      key={lv}
                      onClick={() => {
                        setShowLevelSelect(false);
                        setLevel(lv);
                        localStorage.setItem(LEVEL_STORAGE_KEY, String(lv));
                      }}
                      className={[
                        'h-10 rounded-xl font-extrabold text-sm shadow-sm transition',
                        active ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-700 hover:shadow hover:scale-[1.02]',
                      ].join(' ')}
                      title={`最大牌值: ${getMaxVal(lv)}`}
                    >
                      {lv}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-xs text-slate-500">
                当前关卡最大牌值：{getMaxVal(level)}（A ~ {getMaxVal(level)})
              </div>
            </div>
          </div>
        </div>
      )}

      {gameOverState === 'stuck' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden pointer-events-auto">
            <div className="px-5 py-6 text-center space-y-3">
              <div className="text-3xl">🤔</div>
              <div className="text-lg font-black text-slate-800">牌局卡死了</div>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => {
                    dealNewGame(level);
                    setGameOverState('playing');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-sm shadow-sm"
                >
                  刷新
                </button>
                <button
                  onClick={() => setGameOverState('stuck-closed')}
                  className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
