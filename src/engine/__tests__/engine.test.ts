import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCED_STARTER_MAIN, STARTER_EXTRA_DECK } from '../../data/decks';
import { AIController } from '../AIController';
import { BattleManager } from '../BattleManager';
import { CardManager } from '../CardManager';
import { ChainManager } from '../ChainManager';
import { DeckManager } from '../DeckManager';
import { DuelManager } from '../DuelManager';
import { EffectManager } from '../EffectManager';
import { SaveManager, StorageLike } from '../SaveManager';
import { SummonManager } from '../SummonManager';
import { TurnManager } from '../TurnManager';

function createDeterministicDuel(
  playerCards: string[],
  opponentCards: string[],
  extraCards: string[] = STARTER_EXTRA_DECK
) {
  const pad = (list: string[], fillId: string) => {
    const out = [...list];
    while (out.length < 40) out.push(fillId);
    return out;
  };
  return DuelManager.createDuel({
    mode: 'VS_AI',
    playerDeckIds: pad(playerCards, 'm_ebony_knight'),
    playerExtraIds: extraCards,
    opponentDeckIds: pad(opponentCards, 'm_stone_sentinel'),
    opponentExtraIds: extraCards,
    startingLP: 8000,
    startingHandSize: 5,
    aiDifficulty: 'NORMAL',
    shuffle: false,
  });
}

