import {
  CardCategory,
  CardDefinition,
  CardEffectDef,
  EffectOperation,
  EffectTrigger,
  TargetRequirement,
} from '../types/tcg';

/**
 * Heuristic parser that translates common Yu-Gi-Oh! card text patterns (English PSCT/classic)
 * into executable EffectManager operations so imported YGOPRODeck cards work in duels.
 */
export function inferCardEffectsFromDescription(
  card: Pick<CardDefinition, 'id' | 'category' | 'subtype' | 'description'>
): CardEffectDef[] {
  if (card.category === 'MONSTER' && card.subtype === 'normal') {
    return [];
  }

  const desc = card.description || '';
  const ops: EffectOperation[] = [];
  let targetRequirement: TargetRequirement = 'NONE';
  let trigger: EffectTrigger = 'IGNITION';
  let spellSpeed: 1 | 2 | 3 = 1;
  let lpCost: number | undefined;
  let minOpponentMonsters: number | undefined;
  let label = 'Activar Efecto';

  if (card.category === 'TRAP') {
    if (card.subtype === 'counter') {
      trigger = 'COUNTER';
      spellSpeed = 3;
    } else if (/when an opponent'?s monster declares an attack/i.test(desc)) {
      trigger = 'ON_ATTACK_DECLARE';
      spellSpeed = 2;
    } else {
      trigger = 'QUICK';
      spellSpeed = 2;
    }
  } else if (card.category === 'SPELL' && card.subtype === 'quickplay') {
    trigger = 'QUICK';
    spellSpeed = 2;
  } else if (
    card.category === 'MONSTER' &&
    /(?:when|if) this card is (?:normal|special|normal or special) summoned/i.test(desc)
  ) {
    trigger = 'ON_SUMMON';
    spellSpeed = 1;
  } else if (card.category === 'MONSTER' && /\(quick effect\)/i.test(desc)) {
    trigger = 'QUICK';
    spellSpeed = 2;
  }

  // 1. Negate attack
  if (/negate the attack/i.test(desc)) {
    trigger = 'ON_ATTACK_DECLARE';
    spellSpeed = 2;
    ops.push({ type: 'NEGATE_ATTACK' });
    label = 'Negar Ataque';
  }

  // 2. Counter negation
  if (card.subtype === 'counter' && /negate the activation/i.test(desc)) {
    targetRequirement = 'PREVIOUS_CHAIN_LINK';
    ops.push({ type: 'NEGATE_CHAIN_LINK' });
    label = 'Negar Activación';
    const lpMatch = desc.match(/pay (\d+) lp/i);
    if (lpMatch) {
      lpCost = Number(lpMatch[1]);
    }
  }

  // 3. Special Summon from Hand (e.g., Trident Warrior, Marauding Captain, Goblindbergh)
  const ssHandMaxLv = desc.match(
    /special summon 1 level (\d+) or lower .*?monster from your hand/i
  );
  const ssHandExactLv = desc.match(
    /special summon 1 level (\d+) .*?monster from your hand/i
  );
  const ssHandAny = desc.match(/special summon 1 .*?monster from your hand/i);

  if (ssHandMaxLv) {
    const maxLv = Number(ssHandMaxLv[1]);
    targetRequirement = 'OWN_HAND_MONSTER';
    ops.push({ type: 'SPECIAL_SUMMON_FROM_HAND', filterMaxLevel: maxLv });
    label = `Invocar Esp. Mano (Nv.≤${maxLv})`;
  } else if (ssHandExactLv) {
    const exactLv = Number(ssHandExactLv[1]);
    targetRequirement = 'OWN_HAND_MONSTER';
    ops.push({ type: 'SPECIAL_SUMMON_FROM_HAND', filterExactLevel: exactLv });
    label = `Invocar Esp. Mano (Nv.${exactLv})`;
  } else if (ssHandAny) {
    targetRequirement = 'OWN_HAND_MONSTER';
    ops.push({ type: 'SPECIAL_SUMMON_FROM_HAND' });
    label = 'Invocar Esp. desde Mano';
  }

  // 4. Draw cards
  const drawMatch = desc.match(/draw (\d+) cards?/i);
  if (drawMatch) {
    const count = Math.min(3, Math.max(1, Number(drawMatch[1])));
    ops.push({ type: 'DRAW', value: count });
    label = `Robar ${count} carta(s)`;
  }

  // 5. Board wipes
  if (
    /destroy all monsters your opponent controls/i.test(desc) ||
    /destroy all attack position monsters your opponent controls/i.test(desc)
  ) {
    minOpponentMonsters = 1;
    ops.push({ type: 'DESTROY_ALL_OPPONENT_MONSTERS' });
    label = 'Destruir Monstruos Rivales';
  } else if (/destroy all spells and traps your opponent controls/i.test(desc)) {
    ops.push({ type: 'DESTROY_ALL_SPELLS_TRAPS' });
    label = 'Destruir Mágicas/Trampas';
  } else if (targetRequirement === 'NONE') {
    // 6. Targeted destruction / banishing
    if (/banish (?:1|that|the) (?:face-up )?monster/i.test(desc)) {
      targetRequirement = 'OPPONENT_MONSTER';
      ops.push({ type: 'BANISH_TARGET' });
      label = 'Desterrar Monstruo';
    } else if (/destroy (?:1|that|the) (?:face-up )?(?:spell\/trap|spell or trap)/i.test(desc)) {
      targetRequirement = 'OPPONENT_SPELL_TRAP';
      ops.push({ type: 'DESTROY_TARGET' });
      label = 'Destruir Mágica/Trampa';
    } else if (/destroy (?:1|that|the) (?:face-up )?monster/i.test(desc)) {
      targetRequirement = 'OPPONENT_MONSTER';
      ops.push({ type: 'DESTROY_TARGET' });
      label = 'Destruir Monstruo';
    } else if (/destroy (?:1|that|the) (?:face-up )?card/i.test(desc)) {
      targetRequirement = 'OPPONENT_ANY_CARD';
      ops.push({ type: 'DESTROY_TARGET' });
      label = 'Destruir Carta Rival';
    }
  }

  // 7. Direct LP damage / heal
  const dmgMatch = desc.match(/inflict (\d+) damage/i);
  if (dmgMatch) {
    const val = Math.min(3000, Number(dmgMatch[1]));
    ops.push({ type: 'DAMAGE_OPPONENT', value: val });
    if (ops.length === 1) label = `Infligir ${val} Daño`;
  }
  const healMatch = desc.match(/(?:gain|increase your life points by) (\d+) (?:lp|life points)/i);
  if (healMatch) {
    const val = Math.min(3000, Number(healMatch[1]));
    ops.push({ type: 'HEAL_SELF', value: val });
    if (ops.length === 1) label = `Recuperar +${val} LP`;
  }

  // 8. ATK/DEF modification
  const gainAtkMatch = desc.match(/gains? (\d+) atk/i);
  const loseAtkMatch = desc.match(/loses? (\d+) atk/i);
  if (gainAtkMatch) {
    if (targetRequirement === 'NONE') targetRequirement = 'OWN_MONSTER';
    const delta = Math.min(2000, Number(gainAtkMatch[1]));
    ops.push({ type: 'MODIFY_STATS', atkDelta: delta, defDelta: 0 });
    if (ops.length === 1) label = `Potenciar +${delta} ATK`;
  } else if (loseAtkMatch) {
    if (targetRequirement === 'NONE') targetRequirement = 'OPPONENT_MONSTER';
    const delta = -Math.min(2000, Number(loseAtkMatch[1]));
    ops.push({ type: 'MODIFY_STATS', atkDelta: delta, defDelta: 0 });
    if (ops.length === 1) label = `Debilitar ${delta} ATK`;
  }

  // 9. Special Summon from GY
  if (
    targetRequirement === 'NONE' &&
    /special summon 1 .*?monster.*? from (?:your|either) (?:gy|graveyard)/i.test(desc)
  ) {
    targetRequirement = 'OWN_GY_MONSTER';
    ops.push({ type: 'SPECIAL_SUMMON_FROM_GY' });
    label = 'Revivir del Cementerio';
  }

  // 10. Change battle position
  if (
    ops.length === 0 &&
    /change (?:1|that|the|it) .*?(?:battle position|to (?:face-up )?(?:attack|defense) position)/i.test(desc)
  ) {
    targetRequirement = 'ANY_MONSTER';
    ops.push({ type: 'CHANGE_POSITION' });
    label = 'Cambiar Posición';
  }

  // 11. Protection / attack lock
  if (ops.length === 0 && /cannot be destroyed by (?:battle|card effects)/i.test(desc)) {
    targetRequirement = 'OWN_MONSTER';
    ops.push({ type: 'APPLY_RESTRICTION', restriction: 'IMMUNE_DESTROY' });
    label = 'Otorgar Inmunidad';
  } else if (ops.length === 0 && /cannot attack/i.test(desc)) {
    targetRequirement = 'OPPONENT_MONSTER';
    ops.push({ type: 'APPLY_RESTRICTION', restriction: 'CANNOT_ATTACK' });
    label = 'Bloquear Ataque';
  }

  // 12. Fusion / Ritual summons
  if (card.category === 'SPELL' && /fusion summon/i.test(desc)) {
    ops.push({ type: 'FUSION_SUMMON' });
    label = 'Invocación por Fusión';
  }
  if (card.category === 'SPELL' && card.subtype === 'ritual' && /ritual summon/i.test(desc)) {
    ops.push({ type: 'RITUAL_SUMMON' });
    label = 'Invocación por Ritual';
  }

  // 13. Deck search
  const searchMatch = desc.match(/add 1 .*?(monster|spell|trap) from your deck to your hand/i);
  if (searchMatch && ops.length === 0) {
    const filterMap: Record<string, CardCategory> = {
      monster: 'MONSTER',
      spell: 'SPELL',
      trap: 'TRAP',
    };
    ops.push({
      type: 'SEARCH_TO_HAND',
      filterCategory: filterMap[searchMatch[1].toLowerCase()],
    });
    label = 'Buscar en el Deck';
  }

  if (ops.length === 0) {
    return [];
  }

  return [
    {
      id: `eff_auto_${card.id}`,
      label,
      description: desc.slice(0, 140),
      trigger,
      spellSpeed,
      targetRequirement,
      oncePerTurn: card.category === 'MONSTER',
      condition:
        lpCost || minOpponentMonsters
          ? {
              ...(lpCost ? { minLP: lpCost + 1, lpCost } : {}),
              ...(minOpponentMonsters ? { minOpponentMonsters } : {}),
            }
          : undefined,
      operations: ops,
    },
  ];
}
