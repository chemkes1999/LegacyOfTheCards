export type CardCategory = 'MONSTER' | 'SPELL' | 'TRAP';

export type MonsterSubtype =
  | 'normal'
  | 'effect'
  | 'fusion'
  | 'synchro'
  | 'xyz'
  | 'pendulum'
  | 'link'
  | 'ritual';

export type SpellSubtype =
  | 'normal'
  | 'continuous'
  | 'equip'
  | 'field'
  | 'quickplay'
  | 'ritual';

export type TrapSubtype = 'normal' | 'continuous' | 'counter';

export type CardSubtype = MonsterSubtype | SpellSubtype | TrapSubtype;

export type Attribute = 'LIGHT' | 'DARK' | 'FIRE' | 'WATER' | 'WIND' | 'EARTH' | 'DIVINE';

export type MonsterRace =
  | 'Dragon'
  | 'Spellcaster'
  | 'Warrior'
  | 'Fiend'
  | 'Machine'
  | 'Fairy'
  | 'Cyberse'
  | 'Beast'
  | 'Beast-Warrior'
  | 'Pyro'
  | 'Aqua'
  | 'Zombie'
  | 'Plant'
  | 'Insect'
  | 'Rock'
  | 'Winged Beast'
  | 'Thunder'
  | 'Sea Serpent'
  | 'Reptile'
  | 'Dinosaur'
  | 'Fish'
  | 'Psychic'
  | 'Wyrm'
  | 'Divine-Beast'
  | 'Creator-God'
  | 'Illusion';

export type Rarity = 'N' | 'R' | 'SR' | 'UR';

export type LinkArrow = 'TL' | 'T' | 'TR' | 'L' | 'R' | 'BL' | 'B' | 'BR';

export type EffectTrigger =
  | 'IGNITION'          // Activated manually in Main Phase
  | 'ON_SUMMON'         // Triggers when summoned
  | 'QUICK'             // Spell Speed 2 - can respond in Chain or Battle
  | 'COUNTER'           // Spell Speed 3 - Counter Trap negation
  | 'CONTINUOUS'        // Passive aura while face-up on field
  | 'ON_ATTACK_DECLARE' // Trap/Quick trigger when opponent declares attack
  | 'ON_DESTROYED';     // Triggers when sent from field to GY

export type EffectOperationType =
  | 'DRAW'
  | 'DAMAGE_OPPONENT'
  | 'HEAL_SELF'
  | 'DESTROY_TARGET'
  | 'DESTROY_ALL_OPPONENT_MONSTERS'
  | 'DESTROY_ALL_SPELLS_TRAPS'
  | 'BANISH_TARGET'
  | 'MODIFY_STATS'
  | 'SPECIAL_SUMMON_FROM_GY'
  | 'SPECIAL_SUMMON_FROM_HAND'
  | 'SEARCH_TO_HAND'
  | 'CHANGE_POSITION'
  | 'NEGATE_CHAIN_LINK'
  | 'NEGATE_ATTACK'
  | 'APPLY_RESTRICTION'
  | 'FUSION_SUMMON'
  | 'RITUAL_SUMMON'
  | 'DETACH_XYZ_BOOST';

export type TargetRequirement =
  | 'NONE'
  | 'OPPONENT_MONSTER'
  | 'OPPONENT_SPELL_TRAP'
  | 'OPPONENT_ANY_CARD'
  | 'OWN_MONSTER'
  | 'ANY_MONSTER'
  | 'OWN_GY_MONSTER'
  | 'OWN_HAND_MONSTER'
  | 'PREVIOUS_CHAIN_LINK';

export interface EffectOperation {
  type: EffectOperationType;
  value?: number;
  atkDelta?: number;
  defDelta?: number;
  filterCategory?: CardCategory;
  filterAttribute?: Attribute;
  filterMaxLevel?: number;
  filterExactLevel?: number;
  restriction?: 'CANNOT_ATTACK' | 'CANNOT_CHANGE_POS' | 'IMMUNE_DESTROY';
  duration?: 'TURN' | 'PERMANENT';
}

