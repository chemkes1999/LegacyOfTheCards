import {
  Attribute,
  CardCategory,
  CardDefinition,
  CardEffectDef,
  CardSubtype,
  LinkArrow,
  MonsterRace,
  Rarity,
} from '../types/tcg';

export interface YgoCardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped: string;
}

export interface YgoApiCard {
  id: number;
  name: string;
  type: string;
  frameType?: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  scale?: number;
  linkval?: number;
  linkmarkers?: string[];
  card_images?: YgoCardImage[];
}

export interface YgoAdapterOptions {
  internalId?: string;
  nameOverride?: string;
  descriptionOverride?: string;
  rarity?: Rarity;
  localImagePath?: string;
  effects?: CardEffectDef[];
}

const LINK_MARKER_MAP: Record<string, LinkArrow> = {
  'Top-Left': 'TL',
  Top: 'T',
  'Top-Right': 'TR',
  Left: 'L',
  Right: 'R',
  'Bottom-Left': 'BL',
  Bottom: 'B',
  'Bottom-Right': 'BR',
};

const VALID_ATTRIBUTES = new Set<Attribute>([
  'LIGHT',
  'DARK',
  'FIRE',
  'WATER',
  'WIND',
  'EARTH',
  'DIVINE',
]);

function mapCategoryAndSubtype(raw: YgoApiCard): {
  category: CardCategory;
  subtype: CardSubtype;
  isExtraDeck: boolean;
  isTuner: boolean;
} {
  const typeLower = (raw.type || '').toLowerCase();
  const raceLower = (raw.race || '').toLowerCase();
  const frameLower = (raw.frameType || '').toLowerCase();

  if (typeLower.includes('spell') || frameLower === 'spell') {
    let subtype: CardSubtype = 'normal';
    if (raceLower === 'continuous') subtype = 'continuous';
    else if (raceLower === 'equip') subtype = 'equip';
    else if (raceLower === 'field') subtype = 'field';
    else if (raceLower === 'quick-play') subtype = 'quickplay';
    else if (raceLower === 'ritual') subtype = 'ritual';
    return { category: 'SPELL', subtype, isExtraDeck: false, isTuner: false };
  }

  if (typeLower.includes('trap') || frameLower === 'trap') {
    let subtype: CardSubtype = 'normal';
    if (raceLower === 'continuous') subtype = 'continuous';
    else if (raceLower === 'counter') subtype = 'counter';
    return { category: 'TRAP', subtype, isExtraDeck: false, isTuner: false };
  }

  const isTuner = typeLower.includes('tuner');

  if (typeLower.includes('fusion') || frameLower === 'fusion') {
    return { category: 'MONSTER', subtype: 'fusion', isExtraDeck: true, isTuner };
  }
  if (typeLower.includes('synchro') || frameLower === 'synchro') {
    return { category: 'MONSTER', subtype: 'synchro', isExtraDeck: true, isTuner };
  }
  if (typeLower.includes('xyz') || frameLower === 'xyz') {
    return { category: 'MONSTER', subtype: 'xyz', isExtraDeck: true, isTuner };
  }
  if (typeLower.includes('link') || frameLower === 'link') {
    return { category: 'MONSTER', subtype: 'link', isExtraDeck: true, isTuner: false };
  }
  if (typeLower.includes('ritual') || frameLower === 'ritual') {
    return { category: 'MONSTER', subtype: 'ritual', isExtraDeck: false, isTuner };
  }
  if (typeLower.includes('pendulum') || frameLower.includes('pendulum')) {
    return { category: 'MONSTER', subtype: 'pendulum', isExtraDeck: false, isTuner };
  }
  if (typeLower.includes('normal') && !typeLower.includes('effect')) {
    return { category: 'MONSTER', subtype: 'normal', isExtraDeck: false, isTuner };
  }

  return { category: 'MONSTER', subtype: 'effect', isExtraDeck: false, isTuner };
}

