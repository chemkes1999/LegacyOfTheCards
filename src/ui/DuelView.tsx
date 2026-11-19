import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { BattleManager } from '../engine/BattleManager';
import { CardManager, SUBTYPE_LABELS_ES } from '../engine/CardManager';
import { DuelManager } from '../engine/DuelManager';
import { EffectManager } from '../engine/EffectManager';
import { SummonManager } from '../engine/SummonManager';
import { TurnManager } from '../engine/TurnManager';
import { ProjectedBadge } from '../three/DuelArena3D';
import {
  BattlePosition,
  CardInstance,
  DuelPhase,
  DuelState,
  PlayerId,
} from '../types/tcg';
import { CardArtRenderer } from './CardArtRenderer';

interface DuelViewProps {
  duel: DuelState;
  projectedBadges: ProjectedBadge[];
  selectedUid: string | null;
  onSelectUid: (uid: string | null) => void;
  onUpdateDuel: (next: DuelState) => void;
  onSetTargetableUids: (uids: string[]) => void;
  onOpenPause: () => void;
}

interface LocalPrompt {
  kind: 'TRIBUTES' | 'EFFECT_TARGET' | 'ATTACK_TARGET' | 'PENDULUM_MULTI' | 'EXTRA_COMBO';
  title: string;
  subtitle: string;
  candidateUids: string[];
  minCount: number;
  maxCount: number;
  selected: string[];
  comboOptions?: { label: string; uids: string[] }[];
  onConfirm: (uids: string[]) => void;
}

interface DamagePopup {
  id: string;
  target: PlayerId;
  amount: number;
}

const TUTORIAL_STEPS = [
  'Paso 1: Haz clic en un monstruo de Nivel 4 o inferior en tu mano y pulsa "Invocar (ATK)".',
  'Paso 2: Pulsa "Batalla" (disponible a partir del Turno 2; puedes terminar el Turno 1 primero).',
  'Paso 3: Selecciona tu monstruo en el campo y declara un ataque contra el rival.',
  '¡Excelente! Ya dominas el flujo básico. Completa el duelo para ganar.',
];

