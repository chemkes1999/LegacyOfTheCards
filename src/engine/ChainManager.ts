import { CardEffectDef, ChainLink, DuelState, PlayerId } from '../types/tcg';
import { CardManager } from './CardManager';
import { TurnManager } from './TurnManager';

export class ChainManager {
  static canRespond(state: DuelState, responder: PlayerId): {
    canRespond: boolean;
    availableOptions: { cardUid: string; effect: CardEffectDef }[];
  } {
    if (state.chainStack.length === 0) return { canRespond: false, availableOptions: [] };
    const topLink = state.chainStack[state.chainStack.length - 1];
    const minSpeed = topLink.effect.spellSpeed;

    const ps = responder === 'player' ? state.player : state.opponent;
    const options: { cardUid: string; effect: CardEffectDef }[] = [];

    // Check set Quick-Play Spells and Set Traps on field (placed before this turn for traps, or anytime for quick-play? In TCG Quick-Play/Traps set on previous turns or Quick-Play from hand during own turn)
    for (const st of ps.spellsTraps) {
      if (!st) continue;
      // Don't chain same card twice in same chain
      if (state.chainStack.some((l) => l.sourceUid === st.uid)) continue;

      const def = CardManager.getDef(st.cardId);
      // Traps set this turn cannot activate immediately (except standard rule: turnPlaced < turnNumber)
      if (def.category === 'TRAP' && st.turnPlaced >= state.turnNumber) continue;

      for (const eff of def.effects) {
        if (eff.spellSpeed >= minSpeed && (eff.trigger === 'QUICK' || eff.trigger === 'COUNTER')) {
          if (eff.condition?.minLP && ps.lp < eff.condition.minLP) continue;
          if (eff.targetRequirement === 'OPPONENT_MONSTER' && CardManager.getAllFieldMonsters(state, responder === 'player' ? 'opponent' : 'player').length === 0) continue;
          if (eff.targetRequirement === 'OPPONENT_SPELL_TRAP') {
            const oppPs = responder === 'player' ? state.opponent : state.player;
            if (!oppPs.spellsTraps.some(Boolean) && !oppPs.fieldZone) continue;
          }
          options.push({ cardUid: st.uid, effect: eff });
        }
      }
    }

    // Check face-up Quick Effect monsters (e.g., Synchro Seraph!)
    const mons = CardManager.getAllFieldMonsters(state, responder);
    for (const m of mons) {
      if (!m.faceUp || m.effectUsedThisTurn) continue;
      if (state.chainStack.some((l) => l.sourceUid === m.uid)) continue;
      const def = CardManager.getDef(m.cardId);
      for (const eff of def.effects) {
        if (eff.trigger === 'QUICK' && eff.spellSpeed >= minSpeed) {
          options.push({ cardUid: m.uid, effect: eff });
        }
      }
    }

    return { canRespond: options.length > 0, availableOptions: options };
  }

  static pushLink(
    state: DuelState,
    controller: PlayerId,
    sourceUid: string,
    effect: CardEffectDef,
    targetUid?: string
  ): ChainLink {
    const card = CardManager.findInstance(state, sourceUid);
    if (!card) throw new Error(`Fuente de cadena no encontrada: ${sourceUid}`);

    const def = CardManager.getDef(card.cardId);
    const ps = controller === 'player' ? state.player : state.opponent;

    // Pay LP cost on activation
    if (effect.condition?.lpCost) {
      ps.lp = Math.max(0, ps.lp - effect.condition.lpCost);
      TurnManager.addLog(state, controller, `${ps.name} paga ${effect.condition.lpCost} LP.`, 'damage');
    }

    card.faceUp = true;
    if (effect.oncePerTurn) {
      card.effectUsedThisTurn = true;
    }

    const link: ChainLink = {
      linkNumber: state.chainStack.length + 1,
      sourceUid,
      cardId: def.id,
      controller,
      effect,
      targetUid,
      negated: false,
    };

    state.chainStack.push(link);
    TurnManager.addLog(
      state,
      controller,
      `Cadena Eslabón ${link.linkNumber}: ${def.name} (${effect.label})`,
      'chain'
    );
    return link;
  }
}