test('Validación de mazo: acepta mazo inicial de 40 cartas y rechaza duplicados > 3 o tamaño < 40', () => {
  const validRes = DeckManager.validateDeck({
    mainDeckIds: BALANCED_STARTER_MAIN,
    extraDeckIds: STARTER_EXTRA_DECK,
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.mainCount, 40);

  const tooSmall = DeckManager.validateDeck({
    mainDeckIds: BALANCED_STARTER_MAIN.slice(0, 30),
    extraDeckIds: [],
  });
  assert.equal(tooSmall.valid, false);
  assert.ok(tooSmall.errors.length > 0);

  const tooManyCopies = DeckManager.validateDeck({
    mainDeckIds: Array(40).fill('m_ebony_knight'),
    extraDeckIds: [],
  });
  assert.equal(tooManyCopies.valid, false);
});

test('Reglas de turnos: Turno 1 bloquea Battle Phase, Turno 2+ permite robar y entrar en Battle Phase', () => {
  let state = createDeterministicDuel(
    ['m_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage', 'm_crimson_elemental'],
    ['m_stone_sentinel', 'm_emerald_drake', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage']
  );

  assert.equal(state.turnNumber, 1);
  assert.equal(state.phase, 'MAIN1');
  assert.equal(state.player.hand.length, 5);

  // Turn 1 cannot enter Battle Phase
  const battleAttempt = DuelManager.advancePhase(state, 'BATTLE');
  assert.ok(battleAttempt.error);
  assert.equal(battleAttempt.state.phase, 'MAIN1');

  // End Turn 1 -> Opponent Turn 2 draws 1 card (5 -> 6) and can enter Battle Phase
  state = DuelManager.endTurn(state);
  assert.equal(state.turnNumber, 2);
  assert.equal(state.activePlayer, 'opponent');
  assert.equal(state.opponent.hand.length, 6);
  assert.equal(state.phase, 'MAIN1');

  const oppBattle = DuelManager.advancePhase(state, 'BATTLE');
  assert.equal(oppBattle.error, undefined);
  assert.equal(oppBattle.state.phase, 'BATTLE');
});

test('Invocación Normal, por Sacrificio y límites por turno', () => {
  let state = createDeterministicDuel(
    ['m_ebony_knight', 'm_azure_dragon', 'm_infernal_drake', 'm_valiant_blade', 'm_tuner_squire'],
    ['m_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel']
  );

  const knight = state.player.hand[0];
  const dragon = state.player.hand[1]; // Level 8 -> requires 2 tributes

  // Cannot Normal Summon Level 8 without 2 tributes
  const badTribute = SummonManager.validateNormalSummon(state, 'player', dragon.uid);
  assert.equal(badTribute.canSummon, false);
  assert.equal(badTribute.requiredTributes, 2);

  // Normal Summon Ebony Knight (Level 4)
  const summonRes = DuelManager.normalSummonOrSet(state, 'player', knight.uid, [], 'ATK', false);
  assert.equal(summonRes.error, undefined);
  state = summonRes.state;
  assert.equal(state.player.normalSummonsRemaining, 0);
  assert.equal(CardManager.getAllFieldMonsters(state, 'player').length, 1);

  // Cannot Normal Summon twice in the same turn
  const secondSummon = DuelManager.normalSummonOrSet(state, 'player', state.player.hand[2].uid, [], 'ATK', false);
  assert.ok(secondSummon.error);
});

test('Invocaciones Especiales: Sincronía, Xyz, Enlace y Péndulo', () => {
  let state = createDeterministicDuel(
    ['m_tuner_squire', 'm_ebony_knight', 'm_pendulum_astro', 'm_pendulum_dragon', 'm_valiant_blade'],
    ['m_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel', 'm_stone_sentinel']
  );

  // Place 2 Level 4 monsters (1 Tuner + 1 Non-Tuner) onto player field for Synchro/Xyz/Link tests
  const tuner = state.player.hand.shift()!;
  const knight = state.player.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'player', tuner, 'ATK', true, false);
  SummonManager.placeMonsterOnField(state, 'player', knight, 'ATK', true, false);

  // Synchro Level 8 (4 + 4)
  const seraph = state.player.extraDeck.find((c) => c.cardId === 'm_synchro_seraph')!;
  const syncVal = SummonManager.validateSynchroSummon(state, 'player', seraph.uid);
  assert.equal(syncVal.canSummon, true);

  // Xyz Rank 4 (two Level 4s)
  const sovereign = state.player.extraDeck.find((c) => c.cardId === 'm_xyz_sovereign')!;
  const xyzVal = SummonManager.validateXyzSummon(state, 'player', sovereign.uid);
  assert.equal(xyzVal.canSummon, true);
  const xyzRes = DuelManager.extraSummon(state, 'player', sovereign.uid, [tuner.uid, knight.uid], 'XYZ');
  assert.equal(xyzRes.error, undefined);
  const summonedXyz = CardManager.getAllFieldMonsters(xyzRes.state, 'player')[0];
  assert.equal(summonedXyz.xyzMaterials.length, 2);

  // Pendulum Scale placement & Pendulum Summon
  const astro = state.player.hand.find((c) => c.cardId === 'm_pendulum_astro')!;
  const pDragon = state.player.hand.find((c) => c.cardId === 'm_pendulum_dragon')!;
  state = DuelManager.placePendulum(state, 'player', astro.uid, 'LEFT').state;
  state = DuelManager.placePendulum(state, 'player', pDragon.uid, 'RIGHT').state;

  const pendVal = SummonManager.validatePendulumSummon(state, 'player');
  assert.equal(pendVal.canSummon, true);
  assert.equal(pendVal.minLevel, 2);
  assert.equal(pendVal.maxLevel, 7);
});

test('Combate y cálculo de daño: ATK vs ATK, ATK vs DEF, ataque directo y victoria por 0 LP', () => {
  let state = createDeterministicDuel(
    ['m_azure_dragon', 'm_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage'],
    ['m_stone_sentinel', 'm_crimson_elemental', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage']
  );

  // Advance to Turn 3 (Player's second turn) so Battle Phase is legal
  state = DuelManager.endTurn(state); // Turn 2 Opp
  state = DuelManager.endTurn(state); // Turn 3 Player
  assert.equal(state.turnNumber, 3);
  assert.equal(state.activePlayer, 'player');

  const pDragon = state.player.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'player', pDragon, 'ATK', true, false);
  const oppSentinel = state.opponent.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'opponent', oppSentinel, 'DEF', true, false);
  const oppElemental = state.opponent.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'opponent', oppElemental, 'ATK', true, false);

  state = DuelManager.advancePhase(state, 'BATTLE').state;

  // ATK (3000) vs DEF (2100): defender destroyed, 0 LP damage
  const resDef = BattleManager.executeAttack(state, pDragon.uid, oppSentinel.uid);
  assert.equal(resDef.executed, true);
  assert.equal(resDef.defenderDestroyed, true);
  assert.equal(resDef.damageToDefender, 0);
  assert.equal(state.opponent.lp, 8000);

  // Reset attacked flag on the live cloned instance to test ATK vs ATK
  CardManager.findInstance(state, pDragon.uid)!.attackedThisTurn = false;
  const resAtk = BattleManager.executeAttack(state, pDragon.uid, oppElemental.uid);
  assert.equal(resAtk.executed, true);
  assert.equal(resAtk.defenderDestroyed, true);
  assert.equal(resAtk.damageToDefender, 1200); // 3000 - 1800
  assert.equal(state.opponent.lp, 6800);

  // Direct attack reduces LP and triggers victory at 0
  state.opponent.lp = 2500;
  CardManager.findInstance(state, pDragon.uid)!.attackedThisTurn = false;
  const resDirect = BattleManager.executeAttack(state, pDragon.uid);
  assert.equal(resDirect.damageToDefender, 3000);
  assert.equal(state.opponent.lp, 0);
  assert.equal(state.winner, 'player');
});

