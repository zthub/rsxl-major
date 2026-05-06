
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GameComponentProps } from '../../types';
import { renderCommonBackground } from '../../utils/visualRendering';
import { MERGE_FRUITS, playSound } from '../../utils/gameUtils';

interface Fruit {
    id: number; x: number; y: number; level: number; radius: number;
    vx: number; vy: number; isStatic: boolean;
    owner?: 'left' | 'right';
}

interface Decoration {
    id: number;
    x: number;
    y: number;
    icon: string;
    rotation: number;
    scale: number;
    state: 'FLOATING' | 'DOCKED';
    targetX?: number;
    targetY?: number;
    speechBubble?: { text: string; timer: number };
    owner?: 'left' | 'right';
}

const CHARMS = [
    { icon: '🧸', label: '我是小熊' },
    { icon: '🐰', label: '我是小兔' },
    { icon: '🐱', label: '喵喵喵' },
    { icon: '🐶', label: '汪汪汪' },
    { icon: '🦄', label: '我是独角兽' },
    { icon: '🐸', label: '孤寡孤寡' },
    { icon: '🐥', label: '叽叽叽' },
    { icon: '🐼', label: '我是熊猫' },
    { icon: '🍄', label: '采蘑菇' },
    { icon: '🌸', label: '春天来了' },
    { icon: '⭐', label: '一闪一闪' },
    { icon: '🍭', label: '好甜呀' }
];

