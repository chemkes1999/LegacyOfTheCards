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

  const [phaseBanner, setPhaseBanner] = useState<{ title: string; sub: string; isBattle: boolean } | null>(null);
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
      isBattle: duel.phase === 'BATTLE',
    });
    const t = window.setTimeout(() => setPhaseBanner(null), 1350);
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
        title: `Selecciona Objetivo — ${def.name}`,
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
      subtitle: 'Selecciona el monstruo rival en el tablero 3D o en la lista inferior.',
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

    const allMatUids = Array.from(new Set(combos.flatMap((c) => c.map((m) => m.uid))));
    onSetTargetableUids(allMatUids);
    setLocalPrompt({
      kind: 'EXTRA_COMBO',
      title: `Materiales para ${def.name}`,
      subtitle: 'Elige la combinación de monstruos en tu campo:',
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
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5">
      {/* Subtle atmospheric cinematic vignette framing the 3D stone arena */}
      <div className="duel-vignette fixed inset-0 pointer-events-none z-0" />

      {/* Cinematic Tournament Phase / Turn Banner */}
      {phaseBanner && (
        <div className="fixed inset-x-0 top-[30%] z-30 flex justify-center pointer-events-none">
          <div className="animate-cutin duel-plate px-12 py-3.5 rounded-lg text-center min-w-[300px]">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#e5c068]/70 to-transparent mb-2" />
            <div
              className={`font-display text-2xl sm:text-3xl font-bold tracking-[0.18em] ${
                phaseBanner.isBattle ? 'text-rose-300' : 'text-[#f3dc9b]'
              }`}
            >
              {phaseBanner.title}
            </div>
            <div className="text-[11px] font-mono-num tracking-[0.2em] text-slate-300/90 mt-1">
              {phaseBanner.sub}
            </div>
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#e5c068]/70 to-transparent mt-2" />
          </div>
        </div>
      )}

      {/* Projected 3D Monster Stat Badges */}
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
            className={`pointer-events-auto absolute rounded px-2 py-0.5 font-mono-num text-[10px] font-bold tracking-wide shadow-lg transition-transform cursor-pointer ${
              b.isTargetable
                ? 'bg-rose-950/95 border border-rose-400 text-rose-100 scale-105'
                : b.isSelected
                ? 'bg-[#2a2110]/95 border border-[#e5c068] text-[#f8e6b4] scale-105'
                : b.canAttack
                ? 'bg-[#121c18]/95 border border-emerald-400/70 text-emerald-200'
                : 'bg-[#0c0f16]/90 border border-white/15 text-slate-100'
            }`}
          >
            {b.faceUp ? (
              <span>
                {b.position === 'ATK' ? `ATK ${b.atk}` : `DEF ${b.def}`}
                {b.isXyz ? ` · X${b.xyzCount}` : ''}
              </span>
            ) : (
              <span className="text-slate-400">SET</span>
            )}
          </button>
        ))}
      </div>

      {/* Top Tournament HUD Strip */}
      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 pointer-events-auto">
        {/* Player Duelist Plate */}
        <div className="duel-plate relative w-64 rounded-lg px-3.5 py-2.5">
          {damagePopups
            .filter((p) => p.target === 'player')
            .map((p) => (
              <div
                key={p.id}
                className="animate-lp-float pointer-events-none absolute -bottom-7 right-3 font-mono-num text-base font-bold text-rose-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
              >
                -{p.amount} LP
              </div>
            ))}
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-xs font-bold tracking-wider uppercase text-[#e5c068] truncate">
              {duel.player.name}
            </span>
            <span className="font-mono-num text-lg font-bold text-white leading-none">
              {duel.player.lp.toLocaleString()} <span className="text-[10px] text-slate-400">LP</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#2c8c78] via-[#45b89e] to-[#e5c068] transition-all duration-300"
              style={{ width: `${playerLpPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
            <span>DECK {duel.player.deck.length}</span>
            <button
              type="button"
              onClick={() => setInspectPile(inspectPile === 'PLAYER_GY' ? null : 'PLAYER_GY')}
              className="text-slate-300 hover:text-[#e5c068] underline underline-offset-2 cursor-pointer"
            >
              GY {duel.player.graveyard.length}
            </button>
            <span>EXTRA {duel.player.extraDeck.length}</span>
          </div>
        </div>

        {/* Center Tournament Turn & Phase Rail */}
        <div className="duel-plate flex flex-col items-center gap-2 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2.5 text-[11px] tracking-widest">
            <span className="font-mono-num font-bold text-[#e5c068]">TURNO {duel.turnNumber}</span>
            <span className="text-slate-600">|</span>
            <span className={`font-display font-bold ${isPlayerTurn ? 'text-slate-100' : 'text-rose-300'}`}>
              {isPlayerTurn ? 'TU TURNO' : duel.opponent.name.toUpperCase()}
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
                  className={`rounded px-3 py-1 text-[11px] font-semibold tracking-wide transition-all ${
                    active
                      ? 'duel-btn-gold font-bold'
                      : disabled
                      ? 'bg-black/30 text-slate-600 border border-white/5 cursor-not-allowed'
                      : 'duel-btn-slate cursor-pointer'
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

        {/* Opponent Plate + Utility Controls */}
        <div className="flex items-start gap-2">
          <div className="duel-plate relative w-64 rounded-lg px-3.5 py-2.5">
            {damagePopups
              .filter((p) => p.target === 'opponent')
              .map((p) => (
                <div
                  key={p.id}
                  className="animate-lp-float pointer-events-none absolute -bottom-7 left-3 font-mono-num text-base font-bold text-[#f3dc9b] drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
                >
                  -{p.amount} LP
                </div>
              ))}
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-xs font-bold tracking-wider uppercase text-rose-300/95 truncate">
                {duel.opponent.name}
              </span>
              <span className="font-mono-num text-lg font-bold text-white leading-none">
                {duel.opponent.lp.toLocaleString()} <span className="text-[10px] text-slate-400">LP</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-[#8f1d2c] via-[#c93848] to-[#e59c54] transition-all duration-300"
                style={{ width: `${oppLpPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono-num text-slate-400">
              <span>MANO {duel.opponent.hand.length}</span>
              <span>DECK {duel.opponent.deck.length}</span>
              <button
                type="button"
                onClick={() => setInspectPile(inspectPile === 'OPP_GY' ? null : 'OPP_GY')}
                className="text-slate-300 hover:text-[#e5c068] underline underline-offset-2 cursor-pointer"
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
              className="duel-plate-subtle rounded-lg p-2.5 text-slate-200 hover:text-[#e5c068] cursor-pointer"
            >
              <Pause className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              aria-label="Mostrar registro de duelo"
              className={`rounded-lg p-2.5 cursor-pointer ${
                showLog
                  ? 'duel-btn-gold'
                  : 'duel-plate-subtle text-slate-200 hover:text-[#e5c068]'
              }`}
            >
              <ScrollText className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Practice Guide & Toast */}
      <div className="relative z-20 mx-auto max-w-xl space-y-2 pointer-events-none">
        {duel.mode === 'PRACTICE' && duel.tutorialStep !== undefined && (
          <div className="duel-plate rounded-lg px-4 py-2 text-center text-xs font-medium text-emerald-200">
            {TUTORIAL_STEPS[Math.min(duel.tutorialStep, TUTORIAL_STEPS.length - 1)]}
          </div>
        )}
        {toast && (
          <div className="duel-plate rounded-lg px-4 py-2 text-center text-xs font-semibold text-[#f3dc9b]">
            {toast}
          </div>
        )}
      </div>

      {/* Left Card Inspector with Full Authentic Card Preview & Tactile Actions */}
      {selectedInstance && selectedDef && selectedStats && (
        <div className="duel-plate fixed left-4 top-24 z-30 w-72 rounded-xl p-3.5 pointer-events-auto space-y-3 max-h-[70vh] overflow-y-auto custom-scroll">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-[#f6e4b8] leading-snug truncate">
                {selectedInstance.faceUp || selectedInstance.controller === 'player'
                  ? selectedDef.name
                  : 'Carta Boca Abajo'}
              </h3>
              {(selectedInstance.faceUp || selectedInstance.controller === 'player') && (
                <p className="text-[10px] tracking-wide text-slate-400">
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
              <div className="flex justify-center py-0.5">
                <CardArtRenderer card={selectedDef} size="md" showRarity />
              </div>

              {selectedDef.category === 'MONSTER' && (
                <div className="flex items-center justify-between rounded bg-black/45 border border-white/10 px-3 py-1.5 font-mono-num text-xs">
                  <span className="text-[#e5c068] font-bold">ATK {selectedStats.atk}</span>
                  <span className="text-slate-300 font-semibold">
                    {selectedDef.subtype === 'link' ? `LINK-${selectedDef.level}` : `DEF ${selectedStats.def}`}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-300/95 leading-relaxed">{selectedDef.description}</p>
            </>
          )}

          {/* Contextual Actions */}
          {selectedInstance.controller === 'player' && isPlayerTurn && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              {selectedInstance.location === 'HAND' && selectedDef.category === 'MONSTER' && isMainPhase && (
                <>
                  {!selectedDef.isExtraDeck && selectedDef.subtype !== 'ritual' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleNormalSummon(selectedInstance, 'ATK', false)}
                        className="duel-btn-gold rounded-lg py-2 text-xs font-bold cursor-pointer"
                      >
                        Invocar (ATK)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNormalSummon(selectedInstance, 'DEF', true)}
                        className="duel-btn-slate rounded-lg py-2 text-xs font-semibold cursor-pointer"
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
                        className="rounded-lg bg-sky-900/90 hover:bg-sky-800 border border-sky-400/35 py-1.5 text-[11px] font-semibold text-sky-100 cursor-pointer"
                      >
                        Péndulo Izq ({selectedDef.pendulumScale})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runResult(DuelManager.placePendulum(duel, 'player', selectedInstance.uid, 'RIGHT'))
                        }
                        className="rounded-lg bg-rose-900/90 hover:bg-rose-800 border border-rose-400/35 py-1.5 text-[11px] font-semibold text-rose-100 cursor-pointer"
                      >
                        Péndulo Der ({selectedDef.pendulumScale})
                      </button>
                    </div>
                  )}
                </>
              )}

              {selectedInstance.location === 'HAND' && selectedDef.category !== 'MONSTER' && isMainPhase && (
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedDef.category === 'SPELL' && (
                    <button
                      type="button"
                      onClick={() => handleActivateCard(selectedInstance, 0)}
                      className="duel-btn-gold rounded-lg py-2 text-xs font-bold cursor-pointer"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runResult(DuelManager.setSpellOrTrap(duel, 'player', selectedInstance.uid))}
                    className={`duel-btn-slate rounded-lg py-2 text-xs font-semibold cursor-pointer ${
                      selectedDef.category === 'TRAP' ? 'col-span-2' : ''
                    }`}
                  >
                    Colocar Boca Abajo
                  </button>
                </div>
              )}

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
                      className="duel-btn-crimson w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold cursor-pointer"
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
                      className="duel-btn-slate w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Cambiar Posición ({selectedInstance.position === 'ATK' ? 'a DEF' : 'a ATK'})</span>
                    </button>
                  )}

                  {selectedDef.effects.map((eff, idx) => {
                    if (
                      eff.trigger !== 'IGNITION' &&
                      eff.trigger !== 'ON_SUMMON' &&
                      eff.trigger !== 'QUICK'
                    ) {
                      return null;
                    }
                    const check = EffectManager.canActivateEffect(duel, 'player', selectedInstance, eff);
                    return (
                      <div key={eff.id} className="space-y-0.5">
                        <button
                          type="button"
                          disabled={!check.allowed}
                          onClick={() => handleActivateCard(selectedInstance, idx)}
                          className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                            check.allowed
                              ? 'duel-btn-gold cursor-pointer'
                              : 'bg-black/40 border border-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{eff.label}</span>
                        </button>
                        {!check.allowed && check.reason && (
                          <div className="text-[10px] text-slate-400 text-center">
                            {check.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {selectedInstance.location === 'SPELL_TRAP' && selectedDef.effects.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleActivateCard(selectedInstance, 0)}
                  className="duel-btn-gold w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold cursor-pointer"
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
        <div className="duel-plate fixed right-4 top-24 z-30 w-80 max-h-[58vh] flex flex-col rounded-xl p-3.5 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="font-display text-xs font-bold tracking-wider uppercase text-[#e5c068]">
              Registro del Duelo
            </span>
            <button
              type="button"
              onClick={() => setShowLog(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll space-y-1.5 text-[11px]">
            {[...duel.logs].reverse().map((log) => (
              <div key={log.id} className="rounded bg-black/35 border border-white/5 px-2.5 py-1.5 text-slate-300">
                <span className="font-mono-num text-[10px] text-[#c9a04e] mr-1.5">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
          <div className="duel-plate w-full max-w-2xl rounded-xl p-5 space-y-4 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold text-[#f3dc9b]">
                {inspectPile === 'PLAYER_GY' ? 'Tu Cementerio' : `Cementerio de ${duel.opponent.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setInspectPile(null)}
                className="duel-btn-slate rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll flex flex-wrap gap-3">
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

      {/* Local Selection Prompt */}
      {localPrompt && (
        <div className="duel-plate fixed inset-x-0 bottom-36 z-30 mx-auto max-w-xl rounded-xl p-4 pointer-events-auto space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-display text-sm font-bold text-[#f3dc9b]">{localPrompt.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5">{localPrompt.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={clearPrompt}
              className="duel-btn-slate rounded px-2.5 py-1 text-xs cursor-pointer"
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
                  className="duel-btn-slate w-full rounded-lg px-3 py-2 text-left text-xs font-semibold cursor-pointer"
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
                      className={`rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${
                        isSel ? 'duel-btn-gold font-bold' : 'duel-btn-slate'
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
                  className="duel-btn-gold disabled:opacity-40 w-full rounded-lg py-2 text-xs font-bold cursor-pointer"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
          <div className="duel-plate w-full max-w-lg rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-display text-xl font-bold text-[#f3dc9b]">
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
              className="duel-btn-slate w-full rounded-lg py-2.5 text-sm font-semibold cursor-pointer"
            >
              No encadenar (Continuar)
            </button>
          </div>
        </div>
      )}

      {/* Bottom Hand & Extra Deck Dock */}
      <div
        className={`relative z-20 flex flex-col items-center gap-2 transition-all duration-200 ${
          localPrompt && localPrompt.kind !== 'PENDULUM_MULTI'
            ? 'opacity-30 translate-y-6 pointer-events-none'
            : 'pointer-events-auto'
        }`}
      >
        {showExtraDeck && (
          <div className="duel-plate w-full max-w-4xl rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-bold tracking-wide text-[#e5c068]">
                DECK EXTRA ({duel.player.extraDeck.length}) — Clic para Invocar (Sincronía / Xyz / Enlace)
              </span>
              <button
                type="button"
                onClick={() => setShowExtraDeck(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto custom-scroll pb-1">
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
          <div className="flex flex-col gap-1.5 shrink-0 pb-1">
            <button
              type="button"
              onClick={() => setShowExtraDeck((v) => !v)}
              className="duel-plate-subtle flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-100 hover:text-[#e5c068] cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-[#c9a04e]" />
              <span>Extra ({duel.player.extraDeck.length})</span>
              {showExtraDeck ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>

            {isMainPhase && pendulumCheck.canSummon && (
              <button
                type="button"
                onClick={handlePendulumSummon}
                className="duel-btn-gold rounded-lg px-3 py-2 text-xs font-bold cursor-pointer"
              >
                Inv. Péndulo ({pendulumCheck.eligibleHandUids.length})
              </button>
            )}
          </div>

          {/* Tabletop Player Hand with Natural Lift & Drop Shadow */}
          <div className="flex items-end gap-2 overflow-x-auto px-4 pt-6 pb-1 max-w-full">
            {duel.player.hand.map((card, idx) => {
              const mid = (duel.player.hand.length - 1) / 2;
              const tilt = Math.max(-5, Math.min(5, (idx - mid) * 1.4));
              return (
                <div
                  key={card.uid}
                  style={{ transform: `rotate(${tilt}deg)` }}
                  className="drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)] transition-transform duration-150 hover:!rotate-0 hover:-translate-y-5 hover:scale-110 hover:z-30"
                >
                  <CardArtRenderer
                    card={CardManager.getDef(card.cardId)}
                    size="sm"
                    selected={selectedUid === card.uid}
                    onClick={() => onSelectUid(selectedUid === card.uid ? null : card.uid)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
