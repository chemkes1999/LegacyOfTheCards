import {
  CardCategory,
  CardDefinition,
  CardEffectDef,
  CardSubtype,
  EffectOperation,
  EffectTrigger,
  TargetRequirement,
} from '../types/tcg';

/**
 * Heuristic parser that translates common Yu-Gi-Oh! card text patterns (English PSCT/classic)
 * into executable EffectManager operations so any imported YGOPRODeck card can be played in duels.
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
  }

  // 1. Negate attack
  if (/negate the attack/i.test(desc)) {
    trigger = 'ON_ATTACK_DECLARE';
    spellSpeed = 2;
    ops.push({ type: 'NEGATE_ATTACK' });
  }

  // 2. Counter negation
  if (card.subtype === 'counter' && /negate the activation/i.test(desc)) {
    targetRequirement = 'PREVIOUS_CHAIN_LINK';
    ops.push({ type: 'NEGATE_CHAIN_LINK' });
    const lpMatch = desc.match(/pay (\d+) lp/i);
    if (lpMatch) {
      lpCost = Number(lpMatch[1]);
    }
  }

  // 3. Draw cards
  const drawMatch = desc.match(/draw (\d+) cards?/i);
  if (drawMatch) {
    const count = Math.min(3, Math.max(1, Number(drawMatch[1])));
    ops.push({ type: 'DRAW', value: count });
  }

  // 4. Board wipes
  if (/destroy all monsters your opponent controls/i.test(desc) || /destroy all attack position monsters your opponent controls/i.test(desc)) {
    minOpponentMonsters = 1;
    ops.push({ type: 'DESTROY_ALL_OPPONENT_MONSTERS' });
  } else if (/destroy all spells and traps your opponent controls/i.test(desc)) {
    ops.push({ type: 'DESTROY_ALL_SPELLS_TRAPS' });
  } else {
    // 5. Targeted destruction / banishing
    if (/banish (?:1|that|the) (?:face-up )?monster/i.test(desc)) {
      targetRequirement = 'OPPONENT_MONSTER';
      ops.push({ type: 'BANISH_TARGET' });
    } else if (/destroy (?:1|that|the) (?:face-up )?(?:spell\/trap|spell or trap)/i.test(desc)) {
      targetRequirement = 'OPPONENT_SPELL_TRAP';
      ops.push({ type: 'DESTROY_TARGET' });
    } else if (/destroy (?:1|that|the) (?:face-up )?monster/i.test(desc)) {
      targetRequirement = 'OPPONENT_MONSTER';
      ops.push({ type: 'DESTROY_TARGET' });
    }
  }

  // 6. Direct LP damage / heal
  const dmgMatch = desc.match(/inflict (\d+) damage/i);
  if (dmgMatch) {
    ops.push({ type: 'DAMAGE_OPPONENT', value: Math.min(3000, Number(dmgMatch[1])) });
  }
  const healMatch = desc.match(/(?:gain|increase your life points by) (\d+) (?:lp|life points)/i);
  if (healMatch) {
    ops.push({ type: 'HEAL_SELF', value: Math.min(3000, Number(healMatch[1])) });
  }

  // 7. ATK/DEF modification
  const gainAtkMatch = desc.match(/gains? (\d+) atk/i);
  const loseAtkMatch = desc.match(/loses? (\d+) atk/i);
  if (gainAtkMatch) {
    if (targetRequirement === 'NONE') targetRequirement = 'OWN_MONSTER';
    const delta = Math.min(2000, Number(gainAtkMatch[1]));
    ops.push({ type: 'MODIFY_STATS', atkDelta: delta, defDelta: 0 });
  } else if (loseAtkMatch) {
    if (targetRequirement === 'NONE') targetRequirement = 'OPPONENT_MONSTER';
    const delta = -Math.min(2000, Number(loseAtkMatch[1]));
    ops.push({ type: 'MODIFY_STATS', atkDelta: delta, defDelta: 0 });
  }

  // 8. Special Summon from GY
  if (/special summon 1 .*monster.* from (?:your|either) (?:gy|graveyard)/i.test(desc)) {
    targetRequirement = 'OWN_GY_MONSTER';
    ops.push({ type: 'SPECIAL_SUMMON_FROM_GY' });
  }

  // 9. Fusion / Ritual summons
  if (card.category === 'SPELL' && /fusion summon/i.test(desc)) {
    ops.push({ type: 'FUSION_SUMMON' });
  }
  if (card.category === 'SPELL' && card.subtype === 'ritual' && /ritual summon/i.test(desc)) {
    ops.push({ type: 'RITUAL_SUMMON' });
  }

  // 10. Deck search
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
  }

  if (ops.length === 0) {
    return [];
  }

  return [
    {
      id: `eff_auto_${card.id}`,
      label: 'Activar Efecto',
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