export const WatermelonGame: React.FC<GameComponentProps> = ({ width, height, isPlaying, onScore }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const frameCountRef = useRef(0);
    const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

    const [isTwoPlayer, setIsTwoPlayer] = useState(() => localStorage.getItem('watermelonGameTwoPlayer') === 'true');
    const isTwoPlayerRef = useRef(isTwoPlayer);
    useEffect(() => { isTwoPlayerRef.current = isTwoPlayer; }, [isTwoPlayer]);
    const [leftScore, setLeftScore] = useState(0);
    const [rightScore, setRightScore] = useState(0);
    const [leftFailed, setLeftFailed] = useState(false);
    const [rightFailed, setRightFailed] = useState(false);
    const [gameOverState, setGameOverState] = useState(false);

    const leftScoreRef = useRef(0);
    const rightScoreRef = useRef(0);
    const leftFailedRef = useRef(false);
    const rightFailedRef = useRef(false);
    const leftDangerCounterRef = useRef(0);
    const rightDangerCounterRef = useRef(0);

    const fruitsRef = useRef<Fruit[]>([]);
    const decorationsRef = useRef<Decoration[]>([]);
    const currentFruitRef = useRef<Fruit | null>(null);
    const isDroppingRef = useRef(false);

    const leftCurrentFruitRef = useRef<Fruit | null>(null);
    const rightCurrentFruitRef = useRef<Fruit | null>(null);
    const leftDroppingRef = useRef(false);
    const rightDroppingRef = useRef(false);
    
    // ID of the watermelon waiting to be clicked (Game pauses spawning when this is set)
    const waitingForClickIdRef = useRef<number | null>(null);
    const waitingForClickIdLeftRef = useRef<number | null>(null);
    const waitingForClickIdRightRef = useRef<number | null>(null);

    // 初始化标记 Ref
    const initializedRef = useRef(false);

    // 拖动状态跟踪
    const draggingDecorationRef = useRef<number | null>(null); // 正在拖动的装饰ID
    const dragStartPosRef = useRef<{x: number, y: number} | null>(null); // 拖动开始位置
    const dragOffsetRef = useRef<{x: number, y: number} | null>(null); // 拖动偏移量
    const clickTimerRef = useRef<number | null>(null); // 用于区分单击和长按的计时器
    const clickDecorationRef = useRef<number | null>(null); // 单击的装饰ID

    const getMaxLevelOnBoard = (owner?: 'left' | 'right') => {
        const fruits = owner
            ? fruitsRef.current.filter(f => f.owner === owner)
            : fruitsRef.current;
        return fruits.reduce((max, f) => Math.max(max, f.level), 0);
    };

    const generateFruitLevel = (maxUnlockLevel: number) => {
        const r = Math.random();
        let level = 0;

        if (maxUnlockLevel === 3) {
            if (r < 0.35) level = 0;
            else if (r < 0.65) level = 1;
            else if (r < 0.85) level = 2;
            else level = 3;
        } else if (maxUnlockLevel === 4) {
            if (r < 0.30) level = 0;
            else if (r < 0.55) level = 1;
            else if (r < 0.75) level = 2;
            else if (r < 0.88) level = 3;
            else level = 4;
        } else {
            if (r < 0.25) level = 0;
            else if (r < 0.45) level = 1;
            else if (r < 0.65) level = 2;
            else if (r < 0.80) level = 3;
            else if (r < 0.90) level = 4;
            else level = 5;
        }
        return level;
    };

    const spawnNextFruit = useCallback(() => {
        const minDimension = Math.min(width, height);

        let maxUnlockLevel = 3;
        const maxLevelOnBoard = getMaxLevelOnBoard();

        if (maxLevelOnBoard >= 4) maxUnlockLevel = 4;
        if (maxLevelOnBoard >= 6) maxUnlockLevel = 5;

        const level = generateFruitLevel(maxUnlockLevel);
        const fruitInfo = MERGE_FRUITS[level];
        const radius = minDimension * fruitInfo.radiusRatio;

        currentFruitRef.current = {
            id: Date.now(), x: width / 2, y: 110, level, radius,
            vx: 0, vy: 0, isStatic: true
        };
        isDroppingRef.current = false;
    }, [width, height]);

    const spawnLeftFruit = useCallback(() => {
        const minDimension = Math.min(width, height);

        let maxUnlockLevel = 3;
        const maxLevelOnBoard = getMaxLevelOnBoard('left');

        if (maxLevelOnBoard >= 4) maxUnlockLevel = 4;
        if (maxLevelOnBoard >= 6) maxUnlockLevel = 5;

        const level = generateFruitLevel(maxUnlockLevel);
        const fruitInfo = MERGE_FRUITS[level];
        const radius = minDimension * fruitInfo.radiusRatio;

        leftCurrentFruitRef.current = {
            id: Date.now(), x: width * 0.25, y: 110, level, radius,
            vx: 0, vy: 0, isStatic: true, owner: 'left'
        };
        leftDroppingRef.current = false;
    }, [width, height]);

    const spawnRightFruit = useCallback(() => {
        const minDimension = Math.min(width, height);

        let maxUnlockLevel = 3;
        const maxLevelOnBoard = getMaxLevelOnBoard('right');

        if (maxLevelOnBoard >= 4) maxUnlockLevel = 4;
        if (maxLevelOnBoard >= 6) maxUnlockLevel = 5;

        const level = generateFruitLevel(maxUnlockLevel);
        const fruitInfo = MERGE_FRUITS[level];
        const radius = minDimension * fruitInfo.radiusRatio;

        rightCurrentFruitRef.current = {
            id: Date.now() + 1, x: width * 0.75, y: 110, level, radius,
            vx: 0, vy: 0, isStatic: true, owner: 'right'
        };
        rightDroppingRef.current = false;
    }, [width, height]);

    const initGame = useCallback(() => {
        fruitsRef.current = [];
        decorationsRef.current = [];
        waitingForClickIdRef.current = null;
        waitingForClickIdLeftRef.current = null;
        waitingForClickIdRightRef.current = null;
        isDroppingRef.current = false;
        leftDroppingRef.current = false;
        rightDroppingRef.current = false;
        leftScoreRef.current = 0;
        rightScoreRef.current = 0;
        leftFailedRef.current = false;
        rightFailedRef.current = false;
        leftDangerCounterRef.current = 0;
        rightDangerCounterRef.current = 0;
        setLeftScore(0);
        setRightScore(0);
        setLeftFailed(false);
        setRightFailed(false);
        setGameOverState(false);
        if (isTwoPlayerRef.current) {
            spawnLeftFruit();
            spawnRightFruit();
        } else {
            spawnNextFruit();
        }
    }, [spawnNextFruit, spawnLeftFruit, spawnRightFruit]);

    // 初始化游戏
    useEffect(() => {
        if(isPlaying && !initializedRef.current) {
            initializedRef.current = true;
            initGame();
        }
    }, [isPlaying, initGame]);

    // 处理交互开始（点击/触摸开始）
    const handleInteractionStart = (clientX: number, clientY: number) => {
        if (!isPlaying) return;

        if (gameOverState) {
            if (isTwoPlayer) {
                const panelH = height * 0.45;
                const panelY = height * 0.2;
                const btnW = Math.min(110, width * 0.25);
                const btnH = 36;
                const btnY = panelY + panelH + 20;
                const leftBtnX = width / 2 - btnW - 8;
                const rightBtnX = width / 2 + 8;

                if (clientY >= btnY && clientY <= btnY + btnH) {
                    if (clientX >= leftBtnX && clientX <= leftBtnX + btnW) {
                        setGameOverState(false);
                        initGame();
                        return;
                    }
                    if (clientX >= rightBtnX && clientX <= rightBtnX + btnW) {
                        onScore(leftScoreRef.current + rightScoreRef.current);
                        return;
                    }
                }
            }
            return;
        }

        for (const dec of decorationsRef.current) {
            // 使用实际的挂件大小作为检测区域，而不是固定的60像素
            // 挂件的实际大小是 dec.scale * 25 (字体大小) 的一半作为半径
            const actualSize = dec.scale * 25 * 0.6; // 0.6倍大小作为检测半径，提供一点容错
            if (Math.hypot(clientX - dec.x, clientY - dec.y) < actualSize) {
                // 记录点击的装饰ID和位置
                clickDecorationRef.current = dec.id;
                dragStartPosRef.current = { x: clientX, y: clientY };
                dragOffsetRef.current = { x: clientX - dec.x, y: clientY - dec.y };
                
                // 启动计时器，区分单击和长按拖动
                if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                clickTimerRef.current = window.setTimeout(() => {
                    // 长按超过200ms，开始拖动
                    draggingDecorationRef.current = dec.id;
                    // 将挂件设置为浮动状态，以便可以拖动
                    dec.state = 'FLOATING';
                    dec.targetX = undefined;
                    dec.targetY = undefined;
                }, 200);
                
                return;
            }
        }

        // 2. 检查是否处于"点击大西瓜"模式
        if (isTwoPlayer) {
            const isLeftSide = clientX < width / 2;
            if (isLeftSide && leftFailedRef.current) return;
            if (!isLeftSide && rightFailedRef.current) return;

            const waitingId = isLeftSide ? waitingForClickIdLeftRef.current : waitingForClickIdRightRef.current;
            if (waitingId !== null) {
                const targetFruit = fruitsRef.current.find(f => f.id === waitingId);
                
                if (targetFruit) {
                    const dist = Math.hypot(clientX - targetFruit.x, clientY - targetFruit.y);
                    if (dist < targetFruit.radius * 1.2) { 
                        const usedIcons = new Set(decorationsRef.current.map(d => d.icon));
                        const availableCharms = CHARMS.filter(c => !usedIcons.has(c.icon));
                        const finalPool = availableCharms.length > 0 ? availableCharms : CHARMS;
                        const charm = finalPool[Math.floor(Math.random() * finalPool.length)];
                        
                        const charmX = isLeftSide ? Math.min(targetFruit.x, width / 2 - 30) : Math.max(targetFruit.x, width / 2 + 30);
                        decorationsRef.current.push({
                            id: Date.now(),
                            x: charmX,
                            y: targetFruit.y,
                            icon: charm.icon,
                            rotation: (Math.random() - 0.5) * 0.5,
                            scale: targetFruit.radius / 30,
                            state: 'FLOATING',
                            speechBubble: { text: "哇!", timer: 60 },
                            owner: isLeftSide ? 'left' : 'right'
                        });
                        
                        fruitsRef.current = fruitsRef.current.filter(f => f.id !== waitingId);
                        if (isLeftSide) waitingForClickIdLeftRef.current = null;
                        else waitingForClickIdRightRef.current = null;
                        
                        playSound('correct');
                        onScore(500); 
                        
                        const currentFruit = isLeftSide ? leftCurrentFruitRef.current : rightCurrentFruitRef.current;
                        const isDropping = isLeftSide ? leftDroppingRef.current : rightDroppingRef.current;
                        if (!currentFruit && !isDropping) {
                            setTimeout(() => isLeftSide ? spawnLeftFruit() : spawnRightFruit(), 500);
                        }
                    }
                }
                return; 
            }

            const sideFruitRef = isLeftSide ? leftCurrentFruitRef : rightCurrentFruitRef;
            const sideDroppingRef = isLeftSide ? leftDroppingRef : rightDroppingRef;

            if (!sideFruitRef.current || sideDroppingRef.current) return;
            
            if (clientY > 140) { 
                sideDroppingRef.current = true;
                const fruit = sideFruitRef.current;
                const maxX = isLeftSide ? width / 2 - fruit.radius - 5 : width - fruit.radius;
                const minX = isLeftSide ? fruit.radius : width / 2 + fruit.radius + 5;
                fruit.x = Math.max(minX, Math.min(maxX, clientX));
                fruit.isStatic = false; 
                fruitsRef.current.push(fruit);
                sideFruitRef.current = null;
                playSound('shoot'); 
                setTimeout(() => isLeftSide ? spawnLeftFruit() : spawnRightFruit(), 600); 
            }
            return;
        }

        if (waitingForClickIdRef.current !== null) {
            const targetId = waitingForClickIdRef.current;
            const targetFruit = fruitsRef.current.find(f => f.id === targetId);
            
            if (targetFruit) {
                const dist = Math.hypot(clientX - targetFruit.x, clientY - targetFruit.y);
                if (dist < targetFruit.radius * 1.2) { 
                    const usedIcons = new Set(decorationsRef.current.map(d => d.icon));
                    const availableCharms = CHARMS.filter(c => !usedIcons.has(c.icon));
                    const finalPool = availableCharms.length > 0 ? availableCharms : CHARMS;
                    const charm = finalPool[Math.floor(Math.random() * finalPool.length)];
                    
                    decorationsRef.current.push({
                        id: Date.now(),
                        x: targetFruit.x,
                        y: targetFruit.y,
                        icon: charm.icon,
                        rotation: (Math.random() - 0.5) * 0.5,
                        scale: targetFruit.radius / 30, // 调小挂件大小
                        state: 'FLOATING',
                        speechBubble: { text: "哇!", timer: 60 }
                    });
                    
                    // 移除西瓜
                    fruitsRef.current = fruitsRef.current.filter(f => f.id !== targetId);
                    waitingForClickIdRef.current = null;
                    
                    playSound('correct');
                    onScore(500); 
                    
                    // 恢复生成（如果当前没有待命水果）
                    if (!currentFruitRef.current && !isDroppingRef.current) {
                        setTimeout(spawnNextFruit, 500);
                    }
                }
            }
            return; 
        }

        // 3. 正常下落逻辑
        if (!currentFruitRef.current || isDroppingRef.current) return;
        
        // Lower drop zone trigger to > 140px
        if (clientY > 140) { 
            isDroppingRef.current = true;
            const fruit = currentFruitRef.current;
            fruit.x = Math.max(fruit.radius, Math.min(width - fruit.radius, clientX));
            fruit.isStatic = false; 
            fruitsRef.current.push(fruit);
            currentFruitRef.current = null;
            playSound('shoot'); 
            setTimeout(spawnNextFruit, 600); 
        }
    };

    // 处理交互移动（拖动）
    const handleInteractionMove = (clientX: number, clientY: number) => {
        if (!isPlaying || draggingDecorationRef.current === null || dragOffsetRef.current === null) return;

        const decorationId = draggingDecorationRef.current;
        const decoration = decorationsRef.current.find(dec => dec.id === decorationId);
        
        if (decoration) {
            if (isTwoPlayer && decoration.owner === 'left') {
                clientX = Math.min(clientX, width / 2 - 5);
            }
            if (isTwoPlayer && decoration.owner === 'right') {
                clientX = Math.max(clientX, width / 2 + 5);
            }

            decoration.x = clientX - dragOffsetRef.current.x;
            decoration.y = clientY - dragOffsetRef.current.y;

            decoration.x = Math.max(25, Math.min(width - 25, decoration.x));
            decoration.y = Math.max(25, Math.min(height - 25, decoration.y));
        }
    };

    // 处理交互结束（拖动结束或单击完成）
    const handleInteractionEnd = () => {
        if (!isPlaying) return;

        // 1. 清除计时器
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }

        // 2. 检查是否完成了拖动
        if (draggingDecorationRef.current !== null) {
            const decorationId = draggingDecorationRef.current;
            const decoration = decorationsRef.current.find(dec => dec.id === decorationId);
            
            if (decoration) {
                // 将挂件设置为停靠状态，保持在当前位置
                decoration.state = 'DOCKED';
            }
            
            // 重置拖动状态
            draggingDecorationRef.current = null;
        } 
        // 3. 检查是否是单击操作（没有开始拖动）
        else if (clickDecorationRef.current !== null) {
            const decorationId = clickDecorationRef.current;
            const decoration = decorationsRef.current.find(dec => dec.id === decorationId);
            
            if (decoration) {
                const charmInfo = CHARMS.find(c => c.icon === decoration.icon);
                if (charmInfo) {
                    decoration.speechBubble = { text: charmInfo.label, timer: 120 };
                    decoration.scale *= 1.2;
                    setTimeout(() => { decoration.scale /= 1.2; }, 200);
                    playSound('shoot');
                }
            }
        }
        
        // 重置所有状态
        clickDecorationRef.current = null;
        dragStartPosRef.current = null;
        dragOffsetRef.current = null;
    };

    // 动画循环
    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        frameCountRef.current++;
        const bottomY = height - 20; 

        renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
        
        // 2. 更新装饰挂件位置
        decorationsRef.current.forEach(dec => {
            // 检查挂件是否正在被拖动
            const isDragging = draggingDecorationRef.current === dec.id;
            
            if (dec.state === 'FLOATING' && !isDragging) {
                // 智能停靠逻辑：只停靠左右，且寻找空位，往上面飘
                if (dec.targetX === undefined) {
                    // 随机选择左侧或右侧
                    const isLeft = Math.random() > 0.5;
                    const padding = 40;
                    
                    dec.targetX = isLeft ? padding + Math.random() * 10 : width - padding - Math.random() * 10;
                    
                    // 寻找不重叠的 Y 坐标，往上面飘（Y值更小，在顶部区域）
                    // 避开顶部 Header区域 (0-150)，挂件在150-300的范围内（上面区域）
                    let bestY = 150 + Math.random() * 150; // 改为上面区域：150-300
                    let maxMinDist = -1; // 寻找"距离最近邻居最远"的位置
                    
                    // 尝试 5 次随机位置，选最好的一个
                    for(let attempt=0; attempt<5; attempt++) {
                        const candidateY = 150 + Math.random() * 150; // 上面区域
                        let minDistToNeighbor = 9999;
                        
                        // 检查同侧的挂件
                        for (const other of decorationsRef.current) {
                            if (other === dec || other.targetX === undefined) continue;
                            const otherIsLeft = other.targetX < width / 2;
                            if (otherIsLeft === isLeft) {
                                const dist = Math.abs(candidateY - (other.targetY || other.y));
                                if (dist < minDistToNeighbor) minDistToNeighbor = dist;
                            }
                        }
                        
                        // 如果是第一个，直接用
                        if (minDistToNeighbor === 9999) {
                            bestY = candidateY;
                            break;
                        }

                        if (minDistToNeighbor > maxMinDist) {
                            maxMinDist = minDistToNeighbor;
                            bestY = candidateY;
                        }
                    }
                    dec.targetY = bestY;
                }
                
                // 移动 - 较快速度
                const dx = (dec.targetX! - dec.x) * 0.15;
                const dy = (dec.targetY! - dec.y) * 0.15;
                dec.x += dx;
                dec.y += dy;
                
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                    dec.state = 'DOCKED';
                }
            } else if (dec.state === 'DOCKED' || isDragging) {
                // DOCKED: 轻轻漂浮
                // 如果正在拖动，不执行漂浮动画，保持用户设置的位置
                if (!isDragging) {
                    dec.y += Math.sin(frameCountRef.current * 0.05) * 0.2;
                }
            }
            
            ctx.save();
            ctx.translate(dec.x, dec.y);
            ctx.rotate(dec.rotation + Math.sin(frameCountRef.current * 0.03) * 0.1);
            ctx.font = `${dec.scale * 25}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,255,255,0.8)';
            ctx.fillText(dec.icon, 0, 0);
            ctx.restore();
            
            if (dec.speechBubble) {
                dec.speechBubble.timer--;
                if (dec.speechBubble.timer > 0) {
                    ctx.save();
                    // 气泡方向根据位置调整
                    const isLeft = dec.x < width/2;
                    const offsetX = isLeft ? 40 : -40;
                    ctx.translate(dec.x + offsetX, dec.y - 20);
                    
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    
                    const text = dec.speechBubble.text;
                    const textW = ctx.measureText(text).width + 20;
                    ctx.beginPath();
                    ctx.roundRect(-textW/2, -15, textW, 30, 10);
                    ctx.fill(); ctx.stroke();
                    
                    ctx.fillStyle = 'black';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                } else {
                    dec.speechBubble = undefined;
                }
            }
        });

        ctx.beginPath(); ctx.moveTo(0, bottomY); ctx.lineTo(width, bottomY);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.stroke();

        if (isTwoPlayer) {
            ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3; ctx.stroke();
        }

        // 3. 物理引擎
        const gravity = 0.85;
        const leftGravity = isTwoPlayer ? 0.6 + Math.random() * 0.4 : gravity;
        const rightGravity = isTwoPlayer ? 0.6 + Math.random() * 0.4 : gravity;
        const damping = 0.2;
        const friction = 0.95;

        for (let i = 0; i < fruitsRef.current.length; i++) {
            const f = fruitsRef.current[i];

            if (f.id === waitingForClickIdRef.current ||
                f.id === waitingForClickIdLeftRef.current ||
                f.id === waitingForClickIdRightRef.current) {
                f.vx *= 0.9;
                f.vy *= 0.9;
                f.vx += (width/2 - f.x) * 0.01;
                f.vy += (height/2 - f.y) * 0.01;
            } else {
                let supported = false;
                if (f.y + f.radius >= bottomY - 2) {
                    supported = true;
                } else {
                    for (const other of fruitsRef.current) {
                        if (other.id === f.id || other.isStatic) continue;
                        if (isTwoPlayer && f.owner !== other.owner) continue;
                        const dx = other.x - f.x;
                        const dy = other.y - f.y;
                        if (dy > 0 && dy < f.radius * 0.8 && Math.abs(dx) < (f.radius + other.radius) * 0.7) {
                            supported = true;
                            break;
                        }
                    }
                }

                let g = gravity;
                if (isTwoPlayer && f.owner === 'left') g = leftGravity;
                else if (isTwoPlayer && f.owner === 'right') g = rightGravity;

                if (supported && Math.hypot(f.vx, f.vy) < 1) {
                    f.vy += g * 0.08;
                } else {
                    f.vy += g;
                }
            }

            f.vx *= friction;
            f.x += f.vx;
            f.y += f.vy;

            if (isTwoPlayer && f.owner === 'left') {
                const maxX = width / 2 - f.radius - 5;
                if (f.x > maxX) {
                    f.x = maxX;
                    f.vx = -Math.abs(f.vx) * damping;
                }
                if (f.x - f.radius < 0) {
                    f.x = f.radius;
                    f.vx = Math.abs(f.vx) * damping;
                }
            } else if (isTwoPlayer && f.owner === 'right') {
                const minX = width / 2 + f.radius + 5;
                if (f.x < minX) {
                    f.x = minX;
                    f.vx = Math.abs(f.vx) * damping;
                }
                if (f.x + f.radius > width) {
                    f.x = width - f.radius;
                    f.vx = -Math.abs(f.vx) * damping;
                }
            } else {
                if (f.x - f.radius < 0) {
                    f.x = f.radius;
                    f.vx = Math.abs(f.vx) * damping;
                } else if (f.x + f.radius > width) {
                    f.x = width - f.radius;
                    f.vx = -Math.abs(f.vx) * damping;
                }
            }

            if (f.y + f.radius > bottomY) {
                f.y = bottomY - f.radius;
                f.vy = -Math.abs(f.vy) * damping;
                if(Math.abs(f.vy) < gravity * 2) f.vy = 0;
                f.vx *= 0.8;
            }

            }

        const DANGER_THRESHOLD = 90;
        let leftInDanger = false;
        let rightInDanger = false;
        for (const f of fruitsRef.current) {
            if (!f.isStatic && f.y - f.radius < 70) {
                if (f.owner === 'left') leftInDanger = true;
                else if (f.owner === 'right') rightInDanger = true;
            }
        }
        if (leftInDanger) leftDangerCounterRef.current++; else leftDangerCounterRef.current = 0;
        if (rightInDanger) rightDangerCounterRef.current++; else rightDangerCounterRef.current = 0;

        if (leftDangerCounterRef.current > DANGER_THRESHOLD && !leftFailedRef.current) {
            leftFailedRef.current = true;
            setLeftFailed(true);
            if (rightFailedRef.current) setTimeout(() => setGameOverState(true), 1500);
        }
        if (rightDangerCounterRef.current > DANGER_THRESHOLD && !rightFailedRef.current) {
            rightFailedRef.current = true;
            setRightFailed(true);
            if (leftFailedRef.current) setTimeout(() => setGameOverState(true), 1500);
        }

        // 4. 水果碰撞与合成逻辑
        const indicesToRemove = new Set<number>();
        const newFruits: Fruit[] = [];

        for (let i = 0; i < fruitsRef.current.length; i++) {
            if (indicesToRemove.has(i)) continue;

            for (let j = i + 1; j < fruitsRef.current.length; j++) {
                if (indicesToRemove.has(j)) continue;

                const f1 = fruitsRef.current[i];
                const f2 = fruitsRef.current[j];

                if (isTwoPlayer && f1.owner !== f2.owner) continue;

                if (f1.id === waitingForClickIdRef.current ||
                    f2.id === waitingForClickIdRef.current ||
                    f1.id === waitingForClickIdLeftRef.current ||
                    f2.id === waitingForClickIdLeftRef.current ||
                    f1.id === waitingForClickIdRightRef.current ||
                    f2.id === waitingForClickIdRightRef.current) continue;

                const dx = f2.x - f1.x;
                const dy = f2.y - f1.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);
                const minDist = f1.radius + f2.radius;

                if (dist < minDist) {
                    if (f1.level === f2.level && f1.level < MERGE_FRUITS.length - 1) {
                        indicesToRemove.add(i);
                        indicesToRemove.add(j);

                        const newLevel = f1.level + 1;
                        const newRadius = Math.min(width, height) * MERGE_FRUITS[newLevel].radiusRatio;
                        const midX = (f1.x + f2.x) / 2;
                        const midY = (f1.y + f2.y) / 2;
                        const newId = Date.now() + Math.random();

                        const newFruit: Fruit = {
                            id: newId,
                            x: midX, y: midY,
                            level: newLevel, radius: newRadius,
                            vx: 0, vy: 0,
                            isStatic: false,
                            owner: f1.owner
                        };

                        newFruits.push(newFruit);

                        if (f1.owner === 'left' || (!f1.owner && !f2.owner)) {
                            leftScoreRef.current += 10 * (newLevel + 1);
                            setLeftScore(leftScoreRef.current);
                        }
                        if (f1.owner === 'right') {
                            rightScoreRef.current += 10 * (newLevel + 1);
                            setRightScore(rightScoreRef.current);
                        }
                        if (!f1.owner && !f2.owner) {
                            onScore(10 * (newLevel + 1));
                        }
                        playSound('correct');

                        if (newLevel === MERGE_FRUITS.length - 1) {
                            if (f1.owner === 'left' || (!f1.owner && !f2.owner && !isTwoPlayer)) {
                                waitingForClickIdLeftRef.current = newId;
                            }
                            if (f1.owner === 'right') {
                                waitingForClickIdRightRef.current = newId;
                            }
                            if (!isTwoPlayer) {
                                waitingForClickIdRef.current = newId;
                            }
                        }
                        break;
                    } else {
                        const angle = Math.atan2(dy, dx);
                        const overlap = minDist - dist;
                        const pushX = Math.cos(angle) * overlap * 0.6;
                        const pushY = Math.sin(angle) * overlap * 0.6;

                        f1.x -= pushX; f1.y -= pushY;
                        f2.x += pushX; f2.y += pushY;

                        const bounce = 0.12;
                        const relVn = (f2.vx - f1.vx) * Math.cos(angle) + (f2.vy - f1.vy) * Math.sin(angle);
                        if (relVn < -0.5) {
                            const impulse = relVn * bounce;
                            f1.vx += impulse * Math.cos(angle);
                            f1.vy += impulse * Math.sin(angle);
                            f2.vx -= impulse * Math.cos(angle);
                            f2.vy -= impulse * Math.sin(angle);
                        }
                    }
                }
            }
        }

        for (let iter = 0; iter < 3; iter++) {
            for (const f of fruitsRef.current) {
                if (!f.isStatic) {
                    const speed = Math.hypot(f.vx, f.vy);
                    if (speed < 0.15) { f.vx = 0; f.vy = 0; }
                }
            }
        }

        for (const f of fruitsRef.current) {
            if (!f.isStatic) {
                f.vx *= 0.88;
                f.vy *= 0.88;
            }
        }

        if (indicesToRemove.size > 0 || newFruits.length > 0) {
            fruitsRef.current = fruitsRef.current.filter((_, idx) => !indicesToRemove.has(idx));
            fruitsRef.current.push(...newFruits);
        }
        
        // 5. 绘制所有水果
        const drawFruit = (f: Fruit) => {
            const info = MERGE_FRUITS[f.level];
            const isTarget = f.id === waitingForClickIdRef.current ||
                            f.id === waitingForClickIdLeftRef.current ||
                            f.id === waitingForClickIdRightRef.current;

            ctx.save();

            if (isTarget) {
                const pulse = Math.sin(frameCountRef.current * 0.1) * 10 + 20;
                ctx.shadowBlur = pulse;
                ctx.shadowColor = '#fff';
                ctx.lineWidth = 4;

                ctx.beginPath();
                ctx.arc(f.x, f.y, f.radius + 10, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(frameCountRef.current * 0.05))})`;
                ctx.stroke();
            } else {
                ctx.lineWidth = 2;
            }

            ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
            ctx.fillStyle = info.color; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.stroke();

            ctx.font = `${f.radius}px serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(info.label, f.x, f.y + f.radius * 0.1);

            if (isTarget) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText("点击变身!", f.x, f.y - f.radius - 15);
            }

            ctx.restore();
        };

        fruitsRef.current.forEach(drawFruit);

        if (gameOverState) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, width, height);

            if (isTwoPlayer) {
                const centerX = width / 2;
                const panelW = Math.min(180, width * 0.38);
                const panelH = height * 0.45;
                const panelY = height * 0.2;
                const leftPanelX = centerX - panelW - 15;
                const rightPanelX = centerX + 15;

                [leftPanelX, rightPanelX].forEach((px, idx) => {
                    const failed = idx === 0 ? leftFailedRef.current : rightFailedRef.current;
                    const score = idx === 0 ? leftScoreRef.current : rightScoreRef.current;
                    const label = idx === 0 ? '左边' : '右边';

                    ctx.fillStyle = failed ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';
                    ctx.beginPath();
                    ctx.roundRect(px, panelY, panelW, panelH, 14);
                    ctx.fill();

                    ctx.strokeStyle = failed ? '#ef4444' : '#22c55e';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${Math.min(20, width * 0.03)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText(label, px + panelW / 2, panelY + 32);

                    if (failed) {
                        ctx.fillStyle = 'rgba(239,68,68,0.6)';
                        ctx.font = `bold ${Math.min(16, width * 0.024)}px sans-serif`;
                        ctx.fillText('已满', px + panelW / 2, panelY + panelH * 0.38);
                    }

                    ctx.fillStyle = failed ? '#ef4444' : '#22c55e';
                    ctx.font = `bold ${Math.min(30, width * 0.042)}px sans-serif`;
                    ctx.fillText(`${score}`, px + panelW / 2, panelY + panelH * 0.65);

                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.font = `${Math.min(13, width * 0.02)}px sans-serif`;
                    ctx.fillText('分', px + panelW / 2, panelY + panelH * 0.78);
                });

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.min(26, width * 0.038)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('🍉 游戏结束 🍉', centerX, panelY - 25);

                const btnW = Math.min(110, width * 0.25);
                const btnH = 36;
                const btnY = panelY + panelH + 20;
                const leftBtnX = centerX - btnW - 8;
                const rightBtnX = centerX + 8;

                [{ x: leftBtnX, color: '#22c55e', text: '继续游戏' }, { x: rightBtnX, color: '#ef4444', text: '返回列表' }].forEach(btn => {
                    ctx.fillStyle = btn.color;
                    ctx.beginPath();
                    ctx.roundRect(btn.x, btnY, btnW, btnH, 10);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${Math.min(14, width * 0.02)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText(btn.text, btn.x + btnW / 2, btnY + btnH / 2 + 5);
                });
            } else {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.min(40, width * 0.05)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('🍉 游戏结束 🍉', width/2, height/2 - 20);

                const btnW = Math.min(130, width * 0.28);
                const btnH = 40;
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.roundRect(width/2 - btnW/2, height/2 + 20, btnW, btnH, 10);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.min(16, width * 0.022)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('返回列表', width/2, height/2 + 20 + btnH/2 + 6);
            }
            requestRef.current = requestAnimationFrame(animate);
            return;
        }

        if (isTwoPlayer) {
            if (leftCurrentFruitRef.current && !leftDroppingRef.current) {
                if (waitingForClickIdLeftRef.current === null) {
                    drawFruit(leftCurrentFruitRef.current);
                }
            }
            if (rightCurrentFruitRef.current && !rightDroppingRef.current) {
                if (waitingForClickIdRightRef.current === null) {
                    drawFruit(rightCurrentFruitRef.current);
                }
            }

            if (leftFailedRef.current && !rightFailedRef.current) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 4; ctx.shadowColor = 'black';
                ctx.fillText("💥 左边失败了!", width * 0.25, 100);
                ctx.shadowBlur = 0;
            }
            if (rightFailedRef.current && !leftFailedRef.current) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 4; ctx.shadowColor = 'black';
                ctx.fillText("💥 右边失败了!", width * 0.75, 100);
                ctx.shadowBlur = 0;
            }
        } else {
            if (currentFruitRef.current && !isDroppingRef.current) {
                if (waitingForClickIdRef.current === null) {
                    drawFruit(currentFruitRef.current);
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.font = 'bold 24px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#fff';
                    ctx.shadowBlur = 4; ctx.shadowColor = 'black';
                    ctx.fillText("请点击发光的大西瓜!", width/2, 100);
                    ctx.shadowBlur = 0;
                }
            }
        }

        if (isTwoPlayer) {
            ctx.fillStyle = '#22c55e';
            ctx.font = `bold ${Math.min(18, width * 0.025)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(`左边: ${leftScoreRef.current}`, Math.max(10, width * 0.01), Math.max(100, height * 0.15));
            ctx.fillStyle = '#f97316';
            ctx.textAlign = 'left';
            ctx.fillText(`右边: ${rightScoreRef.current}`, width / 2 + Math.max(10, width * 0.01), Math.max(100, height * 0.15));
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [width, height, visualAcuity, onScore, isTwoPlayer, gameOverState, leftFailed, rightFailed, leftScore, rightScore]);

    // 设置Canvas高DPI支持
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        
        // 设置实际分辨率（物理像素）
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        // 设置CSS显示尺寸（逻辑像素）
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // 缩放上下文以匹配设备像素比
        // 注意：这个scale会一直保持，直到canvas尺寸改变
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
            ctx.scale(dpr, dpr);
        }
    }, [width, height]);

    useEffect(() => {
        if (isPlaying) requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, animate]);

    return (
        <div className="relative">
            <button
                onClick={() => { const next = !isTwoPlayer; setIsTwoPlayer(next); isTwoPlayerRef.current = next; localStorage.setItem('watermelonGameTwoPlayer', String(next)); initGame(); }}
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
            <canvas
                ref={canvasRef}
                onPointerDown={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if(rect) handleInteractionStart(e.clientX - rect.left, e.clientY - rect.top);
                }}
                onPointerMove={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if(rect) handleInteractionMove(e.clientX - rect.left, e.clientY - rect.top);
                }}
                onPointerUp={() => {
                    handleInteractionEnd();
                }}
                onPointerLeave={() => {
                    handleInteractionEnd();
                }}
                className="block touch-none cursor-pointer"
            />
        </div>
    );
};