function derivePaletteAndMotif(
  category: CardCategory,
  subtype: CardSubtype,
  attribute?: Attribute,
  race?: string
): { artPalette: [string, string, string]; artMotif: CardDefinition['artMotif'] } {
  if (category === 'SPELL') {
    return {
      artPalette: ['#0d9488', '#134e4a', '#5eead4'],
      artMotif: subtype === 'field' ? 'field' : 'spell',
    };
  }
  if (category === 'TRAP') {
    return {
      artPalette: ['#be185d', '#500724', '#f472b6'],
      artMotif: 'trap',
    };
  }

  const attrPalettes: Record<Attribute, [string, string, string]> = {
    LIGHT: ['#eab308', '#422006', '#fef08a'],
    DARK: ['#7e22ce', '#1e1b4b', '#c084fc'],
    FIRE: ['#dc2626', '#450a0a', '#fb923c'],
    WATER: ['#0284c7', '#082f49', '#7dd3fc'],
    WIND: ['#059669', '#022c22', '#6ee7b7'],
    EARTH: ['#a16207', '#292524', '#fcd34d'],
    DIVINE: ['#f59e0b', '#451a03', '#fde047'],
  };

  const r = (race || '').toLowerCase();
  let artMotif: CardDefinition['artMotif'] = 'knight';
  if (r.includes('dragon') || r.includes('wyrm')) artMotif = 'dragon';
  else if (r.includes('spellcaster') || r.includes('psychic')) artMotif = 'mage';
  else if (r.includes('machine') || r.includes('cyberse')) artMotif = 'mech';
  else if (r.includes('fairy')) artMotif = 'seraph';
  else if (r.includes('fiend') || r.includes('zombie')) artMotif = 'fiend';
  else if (r.includes('beast') || r.includes('dinosaur')) artMotif = 'beast';

  return {
    artPalette: attribute ? attrPalettes[attribute] : ['#475569', '#0f172a', '#94a3b8'],
    artMotif,
  };
}

export function mapYgoCardToDefinition(
  raw: YgoApiCard,
  options: YgoAdapterOptions = {}
): CardDefinition {
  const { category, subtype, isExtraDeck, isTuner } = mapCategoryAndSubtype(raw);

  const upperAttr = raw.attribute?.toUpperCase() as Attribute | undefined;
  const attribute = upperAttr && VALID_ATTRIBUTES.has(upperAttr) ? upperAttr : undefined;
  const race = category === 'MONSTER' && raw.race ? (raw.race as MonsterRace) : undefined;

  const linkArrows =
    subtype === 'link' && Array.isArray(raw.linkmarkers)
      ? raw.linkmarkers
          .map((m) => LINK_MARKER_MAP[m])
          .filter((a): a is LinkArrow => Boolean(a))
      : undefined;

  const level = subtype === 'link' ? raw.linkval ?? 1 : raw.level ?? 0;
  const { artPalette, artMotif } = derivePaletteAndMotif(category, subtype, attribute, raw.race);
  const remoteImg =
    raw.card_images?.[0]?.image_url_cropped ??
    raw.card_images?.[0]?.image_url_small ??
    raw.card_images?.[0]?.image_url;

  return {
    id: options.internalId ?? `ygo_${raw.id}`,
    ygoprodeckId: raw.id,
    name: options.nameOverride ?? raw.name,
    category,
    subtype,
    attribute,
    race,
    level,
    atk: raw.atk ?? 0,
    def: subtype === 'link' ? 0 : raw.def ?? 0,
    isTuner: isTuner || undefined,
    pendulumScale: raw.scale,
    linkArrows,
    isExtraDeck,
    description: options.descriptionOverride ?? raw.desc,
    rarity: options.rarity ?? (isExtraDeck || level >= 7 ? 'UR' : level >= 5 ? 'SR' : 'R'),
    imageUrl: options.localImagePath ?? remoteImg,
    artPalette,
    artMotif,
    effects: options.effects ?? [],
  };
}
