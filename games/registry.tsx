
import React from 'react';
import { GameComponentProps } from '../types';
// VisualStimulation removed
import { WatermelonGame } from './stimulation/WatermelonGame';
import { FindFruitGame } from './stimulation/FindFruitGame';
import { SpinShooter } from './stimulation/SpinShooter';
import { OddOneOutGame } from './stimulation/OddOneOutGame';
import { ThunderFighter } from './stimulation/ThunderFighter';
import { WhosHidingGame } from './stimulation/WhosHidingGame';
import { WhackARabbit } from './stimulation/WhackARabbit';
import { AnimalPuzzleGame } from './stimulation/AnimalPuzzleGame';
import { LogicReasoningGame } from './stimulation/LogicReasoningGame';
import { GoldMinerGame } from './stimulation/GoldMinerGame';
import { ParkingGame } from './stimulation/ParkingGame';
import DrinkShopGame from './stimulation/DrinkShopGame';
import { FineMotorGame } from './fine-motor/FineMotorGame';
import { TraceContourGame } from './fine-motor/TraceContourGame';
import { MazeGame } from './fine-motor/MazeGame';
import { HexagonGame } from './fine-motor/HexagonGame';
import { TetrisGame } from './fine-motor/TetrisGame';
import { NewTetrisGame as FineMotorNewTetrisGame } from './fine-motor/NewTetrisGame';
import { AnimalPopGame } from './fine-motor/AnimalPopGame';
import { FindRedBeanGame } from './fine-motor/FindRedBeanGame';
import { DefuseBombGridGame } from './fine-motor/DefuseBombGridGame';
import { ProtectChicksGame } from './fine-motor/ProtectChicksGame';
import { FindAvatarGame } from './fine-motor/FindAvatarGame';
import { FruitPrecisionGame } from './fine-motor/FruitPrecisionGame';
import { CriticalPointGame } from './fine-motor/CriticalPointGame';
import { SimultaneousTetrisGame } from './simultaneous/SimultaneousTetrisGame';
import { SnakeGame } from './simultaneous/SnakeGame';
import { ColorMatchGame } from './simultaneous/ColorMatchGame';
import { CatchApplesGame } from './simultaneous/CatchApplesGame';
import { FusionGame } from './fusion/FusionGame';
import { FusionPointGame } from './fusion/FusionPointGame';
import { StereoscopicGame } from './stereoscopic/StereoscopicGame';
import { DepthCatchGame } from './stereoscopic/DepthCatchGame';
import { FusionEChartGame } from './fusion/FusionEChartGame';
import { OnlineVideoPlayer } from './grating/OnlineVideoPlayer';
import { LocalVideoPlayer } from './grating/LocalVideoPlayer';
// New puzzle games
import { MemoryCardGame } from './stimulation/MemoryCardGame';
import { ColorLinkGame } from './stimulation/ColorLinkGame';
import { NumberTapGame } from './stimulation/NumberTapGame';
import { ShapeSortGame } from './stimulation/ShapeSortGame';
import { SudokuGame } from './stimulation/SudokuGame';
import { SlidePuzzleGame } from './stimulation/SlidePuzzleGame';
import { MinesweeperGame } from './stimulation/MinesweeperGame';
import { PipeConnectGame } from './stimulation/PipeConnectGame';
import { AnimalMergeGame } from './stimulation/AnimalMergeGame';
import { WordSearchGame } from './stimulation/WordSearchGame';
import { ImageSlidePuzzleGame } from './stimulation/ImageSlidePuzzleGame';

// New Action, Shooting, and Card games
import { NinjaSliceGame } from './stimulation/NinjaSliceGame';
import { JumpAdventureGame } from './stimulation/JumpAdventureGame';
import { BubbleShooterGame } from './stimulation/BubbleShooterGame';
import { SolitaireGame } from './stimulation/SolitaireGame';

// Registry mapping game IDs to their implementation components
export const GameRegistry: Record<string, React.FC<GameComponentProps>> = {
    // Stimulation
    'g1-8': OddOneOutGame,
    'g1-5': WatermelonGame,
    'g1-6': FindFruitGame,
    'g1-7': SpinShooter,
    'g1-9': ThunderFighter,
    'g1-10': WhosHidingGame,
    'g1-11': WhackARabbit,
    'g1-12': AnimalPuzzleGame,
    'g1-13': GoldMinerGame,
    'g1-14': ParkingGame,
    'g1-15': DrinkShopGame,
    'g1-16': LogicReasoningGame,
    'g1-17': MemoryCardGame,    // 记忆翻牌
    'g1-18': ColorLinkGame,     // 颜色连连看
    'g1-19': NumberTapGame,     // 数数字
    'g1-20': ShapeSortGame,     // 图形拼板
    'g1-21': SudokuGame,        // 数独挑战
    'g1-22': SlidePuzzleGame,   // 数字华容道
    'g1-29': ImageSlidePuzzleGame, // 图片华容道
    'g1-23': MinesweeperGame,   // 扫雷小勇士
    'g1-24': PipeConnectGame,   // 接水管
    'g1-25': AnimalMergeGame,   // 动物合成消消乐
    'g1-26': WordSearchGame,    // 找词语
    'g1-27': NinjaSliceGame,    // 忍者切切乐
    'g1-28': JumpAdventureGame, // 跳跃大冒险
    'g1-30': BubbleShooterGame, // 泡泡神射手
    'g1-31': SolitaireGame,     // 经典纸牌

    // Fine Motor
    'g2-1': TraceContourGame, // 连点成画
    'g2-2': FineMotorGame,
    'g2-3': MazeGame,         // 迷宫探险
    'g2-4': HexagonGame,
    'g2-5': TetrisGame,
    'g2-6': FineMotorNewTetrisGame,    // 俄罗斯方块新
    'g2-7': AnimalPopGame,    // 动物消消乐
    'g2-8': DefuseBombGridGame, // 拆炸弹（视觉精细版）
    'g2-9': ProtectChicksGame,  // 保护小鸡（视觉精细版）
    'g2-10': FindRedBeanGame,   // 找红豆（视觉精细版）
    'g2-11': FindAvatarGame,    // 找朋友（视觉精细版）
    'g2-12': FruitPrecisionGame, // 水果精细家（视觉精细版）
    'g2-13': CriticalPointGame, // 临界点训练

    // Simultaneous
    'g3-1': SimultaneousTetrisGame,
    'g3-2': SnakeGame,
    'g3-3': ColorMatchGame, // 红蓝配对消除
    'g3-4': CatchApplesGame, // 接苹果

    // Fusion
    'g4-1': FusionGame,
    'g4-2': FusionPointGame, // 融合点点击
    'g4-3': FusionEChartGame, // 融合之E字表

    // Stereoscopic
    'g5-1': StereoscopicGame,
    'g5-2': DepthCatchGame, // 深度接球

    // Grating Player
    'g6-1': OnlineVideoPlayer,
    'g6-2': LocalVideoPlayer,
};
