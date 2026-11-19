import test from 'node:test';
import assert from 'node:assert/strict';
import { mapYgoCardToDefinition } from '../ygoprodeckAdapter';

test('mapYgoCardToDefinition: convierte Monstruo Normal, Link, Péndulo, Mágica y Trampa correctamente', () => {
  const blueEyes = mapYgoCardToDefinition(
    {
      id: 89631139,
      name: 'Blue-Eyes White Dragon',
      type: 'Normal Monster',
      frameType: 'normal',
      desc: 'Legendary dragon',
      atk: 3000,
      def: 2500,
      level: 8,
      race: 'Dragon',
      attribute: 'LIGHT',
      card_images: [
        {
          id: 89631139,
          image_url: 'https://example.com/full.jpg',
          image_url_small: 'https://example.com/small.jpg',
          image_url_cropped: 'https://example.com/crop.jpg',
        },
      ],
    },
    { internalId: 'ygo_blue_eyes', nameOverride: 'Dragón Blanco de Ojos Azules', localImagePath: '/cards/89631139.jpg' }
  );

  assert.equal(blueEyes.id, 'ygo_blue_eyes');
  assert.equal(blueEyes.ygoprodeckId, 89631139);
  assert.equal(blueEyes.category, 'MONSTER');
  assert.equal(blueEyes.subtype, 'normal');
  assert.equal(blueEyes.isExtraDeck, false);
  assert.equal(blueEyes.atk, 3000);
  assert.equal(blueEyes.def, 2500);
  assert.equal(blueEyes.imageUrl, '/cards/89631139.jpg');

  const decode = mapYgoCardToDefinition({
    id: 1861629,
    name: 'Decode Talker',
    type: 'Link Monster',
    frameType: 'link',
    desc: 'Link monster',
    atk: 2300,
    linkval: 3,
    linkmarkers: ['Top', 'Bottom-Left', 'Bottom-Right'],
    race: 'Cyberse',
    attribute: 'DARK',
  });
  assert.equal(decode.subtype, 'link');
  assert.equal(decode.isExtraDeck, true);
  assert.equal(decode.level, 3);
  assert.equal(decode.def, 0);
  assert.deepEqual(decode.linkArrows, ['T', 'BL', 'BR']);

  const mst = mapYgoCardToDefinition({
    id: 5318639,
    name: 'Mystical Space Typhoon',
    type: 'Spell Card',
    frameType: 'spell',
    race: 'Quick-Play',
    desc: 'Target 1 Spell/Trap on the field; destroy that target.',
  });
  assert.equal(mst.category, 'SPELL');
  assert.equal(mst.subtype, 'quickplay');

  const solemn = mapYgoCardToDefinition({
    id: 41420027,
    name: 'Solemn Judgment',
    type: 'Trap Card',
    frameType: 'trap',
    race: 'Counter',
    desc: 'Pay half LP; negate activation.',
  });
  assert.equal(solemn.category, 'TRAP');
  assert.equal(solemn.subtype, 'counter');
});

test('Integridad Fase 2: set curado de YGOPRODeck y mazo Leyendas Clásicas son válidos', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { CARD_BY_ID } = await import('../../data/cards');
  const { CLASSIC_YGO_EXTRA, CLASSIC_YGO_MAIN } = await import('../../data/decks');
  const { CURATED_YGO_MANIFEST } = await import('../../data/ygoprodeckManifest');
  const { DeckManager } = await import('../../engine/DeckManager');

  for (const spec of CURATED_YGO_MANIFEST) {
    const def = CARD_BY_ID[spec.internalId];
    assert.ok(def, `Missing synced card ${spec.internalId} in CARD_BY_ID`);
    assert.equal(def.ygoprodeckId, spec.ygoprodeckId);
    const imgUrl = def.imageUrl ?? '';
    assert.ok(imgUrl.startsWith('/cards/'), `Expected local cached image for ${spec.internalId}`);
    const filePath = path.resolve(process.cwd(), 'public', imgUrl.slice(1));
    assert.ok(fs.existsSync(filePath), `Cached image missing on disk: ${filePath}`);
  }

  const res = DeckManager.validateDeck({
    mainDeckIds: CLASSIC_YGO_MAIN,
    extraDeckIds: CLASSIC_YGO_EXTRA,
  });
  assert.equal(res.valid, true, `Classic YGO deck should be valid: ${res.errors.join('; ')}`);
  assert.equal(res.mainCount, 40);
  assert.equal(res.extraCount, 5);
});

