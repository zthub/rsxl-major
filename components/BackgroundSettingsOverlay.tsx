
import React, { useState } from 'react';
import { Layers, RefreshCcw, ChevronDown, Circle } from 'lucide-react';

interface BackgroundSettingsOverlayProps {
    className?: string;
}

export const BackgroundSettingsOverlay: React.FC<BackgroundSettingsOverlayProps> = ({ className = "" }) => {
    const [isChoosingBackground, setIsChoosingBackground] = useState(false);

    // Get current settings for UI highlights (Default to '3' for Circle as per request)
    const currentMode = localStorage.getItem('bg_stimulation_mode') || '3';
    const currentColor = localStorage.getItem('bg_color_scheme') || '0';

    const handleModeSelect = (id: string) => {
        localStorage.setItem('bg_stimulation_mode', id);
        // Reset the mode timer (90-second cycle) by saving current total time as the new baseline
        const currentTotal = localStorage.getItem('bg_total_play_seconds') || '0';
        localStorage.setItem('bg_manual_reset_seconds', currentTotal);
        
        setIsChoosingBackground(false);
    };

    const handleColorSelect = (id: string) => {
        localStorage.setItem('bg_color_scheme', id);
        // Reset the color timer (30-second cycle) by saving current total time as the new baseline
        const currentTotal = localStorage.getItem('bg_total_play_seconds') || '0';
        localStorage.setItem('bg_color_reset_seconds', currentTotal);
        
        setIsChoosingBackground(false);
    };

    return (
        <>
            {/* Float Button */}
            <div className={`fixed top-20 right-4 z-[110] ${className}`}>
                <button
                    onClick={() => setIsChoosingBackground(true)}
                    className="p-3 bg-white/90 hover:bg-white text-slate-500 hover:text-blue-600 rounded-full shadow-lg border border-slate-100 transition-all active:scale-95 group"
                    title="背景刺激设置"
                >
                    <Layers size={24} className="group-hover:rotate-12 transition-transform" />
                </button>
            </div>

            {/* Modal */}
            {isChoosingBackground && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Layers className="text-blue-400" /> 背景刺激设置
                            </h3>
                            <button onClick={() => setIsChoosingBackground(false)} className="text-slate-400 hover:text-white">
                                <ChevronDown size={28} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Mode Section */}
                            <div>
                                <label className="text-slate-400 text-[10px] font-bold mb-3 block uppercase tracking-widest">刺激模式</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: '3', label: '圆环', icon: Circle },
                                        { id: '1', label: '光栅', icon: Layers },
                                        { id: '2', label: '旋转', icon: RefreshCcw },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleModeSelect(m.id)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${currentMode === m.id
                                                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                                : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750'
                                                }`}
                                        >
                                            <m.icon size={18} />
                                            <span className="text-[10px] font-bold">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Color Section */}
                            <div>
                                <label className="text-slate-400 text-[10px] font-bold mb-3 block uppercase tracking-widest">配色方案</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: '0', label: '经典黑白', colors: ['#000', '#fff'] },
                                        { id: '1', label: '红绿对抗', colors: ['#f00', '#0f0'] },
                                        { id: '2', label: '黄蓝对比', colors: ['#ff0', '#00f'] },
                                    ].map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => handleColorSelect(c.id)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${currentColor === c.id
                                                ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                                : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750'
                                                }`}
                                        >
                                            <div className="flex -space-x-1.5">
                                                <div className="w-5 h-5 rounded-full border border-slate-900 shadow-sm" style={{ backgroundColor: c.colors[0] }} />
                                                <div className="w-5 h-5 rounded-full border border-slate-900 shadow-sm" style={{ backgroundColor: c.colors[1] }} />
                                            </div>
                                            <span className="text-[10px] font-bold">{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-slate-500 mt-2 text-center">选择后从该颜色开始，每30秒自动切换</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsChoosingBackground(false)}
                            className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all active:scale-95"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
