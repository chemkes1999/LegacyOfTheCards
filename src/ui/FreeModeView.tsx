import React, { useState } from 'react';
import { ArrowLeft, Sliders, Swords } from 'lucide-react';
import {
  BALANCED_STARTER_MAIN,
  CAMPAIGN_STAGES,
  CHAOS_STARTER_MAIN,
  STARTER_EXTRA_DECK,
} from '../data/decks';
import { AIDifficulty } from '../types/tcg';

export interface FreeDuelConfig {
  startingLP: number;
  startingHandSize: number;
  difficulty: AIDifficulty;
  opponentDeckIds: string[];
  opponentExtraIds: string[];
  opponentName: string;
}

interface FreeModeViewProps {
  onStartFreeDuel: (config: FreeDuelConfig) => void;
  onClose: () => void;
}

const OPPONENT_PRESETS = [
  {
    id: 'preset_chaos',
    name: 'Vanguardia del Caos',
    opponentName: 'Duelista del Caos',
    main: CHAOS_STARTER_MAIN,
    extra: STARTER_EXTRA_DECK,
  },
  {
    id: 'preset_dragon',
    name: 'Legado del Dragón Azul',
    opponentName: 'Duelista Espejo',
    main: BALANCED_STARTER_MAIN,
    extra: STARTER_EXTRA_DECK,
  },
  ...CAMPAIGN_STAGES.map((s) => ({
    id: s.id,
    name: `${s.deckName} (${s.opponentName})`,
    opponentName: s.opponentName,
    main: s.opponentDeckIds,
    extra: s.opponentExtraIds,
  })),
];

export const FreeModeView: React.FC<FreeModeViewProps> = ({ onStartFreeDuel, onClose }) => {
  const [startingLP, setStartingLP] = useState<number>(8000);
  const [startingHandSize, setStartingHandSize] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('NORMAL');
  const [presetId, setPresetId] = useState<string>(OPPONENT_PRESETS[0].id);

  const selectedPreset = OPPONENT_PRESETS.find((p) => p.id === presetId) ?? OPPONENT_PRESETS[0];

  const handleLaunch = () => {
    onStartFreeDuel({
      startingLP,
      startingHandSize,
      difficulty,
      opponentDeckIds: selectedPreset.main,
      opponentExtraIds: selectedPreset.extra,
      opponentName: selectedPreset.opponentName,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#070a12]/95 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Modo Libre</h2>
              <p className="text-xs text-slate-400">Personaliza las reglas y elige el mazo rival</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>

        <div className="space-y-5">
          {/* Starting LP */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Puntos de Vida Iniciales (LP)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[4000, 8000, 12000].map((lp) => (
                <button
                  key={lp}
                  type="button"
                  onClick={() => setStartingLP(lp)}
                  className={`rounded-lg py-2.5 font-mono-num text-sm font-bold border transition-colors cursor-pointer ${
                    startingLP === lp
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {lp} LP
                </button>
              ))}
            </div>
          </div>

          {/* Starting Hand */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tamaño de Mano Inicial
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[4, 5, 6].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setStartingHandSize(h)}
                  className={`rounded-lg py-2.5 font-mono-num text-sm font-bold border transition-colors cursor-pointer ${
                    startingHandSize === h
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {h} cartas
                </button>
              ))}
            </div>
          </div>

          {/* AI Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dificultad de la IA
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'EASY', label: 'Fácil' },
                  { id: 'NORMAL', label: 'Normal' },
                  { id: 'EXPERT', label: 'Experto' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-lg py-2.5 text-sm font-bold border transition-colors cursor-pointer ${
                    difficulty === d.id
                      ? 'bg-purple-500 text-white border-purple-400'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opponent Deck */}
          <div className="space-y-2">
            <label htmlFor="free-opponent-deck" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mazo del Oponente
            </label>
            <select
              id="free-opponent-deck"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
            >
              {OPPONENT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.main.length} Principal / {p.extra.length} Extra)
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3.5 text-base font-bold text-slate-950 transition-colors cursor-pointer"
        >
          <Swords className="h-5 w-5" />
          <span>Iniciar Duelo Personalizado</span>
        </button>
      </div>
    </div>
  );
};
