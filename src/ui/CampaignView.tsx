import React from 'react';
import { ArrowLeft, Award, CheckCircle2, Swords, Trophy } from 'lucide-react';
import { CAMPAIGN_STAGES } from '../data/decks';
import { CardManager } from '../engine/CardManager';
import { PlayerProfileSave } from '../types/tcg';

interface CampaignViewProps {
  profile: PlayerProfileSave;
  onStartStage: (stageId: string) => void;
  onClose: () => void;
}

const DIFF_BADGES = {
  EASY: { label: 'Fácil', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' },
  NORMAL: { label: 'Normal', cls: 'bg-amber-950/80 text-amber-300 border-amber-500/40' },
  EXPERT: { label: 'Experto', cls: 'bg-rose-950/80 text-rose-300 border-rose-500/40' },
};

export const CampaignView: React.FC<CampaignViewProps> = ({
  profile,
  onStartStage,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#070a12]/95 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Campaña — Camino del Duelista
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Completadas: <span className="font-mono-num text-amber-300">{profile.completedStageIds.length}/{CAMPAIGN_STAGES.length}</span> · Derrota a los 6 guardianes para dominar todas las mecánicas.
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAMPAIGN_STAGES.map((stage) => {
            const completed = profile.completedStageIds.includes(stage.id);
            const unlockCard = CardManager.getDef(stage.unlockCardId);
            const diff = DIFF_BADGES[stage.difficulty];

            return (
              <div
                key={stage.id}
                className={`flex flex-col justify-between rounded-2xl border bg-slate-950/90 p-5 space-y-4 transition-colors ${
                  completed ? 'border-emerald-500/50' : 'border-slate-800 hover:border-amber-400/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className="text-xs font-mono-num font-bold uppercase tracking-wider"
                        style={{ color: stage.accentColor }}
                      >
                        Etapa {stage.stageNumber}
                      </span>
                      <h3 className="font-display text-xl font-bold text-white mt-0.5">
                        {stage.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${diff.cls}`}>
                      {diff.label}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs">
                    <div className="font-semibold text-slate-100">{stage.opponentName}</div>
                    <div className="text-slate-400">{stage.opponentTitle} · Mazo: {stage.deckName}</div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{stage.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                      <Award className="h-4 w-4 shrink-0" />
                      <span className="truncate">{unlockCard.name}</span>
                    </span>
                    <span className="font-mono-num font-bold text-emerald-400 shrink-0">
                      +{stage.rewardPoints} PD
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartStage(stage.id)}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                      completed
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {completed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Repetir Etapa</span>
                      </>
                    ) : (
                      <>
                        <Swords className="h-4 w-4" />
                        <span>Desafiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