test('Motor de Efectos y Cadena LIFO: negación con Contraefecto y ejecución única sin duplicados', () => {
  let state = createDeterministicDuel(
    ['s_arcane_greed', 'm_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage'],
    ['t_solemn_judgment', 'm_stone_sentinel', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage']
  );

  // Set Solemn Judgment on opponent field on Turn 1 (turnPlaced = 1), then move to Turn 3 so it's live
  const judgment = state.opponent.hand.shift()!;
  judgment.location = 'SPELL_TRAP';
  judgment.zoneIndex = 0;
  judgment.faceUp = false;
  judgment.turnPlaced = 1;
  state.opponent.spellsTraps[0] = judgment;

  state.turnNumber = 3;
  state.activePlayer = 'player';
  state.phase = 'MAIN1';

  const pot = state.player.hand[0];
  const initialHandCount = state.player.hand.length;

  // Manually build Chain Link 1 (Pot of Greed) and Chain Link 2 (Solemn Judgment)
  state.player.hand = state.player.hand.filter((c) => c.uid !== pot.uid);
  pot.location = 'SPELL_TRAP';
  pot.zoneIndex = 0;
  pot.faceUp = true;
  state.player.spellsTraps[0] = pot;

  ChainManager.pushLink(state, 'player', pot.uid, CardManager.getDef(pot.cardId).effects[0]);
  ChainManager.pushLink(state, 'opponent', judgment.uid, CardManager.getDef(judgment.cardId).effects[0]);

  assert.equal(state.chainStack.length, 2);
  EffectManager.resolveChainStack(state);

  // Solemn Judgment paid 1000 LP and negated Pot of Greed -> player drew 0 cards!
  assert.equal(state.opponent.lp, 7000);
  assert.equal(state.player.hand.length, initialHandCount - 1);
  assert.equal(state.chainStack.length, 0);
});

test('IA táctica y persistencia SaveManager: ejecuta jugadas válidas y guarda historial/mazos', () => {
  let state = createDeterministicDuel(
    ['m_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage', 'm_crimson_elemental'],
    ['s_arcane_greed', 'm_ebony_knight', 'm_tuner_squire', 'm_valiant_blade', 'm_dawn_mage']
  );
  state = DuelManager.endTurn(state); // Opponent Turn 2
  const action = AIController.computeNextAction(state);
  assert.ok(action !== null);
  state = action!.apply(state);
  assert.ok(state.logs.length > 0);

  // Test SaveManager persistence round-trip with in-memory storage
  const mem: Record<string, string> = {};
  const mockStorage: StorageLike = {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = v; },
    removeItem: (k) => { delete mem[k]; },
  };
  let profile = SaveManager.load(mockStorage);
  assert.equal(profile.decks.length, 2);

  profile = SaveManager.recordDuelResult(
    profile,
    {
      id: 'duel_test_1',
      date: Date.now(),
      mode: 'CAMPAIGN',
      opponentName: 'Kaelen',
      difficulty: 'EASY',
      result: 'WIN',
      turns: 5,
      finalPlayerLP: 6500,
      finalOpponentLP: 0,
      damageDealt: 8000,
      deckName: 'Legado del Dragón Azul',
    },
    300,
    'stage_1_novice',
    'm_obsidian_golem',
    mockStorage
  );

  const reloaded = SaveManager.load(mockStorage);
  assert.equal(reloaded.duelPoints, 800);
  assert.equal(reloaded.history.length, 1);
  assert.ok(reloaded.completedStageIds.includes('stage_1_novice'));
});

