import React from 'react';
import { ArrowLeft, History, ShieldAlert, Trophy } from 'lucide-react';
import { GameManager } from '../engine/GameManager';
import { PlayerProfileSave } from '../types/tcg';

interface HistoryViewProps {
  profile: PlayerProfileSave;
  onClose: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ profile, onClose }) => {
  const total = profile.history.length;
  const wins = profile.history.filter((h) => h.result === 'WIN').length;
  const losses = total - wins;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalDamage = profile.history.reduce((sum, h) => sum + h.damageDealt, 0);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#070a12]/95 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Historial de Duelos
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Registro de tus últimas {total} partidas guardadas localmente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs text-slate-400">Victorias / Derrotas</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-1">
              <span className="text-emerald-400">{wins}</span> / <span className="text-rose-400">{losses}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs text-slate-400">Tasa de Victoria</div>
            <div className="font-mono-num text-2xl font-bold text-amber-300 mt-1">{winRate}%</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs text-slate-400">Daño Acumulado</div>
            <div className="font-mono-num text-2xl font-bold text-sky-300 mt-1">{totalDamage.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs text-slate-400">Puntos de Duelo</div>
            <div className="font-mono-num text-2xl font-bold text-emerald-400 mt-1">{profile.duelPoints} PD</div>
          </div>
        </div>

        {profile.history.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center space-y-2">
            <p className="text-base font-semibold text-slate-200">Aún no hay duelos registrados</p>
            <p className="text-sm text-slate-400">
              Completa un Duelo vs IA, Práctica, Campaña o Modo Libre para ver tus estadísticas aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {profile.history.map((rec) => {
              const isWin = rec.result === 'WIN';
              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isWin ? <Trophy className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isWin ? 'text-emerald-300' : 'text-rose-400'}`}>
                          {isWin ? 'VICTORIA' : 'DERROTA'}
                        </span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-sm font-semibold text-white">{rec.opponentName}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {GameManager.getModeLabel(rec.mode)} · Mazo: {rec.deckName} ·{' '}
                        {new Date(rec.date).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-xs font-mono-num">
                    <div>
                      <span className="text-slate-400">Turnos: </span>
                      <span className="text-white font-semibold">{rec.turns}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">LP: </span>
                      <span className="text-sky-300 font-semibold">{rec.finalPlayerLP}</span>
                      <span className="text-slate-500"> vs </span>
                      <span className="text-rose-300 font-semibold">{rec.finalOpponentLP}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Daño: </span>
                      <span className="text-amber-300 font-semibold">{rec.damageDealt}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