test('inferCardEffectsFromDescription y registro dinámico de cartas importadas', async () => {
  const { inferCardEffectsFromDescription } = await import('../ygoprodeckEffectParser');
  const { CardManager } = await import('../../engine/CardManager');
  const { SaveManager } = await import('../../engine/SaveManager');

  const potEffects = inferCardEffectsFromDescription({
    id: 'ygo_custom_pot',
    category: 'SPELL',
    subtype: 'normal',
    description: 'Draw 2 cards.',
  });
  assert.equal(potEffects.length, 1);
  assert.equal(potEffects[0].operations[0].type, 'DRAW');
  assert.equal(potEffects[0].operations[0].value, 2);

  const trapEffects = inferCardEffectsFromDescription({
    id: 'ygo_custom_trap',
    category: 'TRAP',
    subtype: 'normal',
    description: "When an opponent's monster declares an attack: Negate the attack and inflict 800 damage.",
  });
  assert.equal(trapEffects.length, 1);
  assert.equal(trapEffects[0].trigger, 'ON_ATTACK_DECLARE');
  assert.equal(trapEffects[0].operations[0].type, 'NEGATE_ATTACK');
  assert.equal(trapEffects[0].operations[1].type, 'DAMAGE_OPPONENT');

  // Dynamic import round-trip
  const mem: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v; },
    removeItem: (k: string) => { delete mem[k]; },
  };
  let profile = SaveManager.load(mockStorage);
  const imported = mapYgoCardToDefinition({
    id: 70095154,
    name: 'Cyber Dragon',
    type: 'Effect Monster',
    frameType: 'effect',
    desc: 'If only your opponent controls a monster, you can Special Summon this card.',
    atk: 2100,
    def: 1600,
    level: 5,
    race: 'Machine',
    attribute: 'LIGHT',
  });
  profile = SaveManager.importCustomCard(profile, imported, mockStorage);
  CardManager.registerCustomCards(profile.customImportedCards ?? []);
  assert.equal(CardManager.getDef(imported.id).name, 'Cyber Dragon');
  assert.equal(SaveManager.load(mockStorage).customImportedCards?.length, 1);
  CardManager.registerCustomCards([]);

  // Bulk catalog registration & deduplication against curated ygoprodeckId (89631139 = Blue-Eyes)
  const bulkDuplicateBlueEyes = mapYgoCardToDefinition({
    id: 89631139,
    name: 'Blue-Eyes White Dragon',
    type: 'Normal Monster',
    frameType: 'normal',
    desc: 'Duplicate from bulk',
    atk: 3000,
    def: 2500,
    level: 8,
    race: 'Dragon',
    attribute: 'LIGHT',
  });
  const bulkUnique = mapYgoCardToDefinition({
    id: 33396948,
    name: 'Exodia the Forbidden One',
    type: 'Effect Monster',
    frameType: 'effect',
    desc: 'Exodia',
    atk: 1000,
    def: 1000,
    level: 3,
    race: 'Spellcaster',
    attribute: 'DARK',
  });
  const beforeCount = CardManager.getAll().length;
  CardManager.registerBulkCatalog([bulkDuplicateBlueEyes, bulkUnique]);
  assert.equal(CardManager.getAll().length, beforeCount + 1);
  assert.equal(CardManager.getDef(bulkUnique.id).name, 'Exodia the Forbidden One');
  CardManager.registerBulkCatalog([]);
  assert.equal(CardManager.getAll().length, beforeCount);
});