export interface CardEffectDef {
  id: string;
  label: string;
  description: string;
  trigger: EffectTrigger;
  spellSpeed: 1 | 2 | 3;
  targetRequirement: TargetRequirement;
  oncePerTurn?: boolean;
  requiresXyzMaterial?: number;
  condition?: {
    minOpponentMonsters?: number;
    minOwnMonsters?: number;
    minLP?: number;
    maxLP?: number;
    lpCost?: number;
    requiresFaceUpMonster?: boolean;
  };
  operations: EffectOperation[];
}

export interface CardDefinition {
  id: string;
  ygoprodeckId?: number;
  name: string;
  category: CardCategory;
  subtype: CardSubtype;
  attribute?: Attribute;
  race?: MonsterRace;
  level: number; // Level (1-12), Rank for Xyz, or Link Rating for Link
  atk: number;
  def: number;
  isTuner?: boolean;
  pendulumScale?: number;
  linkArrows?: LinkArrow[];
  isExtraDeck: boolean;
  summonRequirementText?: string;
  description: string;
  rarity: Rarity;
  bossImage?: string; // Optional high-res generated artwork path
  imageUrl?: string; // Cached local artwork (/cards/<id>.jpg) or remote YGOPRODeck URL
  artPalette: [string, string, string]; // Primary, secondary, glow colors for procedural card art
  artMotif: 'dragon' | 'knight' | 'mage' | 'mech' | 'beast' | 'seraph' | 'fiend' | 'spell' | 'trap' | 'field';
  effects: CardEffectDef[];
}

export type PlayerId = 'player' | 'opponent';

export type BattlePosition = 'ATK' | 'DEF';

export type ZoneLocation =
  | 'HAND'
  | 'MONSTER'
  | 'SPELL_TRAP'
  | 'FIELD'
  | 'EXTRA_MONSTER'
  | 'PENDULUM_LEFT'
  | 'PENDULUM_RIGHT'
  | 'DECK'
  | 'EXTRA_DECK'
  | 'GRAVEYARD'
  | 'BANISHED';

export interface CardInstance {
  uid: string;
  cardId: string;
  owner: PlayerId;
  controller: PlayerId;
  location: ZoneLocation;
  zoneIndex: number; // 0-4 for main zones, 0-1 for EMZ, etc.
  faceUp: boolean;
  position: BattlePosition;
  summonedThisTurn: boolean;
  attackedThisTurn: boolean;
  positionChangedThisTurn: boolean;
  effectUsedThisTurn: boolean;
  atkModifier: number;
  defModifier: number;
  xyzMaterials: CardInstance[];
  equippedToUid?: string;
  equippedAtkDelta?: number;
  equippedDefDelta?: number;
  restrictions: ('CANNOT_ATTACK' | 'CANNOT_CHANGE_POS' | 'IMMUNE_DESTROY')[];
  turnPlaced: number;
}

export type DuelPhase = 'DRAW' | 'STANDBY' | 'MAIN1' | 'BATTLE' | 'MAIN2' | 'END';

export type SummonMethod =
  | 'NORMAL'
  | 'TRIBUTE'
  | 'SET'
  | 'SPECIAL'
  | 'FUSION'
  | 'SYNCHRO'
  | 'XYZ'
  | 'PENDULUM'
  | 'LINK'
  | 'RITUAL';

export interface ChainLink {
  linkNumber: number;
  sourceUid: string;
  cardId: string;
  controller: PlayerId;
  effect: CardEffectDef;
  targetUid?: string;
  negated: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  lp: number;
  maxLp: number;
  deck: CardInstance[];
  extraDeck: CardInstance[];
  hand: CardInstance[];
  monsters: (CardInstance | null)[];       // 5 zones
  spellsTraps: (CardInstance | null)[];    // 5 zones
  fieldZone: CardInstance | null;
  pendulumLeft: CardInstance | null;
  pendulumRight: CardInstance | null;
  graveyard: CardInstance[];
  banished: CardInstance[];
  normalSummonsRemaining: number;
  pendulumSummonedThisTurn: boolean;
}

