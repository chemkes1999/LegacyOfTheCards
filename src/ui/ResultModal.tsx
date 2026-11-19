import React from 'react';
import { Award, Home, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';
import { DuelState, GameSettings } from '../types/tcg';
import { CardManager } from '../engine/CardManager';

interface ResultModalProps {
  duel: DuelState;
  rewardPoints: number;
  unlockedCardId?: string;
  onRematch: () => void;
  onReturnMenu: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  duel,
  rewardPoints,
  unlockedCardId,
  onRematch,
  onReturnMenu,
}) => {
  const isWin = duel.winner === 'player';
  const unlockedCard = unlockedCardId ? CardManager.getDef(unlockedCardId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isWin ? 'Victoria en el Duelo' : 'Derrota en el Duelo'}
        className={`w-full max-w-lg rounded-2xl border-2 p-6 sm:p-8 bg-slate-950 shadow-2xl space-y-6 ${
          isWin ? 'border-amber-400/80' : 'border-rose-500/80'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
              isWin ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {isWin ? <Trophy className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-white">
              {isWin ? 'VICTORIA' : 'DERROTA'}
            </h2>
            <p className="text-sm text-slate-300 mt-1">{duel.winReason}</p>
          </div>
        </div>

        {/* Tabular-num Match Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Turnos</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">{duel.turnNumber}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Daño Total</div>
            <div className="font-mono-num text-xl font-bold text-amber-300 mt-0.5">
              {duel.stats.playerDamageDealt}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Tus LP</div>
            <div className="font-mono-num text-xl font-bold text-sky-300 mt-0.5">{duel.player.lp}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Recompensa</div>
            <div className="font-mono-num text-xl font-bold text-emerald-400 mt-0.5">
              +{rewardPoints} PD
            </div>
          </div>
        </div>

        {unlockedCard && (
          <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/40 rounded-lg p-3">
            <Award className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="text-sm">
              <span className="text-slate-300">Carta desbloqueada: </span>
              <span className="font-semibold text-amber-300">{unlockedCard.name}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            data-start="true"
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Revancha</span>
          </button>
          <button
            type="button"
            onClick={onReturnMenu}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Menú Principal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onSurrender: () => void;
  onReturnMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onSurrender,
  onReturnMenu,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Duelo en Pausa"
      className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-6 space-y-5 shadow-2xl"
    >
      <h2 className="font-display text-2xl font-bold text-white text-center">Pausa</h2>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
        >
          Reanudar Duelo
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm cursor-pointer"
        >
          Reiniciar Duelo
        </button>
        <button
          type="button"
          onClick={onSurrender}
          className="w-full py-3 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-semibold text-sm cursor-pointer"
        >
          Rendirse
        </button>
        <button
          type="button"
          onClick={onReturnMenu}
          className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-sm border border-slate-800 cursor-pointer"
        >
          Volver al Menú
        </button>
      </div>
    </div>
  </div>
);

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onResetSave: () => void;
  onClose: () => void;
}

export const SettingsView: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onResetSave,
  onClose,
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090b10]/95 p-4">
    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h2 className="font-display text-2xl font-bold text-white">Configuración</h2>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-100 cursor-pointer"
        >
          Volver
        </button>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-slate-200">Volumen Maestro ({Math.round(settings.masterVolume * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.masterVolume}
            onChange={(e) => onUpdate({ ...settings, masterVolume: Number(e.target.value) })}
            className="w-44 accent-amber-400"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Música Ambiental</span>
          <input
            type="checkbox"
            checked={settings.musicEnabled}
            onChange={(e) => onUpdate({ ...settings, musicEnabled: e.target.checked })}
            className="w-5 h-5 accent-amber-400"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Efectos de Sonido</span>
          <input
            type="checkbox"
            checked={settings.sfxEnabled}
            onChange={(e) => onUpdate({ ...settings, sfxEnabled: e.target.checked })}
            className="w-5 h-5 accent-amber-400"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Cámara Dinámica en Invocaciones y Ataques</span>
          <input
            type="checkbox"
            checked={settings.cameraDynamics}
            onChange={(e) => onUpdate({ ...settings, cameraDynamics: e.target.checked })}
            className="w-5 h-5 accent-amber-400"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-slate-200">Velocidad de IA</span>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(['NORMAL', 'FAST'] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onUpdate({ ...settings, duelSpeed: spd })}
                className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                  settings.duelSpeed === spd ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                {spd === 'NORMAL' ? 'Normal' : 'Rápida'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">Restablecer progreso local, mazos e historial</span>
        <button
          type="button"
          onClick={onResetSave}
          className="px-3 py-2 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-semibold cursor-pointer"
        >
          Reiniciar Datos
        </button>
      </div>
    </div>
  </div>
);
