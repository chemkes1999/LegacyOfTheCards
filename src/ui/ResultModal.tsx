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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isWin ? 'Victoria en el Duelo' : 'Derrota en el Duelo'}
        className="duel-plate w-full max-w-lg rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border ${
              isWin
                ? 'bg-[#c9a04e]/15 border-[#e5c068]/45 text-[#f3dc9b]'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            {isWin ? <Trophy className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>
          <div>
            <h2
              className={`font-display text-3xl font-extrabold tracking-[0.12em] ${
                isWin ? 'text-[#f6e4b8]' : 'text-rose-300'
              }`}
            >
              {isWin ? 'VICTORIA' : 'DERROTA'}
            </h2>
            <p className="text-sm text-slate-300 mt-1">{duel.winReason}</p>
          </div>
        </div>

        {/* Tabular-num Match Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-black/40 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Turnos</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">{duel.turnNumber}</div>
          </div>
          <div className="rounded-lg bg-black/40 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Daño Total</div>
            <div className="font-mono-num text-xl font-bold text-[#e5c068] mt-0.5">
              {duel.stats.playerDamageDealt}
            </div>
          </div>
          <div className="rounded-lg bg-black/40 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Tus LP</div>
            <div className="font-mono-num text-xl font-bold text-slate-100 mt-0.5">{duel.player.lp}</div>
          </div>
          <div className="rounded-lg bg-black/40 border border-white/10 p-3">
            <div className="text-[11px] text-slate-400">Recompensa</div>
            <div className="font-mono-num text-xl font-bold text-emerald-300 mt-0.5">
              +{rewardPoints} PD
            </div>
          </div>
        </div>

        {unlockedCard && (
          <div className="flex items-center gap-3 bg-[#c9a04e]/10 border border-[#c9a04e]/35 rounded-lg p-3">
            <Award className="w-5 h-5 text-[#e5c068] shrink-0" />
            <div className="text-sm">
              <span className="text-slate-300">Carta desbloqueada: </span>
              <span className="font-semibold text-[#f3dc9b]">{unlockedCard.name}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            data-start="true"
            onClick={onRematch}
            className="duel-btn-gold flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Revancha</span>
          </button>
          <button
            type="button"
            onClick={onReturnMenu}
            className="duel-btn-slate flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all cursor-pointer"
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Duelo en Pausa"
      className="duel-plate w-full max-w-sm rounded-xl p-6 space-y-5"
    >
      <h2 className="font-display text-2xl font-bold tracking-[0.14em] text-[#f3dc9b] text-center">
        PAUSA
      </h2>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onResume}
          className="duel-btn-gold w-full py-3 rounded-lg font-bold text-sm cursor-pointer"
        >
          Reanudar Duelo
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="duel-btn-slate w-full py-3 rounded-lg font-semibold text-sm cursor-pointer"
        >
          Reiniciar Duelo
        </button>
        <button
          type="button"
          onClick={onSurrender}
          className="duel-btn-crimson w-full py-3 rounded-lg font-semibold text-sm cursor-pointer"
        >
          Rendirse
        </button>
        <button
          type="button"
          onClick={onReturnMenu}
          className="duel-plate-subtle w-full py-3 rounded-lg text-slate-300 hover:text-white font-medium text-sm cursor-pointer"
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
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#07090e]/92 backdrop-blur-sm p-4">
    <div className="duel-plate w-full max-w-lg rounded-xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="font-display text-2xl font-bold tracking-wide text-[#f6e4b8]">Configuración</h2>
        <button
          type="button"
          onClick={onClose}
          className="duel-btn-slate px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
        >
          Volver
        </button>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-slate-200">
            Volumen Maestro <span className="font-mono-num text-[#e5c068]">({Math.round(settings.masterVolume * 100)}%)</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.masterVolume}
            onChange={(e) => onUpdate({ ...settings, masterVolume: Number(e.target.value) })}
            className="w-44 accent-[#d4a647]"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Música Ambiental</span>
          <input
            type="checkbox"
            checked={settings.musicEnabled}
            onChange={(e) => onUpdate({ ...settings, musicEnabled: e.target.checked })}
            className="w-5 h-5 accent-[#d4a647]"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Efectos de Sonido</span>
          <input
            type="checkbox"
            checked={settings.sfxEnabled}
            onChange={(e) => onUpdate({ ...settings, sfxEnabled: e.target.checked })}
            className="w-5 h-5 accent-[#d4a647]"
          />
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-200">Cámara Dinámica en Invocaciones y Ataques</span>
          <input
            type="checkbox"
            checked={settings.cameraDynamics}
            onChange={(e) => onUpdate({ ...settings, cameraDynamics: e.target.checked })}
            className="w-5 h-5 accent-[#d4a647]"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-slate-200">Velocidad de IA</span>
          <div className="flex gap-1 bg-black/45 p-1 rounded-lg border border-white/10">
            {(['NORMAL', 'FAST'] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onUpdate({ ...settings, duelSpeed: spd })}
                className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                  settings.duelSpeed === spd ? 'duel-btn-gold font-bold' : 'text-slate-300'
                }`}
              >
                {spd === 'NORMAL' ? 'Normal' : 'Rápida'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-slate-400">Restablecer progreso local, mazos e historial</span>
        <button
          type="button"
          onClick={onResetSave}
          className="duel-btn-crimson px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
        >
          Reiniciar Datos
        </button>
      </div>
    </div>
  </div>
);
