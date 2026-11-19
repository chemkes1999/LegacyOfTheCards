import React, { useEffect } from 'react';
import {
  BookOpen,
  History,
  Layers,
  Play,
  Settings,
  Shield,
  Sliders,
  Swords,
  Trophy,
} from 'lucide-react';
import { AIDifficulty, PlayerProfileSave, ScreenView } from '../types/tcg';
import { GameManager } from '../engine/GameManager';

interface MainMenuProps {
  profile: PlayerProfileSave;
  selectedDifficulty: AIDifficulty;
  onSelectDifficulty: (d: AIDifficulty) => void;
  onStartQuickDuel: () => void;
  onStartPractice: () => void;
  onNavigate: (view: ScreenView) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  selectedDifficulty,
  onSelectDifficulty,
  onStartQuickDuel,
  onStartPractice,
  onNavigate,
}) => {
  const activeDeck = GameManager.getActiveDeck(profile);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
        e.preventDefault();
        onStartQuickDuel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartQuickDuel]);

  const diffs: { id: AIDifficulty; label: string }[] = [
    { id: 'EASY', label: 'Fácil' },
    { id: 'NORMAL', label: 'Normal' },
    { id: 'EXPERT', label: 'Experto' },
  ];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 lg:p-10">
      {/* Subtle left-side contrast scrim so typography is crisp over the live 3D arena */}
      <div className="fixed inset-0 bg-gradient-to-r from-[#070a12]/90 via-[#070a12]/45 to-transparent pointer-events-none" />

      {/* Top Strip: Player Profile Summary */}
      <div className="relative z-10 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <span className="font-semibold text-amber-300">Mazo activo: {activeDeck.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">{profile.duelPoints} PD</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">{profile.completedStageIds.length}/6 Campaña</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('SETTINGS')}
          aria-label="Abrir Configuración"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 hover:border-amber-400/70 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-medium whitespace-nowrap">Ajustes</span>
        </button>
      </div>

      {/* Left Focal Column: Custom SVG Emblem + Primary CTA + Modes */}
      <div className="relative z-10 max-w-xl my-auto pointer-events-auto space-y-6">
        <div className="space-y-3">
          {/* Custom inline SVG Crest Lockup */}
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="w-14 h-14 shrink-0" aria-hidden="true">
              <polygon
                points="32,4 58,20 52,52 32,60 12,52 6,20"
                fill="#0f172a"
                stroke="#d4a53a"
                strokeWidth="2.5"
              />
              <polygon
                points="32,12 48,26 32,50 16,26"
                fill="#0284c7"
                fillOpacity="0.85"
                stroke="#7dd3fc"
                strokeWidth="1.5"
              />
              <circle cx="32" cy="30" r="5" fill="#fde047" />
            </svg>
            <div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
                DUEL ARENA
              </h1>
              <p className="font-display text-sm sm:text-base tracking-widest text-amber-300 mt-1">
                LEGACY OF THE CARDS
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
            Duelos tácticos en campo 3D con invocaciones de Fusión, Sincronía, Xyz, Péndulo, Enlace y Ritual, motor de cadenas LIFO e inteligencia artificial adaptativa.
          </p>
        </div>

        {/* Difficulty Selector + Primary Start CTA */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-300">Dificultad del Duelo Rápido</span>
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {diffs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDifficulty(d.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    selectedDifficulty === d.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStartQuickDuel}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base transition-colors cursor-pointer"
            >
              <Swords className="w-5 h-5" />
              <span>Iniciar Duelo vs IA</span>
            </button>

            <button
              type="button"
              onClick={onStartPractice}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Modo Práctica</span>
            </button>
          </div>
        </div>

        {/* Mode Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('CAMPAIGN')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-amber-400/70 text-left transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Campaña</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('DECK_BUILDER')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-sky-400/70 text-left transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Mazos</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('LIBRARY')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-emerald-400/70 text-left transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Biblioteca</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('FREE_MODE')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-purple-400/70 text-left transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Modo Libre</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('HISTORY')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-cyan-400/70 text-left transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Historial</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('SETTINGS')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-slate-500 text-left transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">Opciones</span>
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin Control Hint */}
      <div className="relative z-10 text-xs text-slate-400 flex items-center gap-3">
        <span>Enter / Espacio Duelo Rápido</span>
        <span aria-hidden="true">·</span>
        <span>Esc Pausa en Duelo</span>
        <span aria-hidden="true">·</span>
        <span>Clic en cartas y zonas 3D para jugar</span>
      </div>
    </div>
  );
};
