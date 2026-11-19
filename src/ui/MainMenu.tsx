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
      {/* Atmospheric vignette + left editorial scrim over live 3D Sanctuary Arena */}
      <div className="duel-vignette fixed inset-0 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-r from-[#07090e]/92 via-[#07090e]/52 to-transparent pointer-events-none" />

      {/* Top Strip: Brushed-Obsidian Profile Bar */}
      <div className="relative z-10 flex items-center justify-between gap-4 pointer-events-auto">
        <div className="duel-plate-subtle flex flex-wrap items-center gap-3 rounded-lg px-4 py-2 text-xs text-slate-300">
          <span className="font-semibold text-[#e5c068]">{activeDeck.name}</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono-num text-slate-100">{profile.duelPoints.toLocaleString()} PD</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono-num text-slate-300">{profile.completedStageIds.length}/6 Campaña</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('SETTINGS')}
          aria-label="Abrir Configuración"
          className="duel-plate-subtle flex items-center gap-2 px-3.5 py-2 rounded-lg text-slate-200 hover:text-[#e5c068] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#c9a04e]" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Ajustes</span>
        </button>
      </div>

      {/* Left Focal Column */}
      <div className="relative z-10 max-w-xl my-auto pointer-events-auto space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 64 64" className="w-14 h-14 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)]" aria-hidden="true">
              <polygon
                points="32,3 58,19 52,52 32,61 12,52 6,19"
                fill="#0e1118"
                stroke="#c9a04e"
                strokeWidth="2.5"
              />
              <polygon
                points="32,12 47,26 32,50 17,26"
                fill="#1f6f63"
                fillOpacity="0.9"
                stroke="#e5c068"
                strokeWidth="1.5"
              />
              <circle cx="32" cy="29" r="4.5" fill="#f3dc9b" />
            </svg>
            <div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-[0.06em] text-[#f8f3e6] leading-none drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]">
                DUEL ARENA
              </h1>
              <p className="font-display text-xs sm:text-sm tracking-[0.28em] text-[#e5c068] mt-1.5">
                LEGACY OF THE CARDS
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300/90 max-w-md leading-relaxed">
            Duelos tácticos en mesa 3D con reglas Master Rule 4/5, catálogo oficial YGOPRODeck, mazos .ydk, invocaciones especiales y motor de cadenas LIFO.
          </p>
        </div>

        {/* Primary Play Plate */}
        <div className="duel-plate rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide text-slate-300">
              Dificultad del Duelo Rápido
            </span>
            <div className="flex items-center gap-1 p-1 bg-black/45 rounded-lg border border-white/10">
              {diffs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDifficulty(d.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    selectedDifficulty === d.id
                      ? 'duel-btn-gold font-bold'
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
              className="duel-btn-gold flex-1 min-w-[200px] flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg font-bold text-sm sm:text-base tracking-wide transition-all cursor-pointer"
            >
              <Swords className="w-5 h-5" />
              <span>Iniciar Duelo vs IA</span>
            </button>

            <button
              type="button"
              onClick={onStartPractice}
              className="duel-btn-slate flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 text-[#45b89e]" />
              <span>Modo Práctica</span>
            </button>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { view: 'CAMPAIGN' as ScreenView, label: 'Campaña', icon: Trophy },
            { view: 'DECK_BUILDER' as ScreenView, label: 'Mazos', icon: Layers },
            { view: 'LIBRARY' as ScreenView, label: 'Biblioteca', icon: BookOpen },
            { view: 'FREE_MODE' as ScreenView, label: 'Modo Libre', icon: Sliders },
            { view: 'HISTORY' as ScreenView, label: 'Historial', icon: History },
            { view: 'SETTINGS' as ScreenView, label: 'Opciones', icon: Shield },
          ].map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              className="duel-plate-subtle group flex items-center gap-2.5 px-4 py-3 rounded-lg hover:border-[#c9a04e]/60 text-left transition-all cursor-pointer"
            >
              <Icon className="w-4 h-4 text-[#c9a04e] group-hover:text-[#f3dc9b] shrink-0 transition-colors" />
              <span className="text-sm font-semibold text-slate-100 group-hover:text-[#f8f3e6] whitespace-nowrap">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Control Hint */}
      <div className="relative z-10 text-[11px] tracking-wide text-slate-400/90 flex flex-wrap items-center gap-3">
        <span>Enter / Espacio — Duelo Rápido</span>
        <span className="text-slate-600">·</span>
        <span>Esc — Pausa en Duelo</span>
        <span className="text-slate-600">·</span>
        <span>Clic en cartas y zonas 3D para jugar</span>
      </div>
    </div>
  );
};
