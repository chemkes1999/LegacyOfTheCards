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
});