export interface PendingInteraction {
  type: 'SELECT_TRIBUTES' | 'SELECT_MATERIALS' | 'SELECT_TARGET' | 'CHAIN_RESPONSE';
  actor: PlayerId;
  title: string;
  subtitle: string;
  minCount: number;
  maxCount: number;
  candidateUids: string[];
  summonCardUid?: string;
  summonMethod?: SummonMethod;
  effectSourceUid?: string;
  effectDef?: CardEffectDef;
  attackContext?: {
    attackerUid: string;
    targetUid?: string;
  };
}

export interface DuelLogEntry {
  id: string;
  turn: number;
  phase: DuelPhase;
  actor: PlayerId | 'system';
  message: string;
  type: 'info' | 'summon' | 'effect' | 'battle' | 'damage' | 'chain' | 'phase';
}

export interface DuelEventCue {
  id: string;
  kind: 'SUMMON' | 'BOSS_SUMMON' | 'ATTACK' | 'DAMAGE' | 'DESTROY' | 'EFFECT' | 'CHAIN_RESOLVE' | 'VICTORY' | 'DEFEAT';
  cardId?: string;
  sourceZone?: { owner: PlayerId; zone: ZoneLocation; index: number };
  targetZone?: { owner: PlayerId; zone: ZoneLocation; index: number };
  amount?: number;
  summonMethod?: SummonMethod;
  timestamp: number;
}

export interface DuelState {
  duelId: string;
  mode: GameMode;
  turnNumber: number;
  activePlayer: PlayerId;
  phase: DuelPhase;
  player: PlayerState;
  opponent: PlayerState;
  extraMonsterZones: (CardInstance | null)[]; // [0] = Left EMZ, [1] = Right EMZ
  chainStack: ChainLink[];
  pendingInteraction: PendingInteraction | null;
  winner: PlayerId | null;
  winReason: string | null;
  logs: DuelLogEntry[];
  recentCues: DuelEventCue[];
  stats: {
    turnsPlayed: number;
    playerDamageDealt: number;
    opponentDamageDealt: number;
    playerSummons: number;
    playerSpellsTraps: number;
    chainsResolved: number;
  };
  startingLP: number;
  startingHandSize: number;
  aiDifficulty: AIDifficulty;
  campaignStageId?: string;
  tutorialStep?: number;
}

export type AIDifficulty = 'EASY' | 'NORMAL' | 'EXPERT';

export type GameMode = 'PRACTICE' | 'VS_AI' | 'CAMPAIGN' | 'FREE';

export type ScreenView =
  | 'TITLE'
  | 'DUEL'
  | 'DECK_BUILDER'
  | 'LIBRARY'
  | 'CAMPAIGN'
  | 'FREE_MODE'
  | 'HISTORY'
  | 'SETTINGS';

export interface SavedDeck {
  id: string;
  name: string;
  mainDeckIds: string[];
  extraDeckIds: string[];
  updatedAt: number;
}

export interface CampaignStage {
  id: string;
  stageNumber: number;
  title: string;
  opponentName: string;
  opponentTitle: string;
  difficulty: AIDifficulty;
  deckName: string;
  opponentDeckIds: string[];
  opponentExtraIds: string[];
  rewardPoints: number;
  unlockCardId: string;
  description: string;
  accentColor: string;
}

export interface DuelHistoryRecord {
  id: string;
  date: number;
  mode: GameMode;
  opponentName: string;
  difficulty: AIDifficulty;
  result: 'WIN' | 'LOSS';
  turns: number;
  finalPlayerLP: number;
  finalOpponentLP: number;
  damageDealt: number;
  deckName: string;
}

export interface GameSettings {
  masterVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  cameraDynamics: boolean;
  autoChainPrompt: boolean;
  duelSpeed: 'NORMAL' | 'FAST';
}

export interface PlayerProfileSave {
  activeDeckId: string;
  decks: SavedDeck[];
  unlockedCardIds: Record<string, number>; // cardId -> owned copies (up to 3)
  customImportedCards?: CardDefinition[]; // User-imported YGOPRODeck cards
  completedStageIds: string[];
  duelPoints: number;
  history: DuelHistoryRecord[];
  settings: GameSettings;
}