test('parseYdk y exportYdk: importa y exporta mazos en formato estándar .ydk', async () => {
  const { exportYdk, parseYdk } = await import('../ydkCodec');
  const sampleYdk = [
    '#created by test',
    '#main',
    '89631139',
    '89631139',
    '46986414',
    '55144522',
    '99999999', // unknown ID
    '#extra',
    '23995346',
    '84013237',
    '!side',
    '44095762',
  ].join('\n');

  const parsed = parseYdk(sampleYdk);
  assert.equal(parsed.mainDeckIds.length, 4);
  assert.equal(parsed.extraDeckIds.length, 2);
  assert.deepEqual(parsed.missingYgoIds, [99999999]);

  const exported = exportYdk({
    name: 'Test YDK',
    mainDeckIds: parsed.mainDeckIds,
    extraDeckIds: parsed.extraDeckIds,
  });
  assert.equal(exported.skippedCount, 0);
  assert.ok(exported.content.includes('89631139'));
  assert.ok(exported.content.includes('23995346'));
});

test('Trident Warrior: detecta ON_SUMMON + SPECIAL_SUMMON_FROM_HAND e Invoca Nivel 3 desde la mano', async () => {
  const { CardManager } = await import('../../engine/CardManager');
  const { DuelManager } = await import('../../engine/DuelManager');
  const { EffectManager } = await import('../../engine/EffectManager');

  // Register Trident Warrior with empty effects (simulating older IndexedDB cache)
  const trident = mapYgoCardToDefinition({
    id: 42810973,
    name: 'Trident Warrior',
    type: 'Effect Monster',
    frameType: 'effect',
    desc: 'When this card is Normal Summoned: You can Special Summon 1 Level 3 monster from your hand.',
    atk: 1800,
    def: 1200,
    level: 4,
    race: 'Warrior',
    attribute: 'LIGHT',
  });
  CardManager.registerBulkCatalog([trident]);

  const enriched = CardManager.getDef(trident.id);
  assert.equal(enriched.effects.length, 1);
  assert.equal(enriched.effects[0].trigger, 'ON_SUMMON');
  assert.equal(enriched.effects[0].targetRequirement, 'OWN_HAND_MONSTER');
  assert.equal(enriched.effects[0].operations[0].type, 'SPECIAL_SUMMON_FROM_HAND');
  assert.equal(enriched.effects[0].operations[0].filterExactLevel, 3);

  // Build deterministic duel with Trident Warrior (Lv4) + ygo_junk_synchron (Lv3) in hand
  const pad = Array.from({ length: 35 }, () => 'm_ebony_knight');
  let state = DuelManager.createDuel({
    mode: 'VS_AI',
    playerDeckIds: [trident.id, 'ygo_junk_synchron', 'm_ebony_knight', 'm_valiant_blade', 'm_dawn_mage', ...pad],
    playerExtraIds: [],
    opponentDeckIds: ['m_ebony_knight', 'm_ebony_knight', 'm_ebony_knight', 'm_ebony_knight', 'm_ebony_knight', ...pad],
    opponentExtraIds: [],
    shuffle: false,
  });

  const tridentHand = state.player.hand.find((c) => c.cardId === trident.id)!;
  const lv3Hand = state.player.hand.find((c) => c.cardId === 'ygo_junk_synchron')!;
  state = DuelManager.normalSummonOrSet(state, 'player', tridentHand.uid, [], 'ATK', false).state;

  const liveTrident = CardManager.findInstance(state, tridentHand.uid)!;
  const can = EffectManager.canActivateEffect(state, 'player', liveTrident, enriched.effects[0]);
  assert.equal(can.allowed, true, `Should be allowed to activate Trident Warrior: ${can.reason}`);

  state = DuelManager.activateCard(state, 'player', liveTrident.uid, 0, lv3Hand.uid).state;
  const summonedLv3 = CardManager.findInstance(state, lv3Hand.uid)!;
  assert.equal(summonedLv3.location, 'MONSTER');
  CardManager.registerBulkCatalog([]);
});
