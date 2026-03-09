import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameComponentProps } from '../../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings, CheckCircle, RefreshCcw, Timer, Eye, EyeOff, Cat, Dog, Rabbit, Bird, Fish, Bug } from 'lucide-react';
import { renderCommonBackground } from '../../utils/visualRendering';
import { playSound } from '../../utils/gameUtils';

const STORAGE_KEY = 'rsxl_crp_pixels_per_mm';
const DEFAULT_TRAINING_TIME = 180; // 3 minutes

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

type OptotypeType = 'E' | 'C' | 'ANIMAL';
type AnimalType = 'CAT' | 'DOG' | 'RABBIT' | 'BIRD' | 'FISH' | 'BUG';
const ANIMALS: AnimalType[] = ['CAT', 'DOG', 'RABBIT', 'BIRD', 'FISH', 'BUG'];
const ANIMAL_ICONS = {
    'CAT': Cat,
    'DOG': Dog,
    'RABBIT': Rabbit,
    'BIRD': Bird,
    'FISH': Fish,
    'BUG': Bug
};

const DEVICE_DISTANCES = {
    phone: 330,  // 33cm
    tablet: 400, // 400mm
    pc: 500      // 500mm
};

// Standard 1.0 optotype size at 5 meters is 7.27mm
// For 0.1 optotype size at 5 meters it's ~72.7mm
const getInitialSizeMm = (deviceType: 'phone' | 'tablet' | 'pc') => {
    const distance = DEVICE_DISTANCES[deviceType];
    return 72.7 * (distance / 5000);
};