export const DuelView: React.FC<DuelViewProps> = ({
  duel,
  projectedBadges,
  selectedUid,
  onSelectUid,
  onUpdateDuel,
  onSetTargetableUids,
  onOpenPause,
}) => {
  const [showExtraDeck, setShowExtraDeck] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [inspectPile, setInspectPile] = useState<'PLAYER_GY' | 'OPP_GY' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [localPrompt, setLocalPrompt] = useState<LocalPrompt | null>(null);

  // Master Duel style Phase/Turn Banner + Floating Damage Popups
  const [phaseBanner, setPhaseBanner] = useState<{ title: string; sub: string; accent: string } | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const seenDamageCueIdsRef = useRef<Set<string>>(new Set());
  const prevBannerKeyRef = useRef<string>('');

  const isPlayerTurn = duel.activePlayer === 'player' && !duel.winner;
  const isMainPhase = isPlayerTurn && (duel.phase === 'MAIN1' || duel.phase === 'MAIN2');
  const isBattlePhase = isPlayerTurn && duel.phase === 'BATTLE';

  useEffect(() => {
    const key = `${duel.duelId}_${duel.turnNumber}_${duel.activePlayer}_${duel.phase}`;
    if (prevBannerKeyRef.current === key) return;
    prevBannerKeyRef.current = key;

    const phaseLabel = DuelManager.getPhaseLabel(duel.phase).toUpperCase();
    const isPlr = duel.activePlayer === 'player';
    setPhaseBanner({
      title: phaseLabel,
      sub: `${isPlr ? 'TU TURNO' : `TURNO DE ${duel.opponent.name.toUpperCase()}`} · TURNO ${duel.turnNumber}`,
      accent: duel.phase === 'BATTLE' ? 'border-rose-500/80 text-rose-300' : isPlr ? 'border-sky-400/80 text-sky-300' : 'border-amber-400/80 text-amber-300',
    });
    const t = window.setTimeout(() => setPhaseBanner(null), 1250);
    return () => window.clearTimeout(t);
  }, [duel.duelId, duel.turnNumber, duel.activePlayer, duel.phase, duel.opponent.name]);

  useEffect(() => {
    const fresh: DamagePopup[] = [];
    for (const cue of duel.recentCues) {
      if (cue.kind !== 'DAMAGE' || !cue.amount || !cue.targetZone) continue;
      if (seenDamageCueIdsRef.current.has(cue.id)) continue;
      seenDamageCueIdsRef.current.add(cue.id);
      fresh.push({ id: cue.id, target: cue.targetZone.owner, amount: cue.amount });
    }
    if (fresh.length === 0) return;
    setDamagePopups((prev) => [...prev, ...fresh]);
    const t = window.setTimeout(() => {
      const ids = new Set(fresh.map((f) => f.id));
      setDamagePopups((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 1450);
    return () => window.clearTimeout(t);
  }, [duel.recentCues]);

  const selectedInstance: CardInstance | null = useMemo(() => {
    if (!selectedUid) return null;
    return CardManager.findInstance(duel, selectedUid);
  }, [duel, selectedUid]);

  const selectedDef = selectedInstance ? CardManager.getDef(selectedInstance.cardId) : null;
  const selectedStats = selectedInstance ? CardManager.getEffectiveStats(duel, selectedInstance) : null;

  const pendulumCheck = useMemo(
    () => SummonManager.validatePendulumSummon(duel, 'player'),
    [duel]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2600);
  };

  const clearPrompt = () => {
    setLocalPrompt(null);
    onSetTargetableUids([]);
  };

  const runResult = (res: { state: DuelState; error?: string }) => {
    if (res.error) {
      showToast(res.error);
      return;
    }
    onUpdateDuel(res.state);
    onSelectUid(null);
    clearPrompt();
  };

  // --- Player Actions ---
  const handleNormalSummon = (card: CardInstance, position: BattlePosition, isSet: boolean) => {
    const val = SummonManager.validateNormalSummon(duel, 'player', card.uid, isSet);
    if (!val.canSummon) {
      showToast(val.reason ?? 'No se puede invocar.');
      return;
    }
    if (val.requiredTributes > 0) {
      const candidates = CardManager.getAllFieldMonsters(duel, 'player').map((m) => m.uid);
      onSetTargetableUids(candidates);
      setLocalPrompt({
        kind: 'TRIBUTES',
        title: `Selecciona ${val.requiredTributes} Tributo(s)`,
        subtitle: `Para Invocar por Sacrificio a ${CardManager.getDef(card.cardId).name}`,
        candidateUids: candidates,
        minCount: val.requiredTributes,
        maxCount: val.requiredTributes,
        selected: [],
        onConfirm: (tributes) =>
          runResult(DuelManager.normalSummonOrSet(duel, 'player', card.uid, tributes, position, isSet)),
      });
      return;
    }
    runResult(DuelManager.normalSummonOrSet(duel, 'player', card.uid, [], position, isSet));
  };

  const handleActivateCard = (card: CardInstance, effectIndex = 0) => {
    const def = CardManager.getDef(card.cardId);
    const eff = def.effects[effectIndex];
    if (!eff) {
      showToast('Esta carta no tiene efectos activables.');
      return;
    }
    const can = EffectManager.canActivateEffect(duel, 'player', card, eff);
    if (!can.allowed) {
      showToast(can.reason ?? 'No se puede activar.');
      return;
    }
    if (eff.targetRequirement !== 'NONE') {
      const targets = EffectManager.getValidTargetUids(duel, 'player', eff);
      if (targets.length === 0) {
        showToast('No hay objetivos válidos.');
        return;
      }
      onSetTargetableUids(targets);
      setLocalPrompt({
        kind: 'EFFECT_TARGET',
        title: `Selecciona Objetivo para ${def.name}`,
        subtitle: eff.description,
        candidateUids: targets,
        minCount: 1,
        maxCount: 1,
        selected: [],
        onConfirm: (chosen) =>
          runResult(DuelManager.activateCard(duel, 'player', card.uid, effectIndex, chosen[0])),
      });
      return;
    }
    runResult(DuelManager.activateCard(duel, 'player', card.uid, effectIndex));
  };

  const handleDeclareAttack = (attacker: CardInstance) => {
    const oppMonsters = CardManager.getAllFieldMonsters(duel, 'opponent');
    if (oppMonsters.length === 0) {
      runResult(DuelManager.declareAttack(duel, 'player', attacker.uid));
      return;
    }
    const targets = oppMonsters.map((m) => m.uid);
    onSetTargetableUids(targets);
    setLocalPrompt({
      kind: 'ATTACK_TARGET',
      title: `Objetivo de Ataque — ${CardManager.getDef(attacker.cardId).name}`,
      subtitle: 'Elige qué monstruo rival deseas atacar (clic en el campo 3D o abajo).',
      candidateUids: targets,
      minCount: 1,
      maxCount: 1,
      selected: [],
      onConfirm: (chosen) =>
        runResult(DuelManager.declareAttack(duel, 'player', attacker.uid, chosen[0])),
    });
  };

  const handleExtraDeckSummon = (extraCard: CardInstance) => {
    const def = CardManager.getDef(extraCard.cardId);
    let combos: CardInstance[][] = [];
    let method: 'SYNCHRO' | 'XYZ' | 'LINK' | null = null;
    let errorMsg: string | undefined;

    if (def.subtype === 'synchro') {
      const check = SummonManager.validateSynchroSummon(duel, 'player', extraCard.uid);
      if (check.canSummon) combos = check.validCombinations;
      else errorMsg = check.reason;
      method = 'SYNCHRO';
    } else if (def.subtype === 'xyz') {
      const check = SummonManager.validateXyzSummon(duel, 'player', extraCard.uid);
      if (check.canSummon) combos = check.validPairs;
      else errorMsg = check.reason;
      method = 'XYZ';
    } else if (def.subtype === 'link') {
      const check = SummonManager.validateLinkSummon(duel, 'player', extraCard.uid);
      if (check.canSummon) combos = check.validSets;
      else errorMsg = check.reason;
      method = 'LINK';
    } else {
      showToast('Las cartas de Fusión se invocan activando Polimerización desde tu mano.');
      return;
    }

    if (!method || combos.length === 0) {
      showToast(errorMsg ?? 'No cumples los materiales requeridos.');
      return;
    }

    setShowExtraDeck(false);
    if (combos.length === 1) {
      runResult(
        DuelManager.extraSummon(
          duel,
          'player',
          extraCard.uid,
          combos[0].map((m) => m.uid),
          method
        )
      );
      return;
    }

    // Multiple valid material combinations -> let the player choose!
    const allMatUids = Array.from(new Set(combos.flatMap((c) => c.map((m) => m.uid))));
    onSetTargetableUids(allMatUids);
    setLocalPrompt({
      kind: 'EXTRA_COMBO',
      title: `Materiales para ${def.name}`,
      subtitle: 'Elige qué combinación de monstruos en tu campo deseas usar como materiales:',
      candidateUids: allMatUids,
      minCount: 1,
      maxCount: 1,
      selected: [],
      comboOptions: combos.slice(0, 6).map((grp) => ({
        label: grp.map((m) => CardManager.getDef(m.cardId).name).join(' + '),
        uids: grp.map((m) => m.uid),
      })),
      onConfirm: (uids) => runResult(DuelManager.extraSummon(duel, 'player', extraCard.uid, uids, method!)),
    });
  };

  const handlePendulumSummon = () => {
    if (!pendulumCheck.canSummon || pendulumCheck.eligibleHandUids.length === 0) {
      showToast(pendulumCheck.reason ?? 'No hay monstruos elegibles para Invocación por Péndulo.');
      return;
    }
    const freeSlots = duel.player.monsters.filter((m) => m === null).length;
    if (pendulumCheck.eligibleHandUids.length === 1 && freeSlots >= 1) {
      runResult(DuelManager.pendulumSummon(duel, 'player', pendulumCheck.eligibleHandUids));
      return;
    }
    setLocalPrompt({
      kind: 'PENDULUM_MULTI',
      title: `Invocación por Péndulo (Escalas ${pendulumCheck.minLevel}–${pendulumCheck.maxLevel})`,
      subtitle: `Elige hasta ${freeSlots} monstruo(s) de tu mano para Invocar Especialmente:`,
      candidateUids: pendulumCheck.eligibleHandUids,
      minCount: 1,
      maxCount: freeSlots,
      selected: pendulumCheck.eligibleHandUids.slice(0, freeSlots),
      onConfirm: (uids) => runResult(DuelManager.pendulumSummon(duel, 'player', uids)),
    });
  };

  const handlePhaseClick = (target: DuelPhase) => {
    if (!isPlayerTurn) return;
    if (target === 'END') {
      clearPrompt();
      onSelectUid(null);
      onUpdateDuel(DuelManager.endTurn(duel));
      return;
    }
    runResult(DuelManager.advancePhase(duel, target));
  };

  const playerLpPct = Math.max(0, Math.min(100, (duel.player.lp / duel.player.maxLp) * 100));
  const oppLpPct = Math.max(0, Math.min(100, (duel.opponent.lp / duel.opponent.maxLp) * 100));
  const canBattle = TurnManager.canEnterBattlePhase(duel).allowed;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-4">
      {/* Master Duel style Phase / Turn Banner */}
      {phaseBanner && (
        <div className="fixed inset-x-0 top-1/3 z-30 flex justify-center pointer-events-none">
          <div
            className={`rounded-xl border-y-2 bg-slate-950/90 px-10 py-3 text-center shadow-2xl backdrop-blur-sm ${phaseBanner.accent}`}
          >
            <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-widest">
              {phaseBanner.title}
            </div>
            <div className="text-[11px] font-mono-num tracking-wider text-slate-300 mt-0.5">
              {phaseBanner.sub}
            </div>
          </div>
        </div>
      )}

      {/* Projected 3D Monster Badges */}
      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        {projectedBadges.map((b) => (
          <button
            key={b.uid}
            type="button"
            onClick={() => {
              if (localPrompt && localPrompt.kind !== 'EXTRA_COMBO' && localPrompt.candidateUids.includes(b.uid)) {
                const already = localPrompt.selected.includes(b.uid);
                const nextSel = already
                  ? localPrompt.selected.filter((x) => x !== b.uid)
                  : [...localPrompt.selected, b.uid].slice(0, localPrompt.maxCount);
                if (nextSel.length === localPrompt.minCount && localPrompt.maxCount === 1) {
                  localPrompt.onConfirm(nextSel);
                } else {
                  setLocalPrompt({ ...localPrompt, selected: nextSel });
                }
              } else {
                onSelectUid(b.uid);
              }
            }}
            style={{
              left: `${b.screenX}px`,
              top: `${b.screenY}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`pointer-events-auto absolute rounded-md border px-1.5 py-0.5 font-mono-num text-[10px] font-bold shadow-md transition-transform cursor-pointer ${
              b.isTargetable
                ? 'border-rose-400 bg-rose-950/95 text-rose-100 ring-2 ring-rose-400/70 scale-105'
                : b.isSelected
                ? 'border-amber-300 bg-amber-950/95 text-amber-200 ring-2 ring-amber-400/70'
                : b.canAttack
                ? 'border-emerald-400 bg-slate-950/90 text-emerald-300'
                : 'border-slate-700 bg-slate-950/85 text-slate-200'
            }`}
          >
            {b.faceUp ? (
              <span>
                {b.position === 'ATK' ? `ATK ${b.atk}` : `DEF ${b.def}`}
                {b.isXyz ? ` · X${b.xyzCount}` : ''}
              </span>
            ) : (
              <span className="text-slate-400">Oculto</span>
            )}
          </button>
        ))}
      </div>

      {/* Top HUD Bar */}
      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 pointer-events-auto">
        {/* Player LP & Info */}
        <div className="relative w-60 rounded-xl border border-sky-500/40 bg-slate-950/90 px-3 py-2 shadow-lg">
          {damagePopups
            .filter((p) => p.target === 'player')
            .map((p) => (
              <div
                key={p.id}
                className="pointer-events-none absolute -bottom-7 right-2 font-mono-num text-base font-extrabold text-rose-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-bounce"
              >
                -{p.amount} LP
              </div>
            ))}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-sky-300 truncate">{duel.player.name}</span>
            <span className="font-mono-num text-base font-extrabold text-white">{duel.player.lp} LP</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-300"
              style={{ width: `${playerLpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
            <span>Deck {duel.player.deck.length}</span>
            <button
              type="button"
              onClick={() => setInspectPile(inspectPile === 'PLAYER_GY' ? null : 'PLAYER_GY')}
              className="hover:text-amber-300 underline cursor-pointer"
            >
              GY {duel.player.graveyard.length}
            </button>
            <span>Extra {duel.player.extraDeck.length}</span>
          </div>
        </div>

        {/* Center Turn & Phase Controls */}
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/90 px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono-num font-bold text-amber-300">TURNO {duel.turnNumber}</span>
            <span className="text-slate-500">·</span>
            <span className={`font-bold ${isPlayerTurn ? 'text-sky-300' : 'text-rose-400'}`}>
              {isPlayerTurn ? 'TU TURNO' : `TURNO DE ${duel.opponent.name.toUpperCase()}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(['MAIN1', 'BATTLE', 'MAIN2', 'END'] as DuelPhase[]).map((ph) => {
              const active = duel.phase === ph;
              const disabled =
                !isPlayerTurn ||
                active ||
                (ph === 'BATTLE' && !canBattle) ||
                ph === 'MAIN1' ||
                (ph === 'MAIN2' && duel.phase !== 'BATTLE');
              return (
                <button
                  key={ph}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePhaseClick(ph)}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : disabled
                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                  }`}
                >
                  {ph === 'MAIN1'
                    ? 'MP1'
                    : ph === 'BATTLE'
                    ? 'Batalla'
                    : ph === 'MAIN2'
                    ? 'MP2'
                    : 'Fin Turno'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Opponent LP + Utility Buttons */}
        <div className="flex items-start gap-2">
          <div className="relative w-60 rounded-xl border border-rose-500/40 bg-slate-950/90 px-3 py-2 shadow-lg">
            {damagePopups
              .filter((p) => p.target === 'opponent')
              .map((p) => (
                <div
                  key={p.id}
                  className="pointer-events-none absolute -bottom-7 left-2 font-mono-num text-base font-extrabold text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-bounce"
                >
                  -{p.amount} LP
                </div>
              ))}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-300 truncate">{duel.opponent.name}</span>
              <span className="font-mono-num text-base font-extrabold text-white">{duel.opponent.lp} LP</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-amber-400 transition-all duration-300"
                style={{ width: `${oppLpPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
              <span>Mano {duel.opponent.hand.length}</span>
              <span>Deck {duel.opponent.deck.length}</span>
              <button
                type="button"
                onClick={() => setInspectPile(inspectPile === 'OPP_GY' ? null : 'OPP_GY')}
                className="hover:text-amber-300 underline cursor-pointer"
              >
                GY {duel.opponent.graveyard.length}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onOpenPause}
              aria-label="Pausar Duelo"
              className="rounded-lg border border-slate-700 bg-slate-950/90 p-2 text-slate-200 hover:border-amber-400 cursor-pointer"
            >
              <Pause className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              aria-label="Mostrar registro de duelo"
              className={`rounded-lg border p-2 cursor-pointer ${
                showLog
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-slate-700 bg-slate-950/90 text-slate-200 hover:border-amber-400'
              }`}
            >
              <ScrollText className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Practice Tutorial Banner & Toast */}
      <div className="relative z-20 mx-auto max-w-xl space-y-2 pointer-events-none">
        {duel.mode === 'PRACTICE' && duel.tutorialStep !== undefined && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/90 px-4 py-2 text-center text-xs font-medium text-emerald-100 shadow-lg">
            {TUTORIAL_STEPS[Math.min(duel.tutorialStep, TUTORIAL_STEPS.length - 1)]}
          </div>
        )}
        {toast && (
          <div className="rounded-lg border border-amber-400/70 bg-slate-950/95 px-4 py-2 text-center text-xs font-semibold text-amber-200 shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {/* Side Inspector & Contextual Action Panel */}
      {selectedInstance && selectedDef && selectedStats && (
        <div className="fixed left-4 top-28 z-30 w-72 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl pointer-events-auto space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-white leading-tight">
                {selectedInstance.faceUp || selectedInstance.controller === 'player'
                  ? selectedDef.name
                  : 'Carta Boca Abajo'}
              </h3>
              {(selectedInstance.faceUp || selectedInstance.controller === 'player') && (
                <p className="text-[11px] text-slate-400">
                  {selectedDef.category === 'MONSTER'
                    ? `Monstruo · ${SUBTYPE_LABELS_ES[selectedDef.subtype]} · Nv.${selectedDef.level}`
                    : `${selectedDef.category === 'SPELL' ? 'Mágica' : 'Trampa'} · ${SUBTYPE_LABELS_ES[selectedDef.subtype]}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelectUid(null)}
              aria-label="Cerrar inspector"
              className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(selectedInstance.faceUp || selectedInstance.controller === 'player') && (
            <>
              {selectedDef.category === 'MONSTER' && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-1.5 font-mono-num text-xs">
                  <span className="text-amber-300 font-bold">ATK {selectedStats.atk}</span>
                  <span className="text-sky-300 font-bold">
                    {selectedDef.subtype === 'link' ? `LINK-${selectedDef.level}` : `DEF ${selectedStats.def}`}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedDef.description}</p>
            </>
          )}

          {/* Contextual Actions for Player-Controlled Cards */}
          {selectedInstance.controller === 'player' && isPlayerTurn && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              {/* Hand Monster Actions */}
              {selectedInstance.location === 'HAND' && selectedDef.category === 'MONSTER' && isMainPhase && (
                <>
                  {!selectedDef.isExtraDeck && selectedDef.subtype !== 'ritual' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleNormalSummon(selectedInstance, 'ATK', false)}
                        className="rounded-lg bg-amber-500 hover:bg-amber-400 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                      >
                        Invocar (ATK)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNormalSummon(selectedInstance, 'DEF', true)}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-100 cursor-pointer"
                      >
                        Colocar (DEF)
                      </button>
                    </div>
                  )}
                  {selectedDef.pendulumScale !== undefined && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          runResult(DuelManager.placePendulum(duel, 'player', selectedInstance.uid, 'LEFT'))
                        }
                        className="rounded-lg bg-sky-700 hover:bg-sky-600 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        Péndulo Izq ({selectedDef.pendulumScale})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runResult(DuelManager.placePendulum(duel, 'player', selectedInstance.uid, 'RIGHT'))
                        }
                        className="rounded-lg bg-rose-700 hover:bg-rose-600 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        Péndulo Der ({selectedDef.pendulumScale})
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Hand Spell / Trap Actions */}
              {selectedInstance.location === 'HAND' && selectedDef.category !== 'MONSTER' && isMainPhase && (
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedDef.category === 'SPELL' && (
                    <button
                      type="button"
                      onClick={() => handleActivateCard(selectedInstance, 0)}
                      className="rounded-lg bg-teal-500 hover:bg-teal-400 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runResult(DuelManager.setSpellOrTrap(duel, 'player', selectedInstance.uid))}
                    className={`rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-100 cursor-pointer ${
                      selectedDef.category === 'TRAP' ? 'col-span-2' : ''
                    }`}
                  >
                    Colocar Boca Abajo
                  </button>
                </div>
              )}

              {/* Field Monster Actions */}
              {(selectedInstance.location === 'MONSTER' || selectedInstance.location === 'EXTRA_MONSTER') && (
                <>
                  {(isBattlePhase && BattleManager.canDeclareAttack(duel, selectedInstance.uid).allowed) ||
                  (isBattlePhase &&
                    selectedInstance.faceUp &&
                    selectedInstance.position === 'ATK' &&
                    !selectedInstance.attackedThisTurn &&
                    duel.turnNumber > 1) ? (
                    <button
                      type="button"
                      onClick={() => handleDeclareAttack(selectedInstance)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      <span>Declarar Ataque</span>
                    </button>
                  ) : null}

                  {isMainPhase && (
                    <button
                      type="button"
                      onClick={() =>
                        runResult(DuelManager.changePosition(duel, 'player', selectedInstance.uid))
                      }
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-100 cursor-pointer"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Cambiar Posición ({selectedInstance.position === 'ATK' ? 'a DEF' : 'a ATK'})</span>
                    </button>
                  )}

                  {isMainPhase &&
                    selectedDef.effects.map((eff, idx) =>
                      eff.trigger === 'IGNITION' ? (
                        <button
                          key={eff.id}
                          type="button"
                          onClick={() => handleActivateCard(selectedInstance, idx)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{eff.label}</span>
                        </button>
                      ) : null
                    )}
                </>
              )}

              {/* Set Spell/Trap on Field */}
              {selectedInstance.location === 'SPELL_TRAP' && selectedDef.effects.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleActivateCard(selectedInstance, 0)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Activar Carta</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duel Log Drawer */}
      {showLog && (
        <div className="fixed right-4 top-28 z-30 w-80 max-h-[55vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-xs font-bold text-amber-300">Registro del Duelo</span>
            <button
              type="button"
              onClick={() => setShowLog(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px]">
            {[...duel.logs].reverse().map((log) => (
              <div key={log.id} className="rounded bg-slate-900/90 px-2 py-1 text-slate-300">
                <span className="font-mono-num text-[10px] text-slate-500 mr-1.5">
                  T{log.turn}
                </span>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graveyard Inspector Modal */}
      {inspectPile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 pointer-events-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-5 space-y-4 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                {inspectPile === 'PLAYER_GY' ? 'Tu Cementerio' : `Cementerio de ${duel.opponent.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setInspectPile(null)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-wrap gap-3">
              {(inspectPile === 'PLAYER_GY' ? duel.player.graveyard : duel.opponent.graveyard).map(
                (c) => (
                  <CardArtRenderer key={c.uid} card={CardManager.getDef(c.cardId)} size="sm" />
                )
              )}
              {(inspectPile === 'PLAYER_GY' ? duel.player.graveyard : duel.opponent.graveyard)
                .length === 0 && (
                <p className="text-xs text-slate-400">El Cementerio está vacío.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Local Selection Prompt (Tributes / Targets / Extra Deck Combos / Pendulum Multi) */}
      {localPrompt && (
        <div className="fixed inset-x-0 bottom-36 z-30 mx-auto max-w-xl rounded-2xl border-2 border-amber-400/80 bg-slate-950/95 p-4 shadow-2xl pointer-events-auto space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-display text-base font-bold text-amber-300">{localPrompt.title}</h4>
              <p className="text-xs text-slate-300">{localPrompt.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={clearPrompt}
              className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          {localPrompt.kind === 'EXTRA_COMBO' && localPrompt.comboOptions ? (
            <div className="space-y-1.5">
              {localPrompt.comboOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => localPrompt.onConfirm(opt.uids)}
                  className="w-full rounded-lg border border-purple-500/50 bg-slate-900 hover:bg-purple-950/70 px-3 py-2 text-left text-xs font-semibold text-purple-100 cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {localPrompt.candidateUids.map((uid) => {
                  const inst = CardManager.findInstance(duel, uid);
                  if (!inst) return null;
                  const def = CardManager.getDef(inst.cardId);
                  const isSel = localPrompt.selected.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => {
                        const nextSel = isSel
                          ? localPrompt.selected.filter((x) => x !== uid)
                          : [...localPrompt.selected, uid].slice(0, localPrompt.maxCount);
                        if (nextSel.length === localPrompt.minCount && localPrompt.maxCount === 1) {
                          localPrompt.onConfirm(nextSel);
                        } else {
                          setLocalPrompt({ ...localPrompt, selected: nextSel });
                        }
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                        isSel
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-amber-400/70'
                      }`}
                    >
                      {inst.faceUp || inst.controller === 'player' ? def.name : 'Monstruo Oculto'}
                    </button>
                  );
                })}
              </div>
              {localPrompt.maxCount > 1 && (
                <button
                  type="button"
                  disabled={localPrompt.selected.length < localPrompt.minCount}
                  onClick={() => localPrompt.onConfirm(localPrompt.selected)}
                  className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                >
                  Confirmar ({localPrompt.selected.length}/{localPrompt.maxCount})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Engine Pending Interaction (Chain Response / Attack Trap) */}
      {duel.pendingInteraction && duel.pendingInteraction.actor === 'player' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 pointer-events-auto">
          <div className="w-full max-w-lg rounded-2xl border-2 border-cyan-400/80 bg-slate-950 p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="font-display text-xl font-bold text-cyan-300">
                {duel.pendingInteraction.title}
              </h3>
              <p className="text-sm text-slate-300 mt-1">{duel.pendingInteraction.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {duel.pendingInteraction.candidateUids.map((uid) => {
                const inst = CardManager.findInstance(duel, uid);
                if (!inst) return null;
                return (
                  <CardArtRenderer
                    key={uid}
                    card={CardManager.getDef(inst.cardId)}
                    size="sm"
                    onClick={() => onUpdateDuel(DuelManager.respondToChain(duel, 'player', uid))}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onUpdateDuel(DuelManager.respondToChain(duel, 'player'))}
              className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-slate-100 cursor-pointer"
            >
              No encadenar (Continuar)
            </button>
          </div>
        </div>
      )}

      {/* Bottom Hand & Extra Deck Dock (tucks cleanly during field targeting) */}
      <div
        className={`relative z-20 flex flex-col items-center gap-2 transition-all duration-200 ${
          localPrompt && localPrompt.kind !== 'PENDULUM_MULTI'
            ? 'opacity-30 translate-y-6 pointer-events-none'
            : 'pointer-events-auto'
        }`}
      >
        {showExtraDeck && (
          <div className="w-full max-w-4xl rounded-2xl border border-purple-500/50 bg-slate-950/95 p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-purple-300">
                Deck Extra ({duel.player.extraDeck.length}) — Haz clic para Invocar (Sincronía / Xyz / Enlace)
              </span>
              <button
                type="button"
                onClick={() => setShowExtraDeck(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {duel.player.extraDeck.map((c) => (
                <CardArtRenderer
                  key={c.uid}
                  card={CardManager.getDef(c.cardId)}
                  size="sm"
                  onClick={() => handleExtraDeckSummon(c)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end justify-center gap-3 w-full max-w-5xl">
          {/* Quick Extra & Pendulum Controls */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowExtraDeck((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-slate-950/90 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-950/60 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Extra ({duel.player.extraDeck.length})</span>
              {showExtraDeck ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>

            {isMainPhase && pendulumCheck.canSummon && (
              <button
                type="button"
                onClick={handlePendulumSummon}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 cursor-pointer"
              >
                Inv. Péndulo ({pendulumCheck.eligibleHandUids.length})
              </button>
            )}
          </div>

          {/* Player Hand with Smooth Lift & Hover Zoom */}
          <div className="flex items-end gap-2 overflow-x-auto px-3 pt-5 pb-1 max-w-full">
            {duel.player.hand.map((card) => (
              <div
                key={card.uid}
                className="transition-transform duration-150 hover:-translate-y-4 hover:scale-110 hover:z-30"
              >
                <CardArtRenderer
                  card={CardManager.getDef(card.cardId)}
                  size="sm"
                  selected={selectedUid === card.uid}
                  onClick={() => onSelectUid(selectedUid === card.uid ? null : card.uid)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