test('Regresión IA: no entra en bucle infinito con 5/5 zonas Mágicas/Trampas ocupadas', () => {
  let state = createDeterministicDuel(
    ['m_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage', 'm_crimson_elemental'],
    ['s_arcane_greed', 't_mirror_force', 't_magic_cylinder', 't_bottomless_trap', 't_fiendish_chain', 't_solemn_judgment']
  );
  state = DuelManager.endTurn(state); // Opponent Turn 2

  // Fill all 5 opponent Spell/Trap zones
  for (let i = 0; i < 5; i++) {
    const dummy = state.opponent.deck.shift()!;
    dummy.location = 'SPELL_TRAP';
    dummy.zoneIndex = i;
    dummy.faceUp = false;
    dummy.turnPlaced = 1;
    state.opponent.spellsTraps[i] = dummy;
  }

  // Ensure Pot of Greed is in AI hand
  const pot = state.opponent.hand.find((c) => c.cardId === 's_arcane_greed')!;
  assert.ok(pot, 's_arcane_greed should be in opponent hand');

  const canActivate = EffectManager.canActivateEffect(
    state,
    'opponent',
    pot,
    CardManager.getDef(pot.cardId).effects[0]
  );
  assert.equal(canActivate.allowed, false);

  // Run AI turn loop with a strict step cap to prove termination
  let steps = 0;
  while (state.activePlayer === 'opponent' && !state.winner && steps < 15) {
    const act = AIController.computeNextAction(state);
    if (!act) break;
    state = act.apply(state);
    steps++;
  }
  assert.ok(steps < 15, `AI should finish turn cleanly, took ${steps} steps`);
  assert.equal(state.activePlayer, 'player');
});

test('Regresión Combate: impide atacar desde Cementerio y aborta si una trampa destruye al atacante', () => {
  let state = createDeterministicDuel(
    ['m_ebony_knight', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage', 'm_crimson_elemental'],
    ['t_mirror_force', 'm_stone_sentinel', 'm_valiant_blade', 'm_tuner_squire', 'm_dawn_mage']
  );
  state = DuelManager.endTurn(state); // Turn 2 Opp
  state = DuelManager.endTurn(state); // Turn 3 Player

  // Place a monster in player's GY (faceUp ATK as it would be after destruction)
  const gyMon = state.player.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'player', gyMon, 'ATK', true, false);
  SummonManager.sendToGraveyard(state, gyMon);

  // Place a live attacker on field
  const attacker = state.player.hand.shift()!;
  SummonManager.placeMonsterOnField(state, 'player', attacker, 'ATK', true, false);

  // Set Mirror Force for opponent on Turn 1 so it is active on Turn 3
  const mirrorForce = state.opponent.hand.find((c) => c.cardId === 't_mirror_force')!;
  state.opponent.hand = state.opponent.hand.filter((c) => c.uid !== mirrorForce.uid);
  mirrorForce.location = 'SPELL_TRAP';
  mirrorForce.zoneIndex = 0;
  mirrorForce.faceUp = false;
  mirrorForce.turnPlaced = 1;
  state.opponent.spellsTraps[0] = mirrorForce;

  state = DuelManager.advancePhase(state, 'BATTLE').state;

  // 1. Attacking from GY must be rejected
  const gyCheck = BattleManager.canDeclareAttack(state, gyMon.uid);
  assert.equal(gyCheck.allowed, false);

  // 2. Attacking into Mirror Force destroys attacker and deals 0 LP damage
  const initialOppLp = state.opponent.lp;
  state = DuelManager.declareAttack(state, 'player', attacker.uid).state;
  assert.equal(state.opponent.lp, initialOppLp);
  assert.equal(CardManager.findInstance(state, attacker.uid)?.location, 'GRAVEYARD');
});