export const CriticalPointGame: React.FC<GameComponentProps> = ({
    width,
    height,
    isPlaying,
    onScore,
    onGameOver
}) => {
    // Device detection helper
    const getDeviceType = useCallback((): 'phone' | 'tablet' | 'pc' => {
        const ua = navigator.userAgent;
        const isTablet = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isPhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && !isTablet;

        if (isPhone) return 'phone';
        if (isTablet) return 'tablet';
        return 'pc';
    }, []);

    // --- Calibration State ---
    const [pixelsPerMm, setPixelsPerMm] = useState<number | null>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? parseFloat(saved) : null;
    });
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [isChoosingOptotype, setIsChoosingOptotype] = useState(false);
    const [tempCardWidth, setTempCardWidth] = useState(400); // 110 DPI approx for 85.6mm card

    // --- Game State ---
    const [currentSizeMm, setCurrentSizeMm] = useState(() => getInitialSizeMm(getDeviceType()));
    const [lastCorrectSizeMm, setLastCorrectSizeMm] = useState(() => getInitialSizeMm(getDeviceType()) * 1.25);
    const [direction, setDirection] = useState<Direction>('RIGHT');
    const [gameState, setGameState] = useState<'IDLE' | 'CALIBRATING' | 'PLAYING' | 'RESULT'>('IDLE');
    const [timeLeft, setTimeLeft] = useState(DEFAULT_TRAINING_TIME);
    const [history, setHistory] = useState<{ size: number; correct: boolean }[]>([]);
    const [criticalTime, setCriticalTime] = useState(0); // Seconds spent in "critical zone"
    const [consecutiveWrong, setConsecutiveWrong] = useState(0); // Track consecutive wrong answers

    const [showAcuityMilestone, setShowAcuityMilestone] = useState(false);
    const [optotypeType, setOptotypeType] = useState<OptotypeType>('C');
    const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

    // Track window size for responsive scaling
    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- New Optotype State ---
    const [currentAnimal, setCurrentAnimal] = useState<AnimalType>('CAT');
    const [animalOptions, setAnimalOptions] = useState<AnimalType[]>([]);

    // --- Canvas / Background Refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const frameCountRef = useRef(0);
    const visualAcuity = localStorage.getItem('visualAcuity') || '0.2-0.4';

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync calibration temp value
    useEffect(() => {
        if (pixelsPerMm && !isCalibrating) {
            setTempCardWidth(Math.round(pixelsPerMm * 85.6));
        }
    }, [pixelsPerMm, isCalibrating]);

    // Initial check
    useEffect(() => {
        if (!pixelsPerMm) {
            const deviceType = getDeviceType();

            if (deviceType === 'phone') {
                // Phone: Auto-skip on mobile with higher default DPI (~160)
                const pmm = 160 / 25.4;
                setPixelsPerMm(pmm);
                localStorage.setItem(STORAGE_KEY, pmm.toString());
                setGameState('IDLE');
            } else {
                // Tablet or PC: Manual calibration
                setGameState('CALIBRATING');
            }
        } else {
            setGameState('IDLE');
        }
    }, [pixelsPerMm, getDeviceType]);

    // Handle Canvas DPI and resizing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
    }, [width, height]);

    // Background Animation Loop
    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        frameCountRef.current++;
        ctx.clearRect(0, 0, width, height);
        renderCommonBackground(ctx, width, height, frameCountRef.current, visualAcuity);
        requestRef.current = requestAnimationFrame(animate);
    }, [width, height, visualAcuity]);

    // Start/Stop Animation
    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, animate]);

    // Timer logic
    useEffect(() => {
        if (gameState === 'PLAYING' && isPlaying) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        endGame();
                        return 0;
                    }
                    return prev - 1;
                });

                // Critical zone check: if current size is within 30% of the minimum achieved so far
                const minSize = Math.min(...history.map(h => h.size), currentSizeMm);
                if (currentSizeMm <= minSize * 1.5) {
                    setCriticalTime(prev => prev + 1);
                }
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [gameState, isPlaying, currentSizeMm, history]);

    const endGame = () => {
        setGameState('RESULT');
        onGameOver();
    };

    const nextRound = useCallback((isCorrect: boolean) => {
        const newHistory = [...history, { size: currentSizeMm, correct: isCorrect }];
        setHistory(newHistory);

        if (isCorrect) {
            playSound('correct');
            setConsecutiveWrong(0); // Reset on correct
            setLastCorrectSizeMm(currentSizeMm);
            const nextSize = currentSizeMm / 1.259;
            setCurrentSizeMm(nextSize);
            onScore(10);

            // Device-specific 1.0 threshold
            const deviceType = getDeviceType();
            let threshold = 0.73; // PC
            if (deviceType === 'phone') threshold = 0.48;
            else if (deviceType === 'tablet') threshold = 0.58;

            if (nextSize <= threshold && !showAcuityMilestone) {
                setShowAcuityMilestone(true);
            }
        } else {
            playSound('wrong');
            const newWrongCount = consecutiveWrong + 1;
            setConsecutiveWrong(newWrongCount);

            if (newWrongCount >= 3) {
                // Stepped rollback: Find the N-th previous correct size based on failure depth
                // newWrongCount=3 -> previous (1st) correct
                // newWrongCount=4 -> 2nd previous correct, and so on
                const correctHistory = history.filter(h => h.correct).reverse();
                const rollbackIndex = newWrongCount - 3;

                if (correctHistory[rollbackIndex]) {
                    const fallbackSize = correctHistory[rollbackIndex].size;
                    setCurrentSizeMm(fallbackSize);
                    // Update lastCorrectSizeMm to the one before the fallback to maintain the "midpoint" logic if they fail again
                    if (correctHistory[rollbackIndex + 1]) {
                        setLastCorrectSizeMm(correctHistory[rollbackIndex + 1].size);
                    }
                } else {
                    // If no more history, go back to initial
                    const initial = getInitialSizeMm(getDeviceType());
                    setCurrentSizeMm(initial);
                    setLastCorrectSizeMm(initial * 1.25);
                }
            } else {
                // Normal slight rollback for 1st and 2nd wrong
                setCurrentSizeMm(prev => (prev + lastCorrectSizeMm) / 2);
            }
        }

        // Randomize next target based on type
        if (optotypeType === 'ANIMAL') {
            const next = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
            setCurrentAnimal(next);

            // Re-generate animal options (4 unique options including the correct one)
            const others = ANIMALS.filter(a => a !== next);
            const shuffled = others.sort(() => 0.5 - Math.random());
            const selected = [next, ...shuffled.slice(0, 3)].sort(() => 0.5 - Math.random());
            setAnimalOptions(selected);
        } else {
            const nextDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
            setDirection(nextDir);
        }
    }, [currentSizeMm, lastCorrectSizeMm, history, onScore, optotypeType, showAcuityMilestone]);

    // Initialize animal options if needed
    useEffect(() => {
        if (optotypeType === 'ANIMAL' && animalOptions.length === 0) {
            const others = ANIMALS.filter(a => a !== currentAnimal);
            const shuffled = others.sort(() => 0.5 - Math.random());
            const selected = [currentAnimal, ...shuffled.slice(0, 3)].sort(() => 0.5 - Math.random());
            setAnimalOptions(selected);
        }
    }, [optotypeType, currentAnimal, animalOptions.length]);

    // Handle inputs
    const handleAction = useCallback((input: Direction) => {
        if (gameState !== 'PLAYING') return;
        nextRound(input === direction);
    }, [gameState, nextRound, direction]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'PLAYING') return;
            switch (e.key) {
                case 'ArrowUp': handleAction('UP'); break;
                case 'ArrowDown': handleAction('DOWN'); break;
                case 'ArrowLeft': handleAction('LEFT'); break;
                case 'ArrowRight': handleAction('RIGHT'); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, handleAction]);

    // Calibration helpers
    const finishCalibration = () => {
        const finalPmm = tempCardWidth / 85.6; // Card is 85.6mm wide
        setPixelsPerMm(finalPmm);
        localStorage.setItem(STORAGE_KEY, finalPmm.toString());
        setGameState('IDLE');
    };

    const skipCalibration = () => {
        // Simple default: 96DPI for PC, higher for mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const defaultDpi = isMobile ? 160 : 96;
        const pmm = defaultDpi / 25.4;
        setPixelsPerMm(pmm);
        localStorage.setItem(STORAGE_KEY, pmm.toString());
        setGameState('IDLE');
    };

    // UI Renders
    if (gameState === 'CALIBRATING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-full w-full bg-slate-900 text-white p-6 overflow-y-auto">
                <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
                    <Settings className="text-blue-400" size={32} /> 屏幕尺寸校准
                </h2>

                <div className="w-full max-w-5xl bg-slate-800 p-8 sm:p-12 rounded-[2.5rem] mb-8 border border-white/5 shadow-2xl flex flex-col items-center transition-all">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider self-start">校准方法</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6 self-start max-w-md">
                        请将身份证或银行卡贴合并在屏幕上，拖动滑块使其与实体卡片完全重合。这有助于确保训练视标的物理尺寸精准无误。
                    </p>

                    <div className="w-full overflow-hidden flex justify-center mb-10 py-10 bg-slate-950/50 rounded-3xl relative border border-white/5 shadow-inner">
                        <div className="overflow-x-auto w-full flex justify-center px-10 custom-scrollbar min-h-[180px] items-center">
                            <div
                                className="bg-blue-600 rounded-xl border-2 border-blue-400 flex items-center justify-center relative shadow-2xl shrink-0 no-scrollbar"
                                style={{
                                    width: `${tempCardWidth}px`,
                                    height: `${tempCardWidth * 53.98 / 85.6}px`
                                }}
                            >
                                <div className="absolute top-2 left-4 font-mono text-[10px] opacity-30 select-none">BANK CARD REFERENCE</div>
                                <div className="w-12 h-12 bg-yellow-400/20 rounded-md"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                    <div className="w-full h-px bg-white/50"></div>
                                    <div className="h-full w-px bg-white/50"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full max-w-md space-y-4">
                        <input
                            type="range"
                            min="100"
                            max="800"
                            value={tempCardWidth}
                            onChange={(e) => setTempCardWidth(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                            <span>MIN (100PX)</span>
                            <span className="text-blue-400 text-sm font-bold">{tempCardWidth}PX</span>
                            <span>MAX (800PX)</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button
                        onClick={finishCalibration}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold transition-all shadow-lg shadow-blue-900/40"
                    >
                        完成校准
                    </button>
                    <button
                        onClick={skipCalibration}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full font-bold transition-all"
                    >
                        跳过 (使用默认值)
                    </button>
                </div>
            </div>
        );
    }

    if (gameState === 'RESULT') {
        const minSize = history.length > 0 ? Math.min(...history.map(h => h.size)) : 0;
        return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-white p-6 rounded-xl text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                <h2 className="text-3xl font-bold mb-2">训练结束</h2>
                <div className="grid grid-cols-2 gap-4 my-6 w-full max-w-sm">
                    <div className="bg-slate-800 p-4 rounded-lg">
                        <div className="text-slate-400 text-sm">最小分辨率 (MM)</div>
                        <div className="text-2xl font-bold">{minSize.toFixed(2)}</div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg">
                        <div className="text-slate-400 text-sm">关键区耗时</div>
                        <div className="text-2xl font-bold text-blue-400">{criticalTime}s</div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setGameState('IDLE');
                        const initial = getInitialSizeMm(getDeviceType());
                        setCurrentSizeMm(initial);
                        setLastCorrectSizeMm(initial * 1.25);
                        setTimeLeft(DEFAULT_TRAINING_TIME);
                        setHistory([]);
                        setCriticalTime(0);
                    }}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold transition-all"
                >
                    <RefreshCcw size={20} /> 再次训练
                </button>
            </div>
        );
    }

    // Optotype Components
    // Dynamic scaling logic: Ensure optotype doesn't overlap with controls
    const getSafeSizePx = () => {
        const pmm = pixelsPerMm || (110 / 25.4);
        const rawSizePx = currentSizeMm * pmm;

        // More conservative reserved space calculation
        // Mobile landscape usually has height < 450px
        const reservedSpace = windowHeight < 450 ? 120 : 200;
        const maxAvailableHeight = (windowHeight * 0.9) - reservedSpace;

        // Return scaled size, but ensure it's at least 20px (unless intended smaller)
        return Math.max(1, Math.min(rawSizePx, maxAvailableHeight));
    };

    const renderOptotype = () => {
        const sizePx = getSafeSizePx();
        const rotationMap = {
            'UP': '-rotate-90',
            'RIGHT': 'rotate-0',
            'DOWN': 'rotate-90',
            'LEFT': 'rotate-180'
        };

        if (optotypeType === 'E') {
            return (
                <div
                    className={`transition-all duration-300 ${rotationMap[direction]}`}
                    style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
                >
                    <div className="grid grid-cols-5 grid-rows-5 w-full h-full gap-0 bg-transparent">
                        {[...Array(5)].map((_, i) => <div key={`r1-${i}`} className="bg-black drop-shadow-sm"></div>)}
                        <div className="bg-black drop-shadow-sm"></div>
                        {[...Array(4)].map((_, i) => <div key={`r2-${i}`} className="bg-transparent"></div>)}
                        {[...Array(5)].map((_, i) => <div key={`r3-${i}`} className="bg-black drop-shadow-sm"></div>)}
                        <div className="bg-black drop-shadow-sm"></div>
                        {[...Array(4)].map((_, i) => <div key={`r4-${i}`} className="bg-transparent"></div>)}
                        {[...Array(5)].map((_, i) => <div key={`r5-${i}`} className="bg-black drop-shadow-sm"></div>)}
                    </div>
                </div>
            );
        }

        if (optotypeType === 'C') {
            // Landolt C: Circular ring with a gap
            const strokeWidth = sizePx / 5;
            const radius = (sizePx - strokeWidth) / 2;
            const center = sizePx / 2;

            return (
                <div
                    className={`transition-all duration-300 ${rotationMap[direction]}`}
                    style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
                >
                    <svg width={sizePx} height={sizePx} viewBox={`0 0 ${sizePx} ${sizePx}`}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="black"
                            strokeWidth={strokeWidth}
                            // 75% line, 25% gap. 
                            // SVG 0 is at 3 o'clock. Gap centered at 3 o'clock needs -45deg offset.
                            strokeDasharray={`${radius * 2 * Math.PI * 0.75} ${radius * 2 * Math.PI * 0.25}`}
                            strokeDashoffset={-radius * 2 * Math.PI * 0.125}
                        />
                    </svg>
                </div>
            );
        }

        if (optotypeType === 'ANIMAL') {
            const Icon = ANIMAL_ICONS[currentAnimal];
            return (
                <div style={{ width: `${sizePx}px`, height: `${sizePx}px` }} className="flex items-center justify-center">
                    <Icon size={sizePx} className="text-black drop-shadow-sm" />
                </div>
            );
        }

        return null;
    };

    return (
        <div className="relative flex flex-col h-full w-full bg-slate-50 overflow-hidden">
            {/* Background Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none z-0 opacity-100"
            />

            {/* Top Toolbar */}
            <div className={`absolute ${windowHeight < 500 ? 'top-10' : 'top-20'} right-4 z-40 flex flex-col gap-3`}>
                <button
                    onClick={() => setIsChoosingOptotype(true)}
                    className="p-3 bg-white/90 hover:bg-white text-slate-500 hover:text-blue-600 rounded-full shadow-lg border border-slate-100 transition-all active:scale-95"
                    title="选择视标类型"
                >
                    <Eye size={24} />
                </button>
                {getDeviceType() !== 'phone' && (
                    <button
                        onClick={() => setIsCalibrating(true)}
                        className="p-3 bg-white/90 hover:bg-white text-slate-500 hover:text-blue-600 rounded-full shadow-lg border border-slate-100 transition-all active:scale-95"
                        title="重新校准屏幕"
                    >
                        <Settings size={24} />
                    </button>
                )}
            </div>

            {/* Main Stage Area - Explicitly separated from controls */}
            <div className="flex-1 relative flex flex-col z-10 overflow-hidden">
                <div className="flex-1 flex items-center justify-center p-4">
                    {gameState === 'IDLE' ? (
                        <div className={`text-center space-y-4 bg-white/95 p-8 rounded-[2.5rem] shadow-2xl border border-white/50 w-full max-w-sm ${windowHeight < 450 ? 'scale-75' : ''}`}>
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-slate-800">临界点训练</h3>
                                <p className="text-xs text-slate-500 font-medium">视觉神经激活与极限适应</p>
                            </div>

                            <div className="space-y-2 py-3 border-y border-slate-100 w-full">
                                <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                                    <Eye size={14} />
                                    <span>建议训练距离</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-2xl font-black text-slate-700">
                                        {(() => {
                                            const type = getDeviceType();
                                            if (type === 'phone') return '33 厘米 (手机)';
                                            if (type === 'tablet') return '40 厘米 (平板)';
                                            return '50 厘米 (电脑)';
                                        })()}
                                    </p>
                                    <p className="text-[10px] text-slate-400">请保持坐姿固定，不要前后晃动</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative p-8 bg-white rounded-full shadow-[0_0_60px_rgba(255,255,255,1)] border-4 border-white/40 border-double">
                            {renderOptotype()}
                            {showAcuityMilestone && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 whitespace-nowrap">
                                    <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-black text-[10px] animate-bounce shadow-lg border border-yellow-500/50">
                                        目标达成：1.0 视力水平!
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Vertical safe area for controls - This ensures the optotype container above shrinks */}
                <div className={`${windowHeight < 450 ? 'h-24' : 'h-40'} shrink-0 pointer-events-none`} />
            </div>

            {/* Bottom Controls Group - Absolute positioned but height is reserved in main container */}
            <div className={`absolute bottom-4 left-2 right-2 sm:left-4 sm:right-4 flex flex-col items-center z-30`}>
                <div className={`flex flex-row items-center ${getDeviceType() === 'phone' ? 'justify-between' : 'justify-center'} gap-3 sm:gap-6 w-full max-w-2xl px-3 py-2 sm:px-6 sm:py-3 
                    ${getDeviceType() === 'phone'
                        ? 'bg-transparent border-none shadow-none backdrop-blur-none'
                        : 'bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-[3rem] border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)]'
                    }`}>

                    {/* Left: Info Column (Mobile) or individual units (PC) */}
                    <div className={`flex ${getDeviceType() === 'phone' ? 'flex-col gap-2 items-start' : 'items-center gap-6'}`}>
                        {/* Timer */}
                        <div className="flex items-center gap-1.5 bg-white/40 px-3 py-1.5 rounded-xl border border-white/50 shrink-0">
                            <Timer size={16} className="text-blue-600" />
                            <span className="font-mono text-sm sm:text-base font-black text-slate-800">
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                        </div>

                        {/* Size display - Visible on mobile info column or hidden on PC sm-break */}
                        <div className={`${getDeviceType() === 'phone' ? 'flex' : 'hidden sm:flex'} flex-col items-center gap-1 min-w-[80px]`}>
                            {gameState === 'PLAYING' && (
                                <div className="bg-slate-900/5 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <span className="text-xs font-mono font-black text-slate-800">{currentSizeMm.toFixed(2)}mm</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Interaction (Shifted right on mobile) */}
                    <div className={`${getDeviceType() === 'phone' ? 'flex-1 flex justify-end' : 'flex-1 flex justify-center'}`}>
                        {gameState === 'PLAYING' ? (
                            <div className="flex items-center gap-2 sm:gap-4">
                                {optotypeType === 'ANIMAL' ? (
                                    <div className="flex flex-row items-center gap-2">
                                        <div className="flex gap-1.5 bg-slate-900/10 p-1 rounded-xl sm:rounded-2xl">
                                            {animalOptions.map(animal => {
                                                const Icon = ANIMAL_ICONS[animal];
                                                return (
                                                    <button
                                                        key={animal}
                                                        onClick={() => nextRound(animal === currentAnimal)}
                                                        className="p-2 sm:p-4 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-lg active:scale-90 transition-all"
                                                    >
                                                        <Icon size={windowHeight < 450 ? 18 : 24} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => nextRound(false)} className="p-2 sm:p-4 bg-slate-200 text-slate-600 rounded-lg sm:rounded-xl flex items-center justify-center"><EyeOff size={20} /></button>
                                    </div>
                                ) : (
                                    <div className={`grid grid-cols-3 gap-1.5 ${windowHeight < 450 ? 'scale-75' : 'scale-90 sm:scale-100'}`}>
                                        <div />
                                        <button onClick={() => handleAction('UP')} className="p-2.5 sm:p-4 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-lg border border-slate-700"><ChevronUp size={20} /></button>
                                        <div />
                                        <button onClick={() => handleAction('LEFT')} className="p-2.5 sm:p-4 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-lg border border-slate-700"><ChevronLeft size={20} /></button>
                                        <button onClick={() => nextRound(false)} className="p-2.5 sm:p-4 bg-slate-200 text-slate-400 rounded-lg sm:rounded-xl flex items-center justify-center" title="看不清"><EyeOff size={18} /></button>
                                        <button onClick={() => handleAction('RIGHT')} className="p-2.5 sm:p-4 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-lg border border-slate-700"><ChevronRight size={20} /></button>
                                        <div />
                                        <button onClick={() => handleAction('DOWN')} className="p-2.5 sm:p-4 bg-slate-900 text-white rounded-lg sm:rounded-xl shadow-lg border border-slate-700"><ChevronDown size={20} /></button>
                                        <div />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => setGameState('PLAYING')} className="px-6 py-2 sm:px-8 sm:py-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg">开始训练</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Overlay for Calibration Re-entry */}
            {isCalibrating && (
                <div className="absolute inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCalibrating(false)}></div>
                    <div className="absolute inset-4 sm:inset-10 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto">
                            {/* Render Calibration UI ONLY */}
                            <div className="flex flex-col items-center justify-center min-h-full p-6 text-white">
                                <h2 className="text-2xl font-bold mb-6">重新校准屏幕</h2>

                                <div className="w-full max-w-5xl bg-slate-800 p-8 sm:p-12 rounded-[2.5rem] mb-8 border border-white/5 shadow-2xl flex flex-col items-center transition-all">
                                    <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider self-start">校准方法</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-6 self-start max-w-md">
                                        请将身份证或银行卡贴合并在屏幕上，拖动滑块使其与实体卡片完全重合。
                                    </p>
                                    <div className="w-full overflow-hidden flex justify-center mb-10 py-10 bg-slate-950/50 rounded-3xl relative border border-white/5 shadow-inner">
                                        <div className="overflow-x-auto w-full flex justify-center px-10 custom-scrollbar min-h-[180px] items-center">
                                            <div
                                                className="bg-blue-600 rounded-xl border-2 border-blue-400 flex items-center justify-center relative shadow-2xl shrink-0"
                                                style={{
                                                    width: `${tempCardWidth}px`,
                                                    height: `${tempCardWidth * 53.98 / 85.6}px`
                                                }}
                                            >
                                                <div className="w-12 h-12 bg-yellow-400/20 rounded-md"></div>
                                                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                                    <div className="w-full h-px bg-white/50"></div>
                                                    <div className="h-full w-px bg-white/50"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="100"
                                        max="800"
                                        value={tempCardWidth}
                                        onChange={(e) => setTempCardWidth(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-2"
                                    />
                                    <div className="w-full flex justify-between text-[10px] text-slate-500 font-mono">
                                        <span>MIN</span>
                                        <span>{tempCardWidth}PX</span>
                                        <span>MAX</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => {
                                            const finalPmm = tempCardWidth / 85.6;
                                            setPixelsPerMm(finalPmm);
                                            localStorage.setItem(STORAGE_KEY, finalPmm.toString());
                                            setIsCalibrating(false);
                                            if (gameState === 'CALIBRATING') setGameState('IDLE');
                                        }}
                                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                                    >
                                        保存设置
                                    </button>
                                    <button
                                        onClick={() => setIsCalibrating(false)}
                                        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-all active:scale-95"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Overlay for Optotype Selection */}
            {isChoosingOptotype && (
                <div className="absolute inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsChoosingOptotype(false)}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-8 border border-white/5">
                        <h2 className="text-2xl font-bold mb-6 text-white text-center">选择训练视标</h2>

                        <div className="grid grid-cols-1 gap-4 mb-8">
                            {(['C', 'E', 'ANIMAL'] as OptotypeType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setOptotypeType(type);
                                        setIsChoosingOptotype(false);
                                    }}
                                    className={`p-6 rounded-2xl font-bold flex items-center gap-6 transition-all border-2 ${optotypeType === type
                                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${optotypeType === type ? 'bg-white/20' : 'bg-slate-700'}`}>
                                        {type === 'C' && <span className="text-2xl">C</span>}
                                        {type === 'E' && <span className="text-2xl font-serif">E</span>}
                                        {type === 'ANIMAL' && <Cat size={28} />}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-lg">{type === 'C' ? 'Landolt C' : type === 'E' ? 'Snellen E' : '趣味动物识别'}</div>
                                        <div className="text-xs font-normal opacity-60">
                                            {type === 'C' ? '标准医疗级视力表视标' : type === 'E' ? '通用标准 E 字视标' : '包含猫、狗、鸟等 6 种萌宠'}
                                        </div>
                                    </div>
                                    {optotypeType === type && <CheckCircle size={24} className="ml-auto text-blue-200" />}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsChoosingOptotype(false)}
                            className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
