import { CardEffectDef, Rarity } from '../types/tcg';

export interface CuratedYgoCardSpec {
  ygoprodeckId: number;
  internalId: string;
  nameEs: string;
  descriptionEs: string;
  rarity: Rarity;
  effects: CardEffectDef[];
}

/**
 * Curated set of classic Yu-Gi-Oh! cards synchronized from YGOPRODeck API v7
 * and mapped to executable EffectManager operations.
 */
export const CURATED_YGO_MANIFEST: CuratedYgoCardSpec[] = [
  // ==================== MONSTRUOS NORMALES ====================
  {
    ygoprodeckId: 89631139,
    internalId: 'ygo_blue_eyes',
    nameEs: 'Dragón Blanco de Ojos Azules',
    descriptionEs:
      'Este legendario dragón es una poderosa máquina de destrucción. Prácticamente invencible, muy pocos se han enfrentado a esta impresionante criatura y vivido para contarlo.',
    rarity: 'UR',
    effects: [],
  },
  {
    ygoprodeckId: 46986414,
    internalId: 'ygo_dark_magician',
    nameEs: 'Mago Oscuro',
    descriptionEs: 'El más grande de los magos en cuanto al ataque y la defensa.',
    rarity: 'UR',
    effects: [],
  },
  {
    ygoprodeckId: 74677422,
    internalId: 'ygo_red_eyes',
    nameEs: 'Dragón Negro de Ojos Rojos',
    descriptionEs: 'Un dragón feroz con un ataque mortal.',
    rarity: 'UR',
    effects: [],
  },
  {
    ygoprodeckId: 70781052,
    internalId: 'ygo_summoned_skull',
    nameEs: 'Cráneo Convocado',
    descriptionEs: 'Un demonio con poderes oscuros para confundir a los enemigos. Entre los monstruos de tipo Demonio, es uno de los más fuertes.',
    rarity: 'SR',
    effects: [],
  },
  {
    ygoprodeckId: 91152256,
    internalId: 'ygo_celtic_guardian',
    nameEs: 'Guardián Celta',
    descriptionEs: 'Un elfo que aprendió a esgrimir una espada, desconcierta a los enemigos con ataques relámpago.',
    rarity: 'R',
    effects: [],
  },
  {
    ygoprodeckId: 15025844,
    internalId: 'ygo_mystical_elf',
    nameEs: 'Elfa Mística',
    descriptionEs: 'Una elfa delicada que carece de ofensiva, pero tiene una defensa formidable respaldada por poderes místicos.',
    rarity: 'R',
    effects: [],
  },
  {
    ygoprodeckId: 58192742,
    internalId: 'ygo_la_jinn',
    nameEs: 'La Jinn el Genio Místico de la Lámpara',
    descriptionEs: 'Un genio de la lámpara que está a entera disposición de su amo.',
    rarity: 'R',
    effects: [],
  },
  {
    ygoprodeckId: 66672569,
    internalId: 'ygo_vorse_raider',
    nameEs: 'Saqueador Vorse',
    descriptionEs: 'Este perverso Guerrero-Bestia hace todo tipo de maldades con su hacha. ¡Cuidado con su golpe feroz!',
    rarity: 'SR',
    effects: [],
  },
  {
    ygoprodeckId: 4031928,
    internalId: 'ygo_gemini_elf',
    nameEs: 'Elfas Géminis',
    descriptionEs: 'Dos hermanas elfas que alternan sus ataques con perfecta sincronía.',
    rarity: 'SR',
    effects: [],
  },
  {
    ygoprodeckId: 74191942,
    internalId: 'ygo_lustre_dragon',
    nameEs: 'Dragón Brillante',
    descriptionEs: 'Un hermoso dragón cubierto de zafiros que ataca con gran velocidad.',
    rarity: 'R',
    effects: [],
  },

  // ==================== MONSTRUOS DE EFECTO ====================
  {
    ygoprodeckId: 38033121,
    internalId: 'ygo_dark_magician_girl',
    nameEs: 'Chica Maga Oscura',
    descriptionEs: 'Una vez por turno: puedes activar este efecto para aumentar su ATK en +300 e infligir 300 de daño al rival.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_dmg_boost',
        label: 'Magia Oscura (+300 ATK / 300 daño)',
        description: 'Gana +300 ATK e inflige 300 de daño al oponente.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_MONSTER',
        oncePerTurn: true,
        operations: [
          { type: 'MODIFY_STATS', atkDelta: 300, defDelta: 0 },
          { type: 'DAMAGE_OPPONENT', value: 300 },
        ],
      },
    ],
  },
  {
    ygoprodeckId: 78193831,
    internalId: 'ygo_buster_blader',
    nameEs: 'Buster Blader',
    descriptionEs: 'Una vez por turno: fortalece su espada ganando +500 ATK.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_buster_boost',
        label: 'Filo Matadragones (+500 ATK)',
        description: 'Aumenta el ATK de un monstruo propio en +500.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_MONSTER',
        oncePerTurn: true,
        operations: [{ type: 'MODIFY_STATS', atkDelta: 500, defDelta: 0 }],
      },
    ],
  },
  {
    ygoprodeckId: 54652250,
    internalId: 'ygo_man_eater_bug',
    nameEs: 'Insecto Come-Hombres',
    descriptionEs: 'Una vez por turno: selecciona 1 monstruo del oponente y destrúyelo.',
    rarity: 'R',
    effects: [
      {
        id: 'eff_ygo_meb_destroy',
        label: 'Destruir Monstruo Rival',
        description: 'Destruye 1 monstruo que controle el oponente.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OPPONENT_MONSTER',
        oncePerTurn: true,
        operations: [{ type: 'DESTROY_TARGET' }],
      },
    ],
  },
  {
    ygoprodeckId: 31560081,
    internalId: 'ygo_magician_of_faith',
    nameEs: 'Mago de la Fe',
    descriptionEs: 'Una vez por turno: añade 1 Carta Mágica de tu Deck a tu mano.',
    rarity: 'R',
    effects: [
      {
        id: 'eff_ygo_mof_search',
        label: 'Recuperar Mágica',
        description: 'Añade 1 Carta Mágica de tu Deck a tu mano.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        oncePerTurn: true,
        operations: [{ type: 'SEARCH_TO_HAND', filterCategory: 'SPELL' }],
      },
    ],
  },
  {
    ygoprodeckId: 63977008,
    internalId: 'ygo_junk_synchron',
    nameEs: 'Sincronizador de Basura',
    descriptionEs: 'Cantante. Una vez por turno: Invoca de Modo Especial 1 monstruo desde tu Cementerio.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_junk_revive',
        label: 'Revivir del Cementerio',
        description: 'Invoca Especialmente 1 monstruo desde tu Cementerio.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_GY_MONSTER',
        oncePerTurn: true,
        operations: [{ type: 'SPECIAL_SUMMON_FROM_GY' }],
      },
    ],
  },
  {
    ygoprodeckId: 40640057,
    internalId: 'ygo_kuriboh',
    nameEs: 'Kuriboh',
    descriptionEs: 'Una vez por turno: recupera 800 LP para protegerte.',
    rarity: 'R',
    effects: [
      {
        id: 'eff_ygo_kuriboh_heal',
        label: 'Escudo Kuriboh (+800 LP)',
        description: 'Recupera 800 Puntos de Vida.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        oncePerTurn: true,
        operations: [{ type: 'HEAL_SELF', value: 800 }],
      },
    ],
  },

  // ==================== DECK EXTRA ====================
  {
    ygoprodeckId: 23995346,
    internalId: 'ygo_blue_eyes_ultimate',
    nameEs: 'Dragón de Ojos Azules Definitivo',
    descriptionEs: 'Fusión de monstruos legendarios. Su poder de 4500 ATK arrasa el campo.',
    rarity: 'UR',
    effects: [],
  },
  {
    ygoprodeckId: 98502113,
    internalId: 'ygo_dark_paladin',
    nameEs: 'Paladín Oscuro',
    descriptionEs: 'Fusión. Una vez por turno: destruye 1 Mágica o Trampa rival e inflige 500 de daño.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_dark_paladin',
        label: 'Sello Arcano',
        description: 'Destruye 1 Mágica/Trampa rival e inflige 500 de daño.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OPPONENT_SPELL_TRAP',
        oncePerTurn: true,
        operations: [
          { type: 'DESTROY_TARGET' },
          { type: 'DAMAGE_OPPONENT', value: 500 },
        ],
      },
    ],
  },
  {
    ygoprodeckId: 44508094,
    internalId: 'ygo_stardust_dragon',
    nameEs: 'Dragón de Polvo de Estrellas',
    descriptionEs: 'Sincronía Nivel 8. Una vez por turno: otorga inmunidad a destrucción a un monstruo propio.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_stardust',
        label: 'Escudo Estelar',
        description: 'Hace inmune a destrucción a 1 monstruo propio.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_MONSTER',
        oncePerTurn: true,
        operations: [{ type: 'APPLY_RESTRICTION', restriction: 'IMMUNE_DESTROY' }],
      },
    ],
  },
  {
    ygoprodeckId: 84013237,
    internalId: 'ygo_utopia',
    nameEs: 'Número 39: Utopía',
    descriptionEs: 'Xyz Rango 4. Desacopla 1 Material Xyz para ganar +500 ATK.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_utopia_boost',
        label: 'Espada de la Esperanza (+500 ATK)',
        description: 'Desacopla 1 Material Xyz y gana +500 ATK.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        oncePerTurn: true,
        requiresXyzMaterial: 1,
        operations: [{ type: 'DETACH_XYZ_BOOST', atkDelta: 500 }],
      },
    ],
  },
  {
    ygoprodeckId: 1861629,
    internalId: 'ygo_decode_talker',
    nameEs: 'Decodificador Hablador',
    descriptionEs: 'Enlace-3. Una vez por turno: gana +500 ATK.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_decode_boost',
        label: 'Sobrecarga de Enlace (+500 ATK)',
        description: 'Aumenta en +500 el ATK de un monstruo propio.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_MONSTER',
        oncePerTurn: true,
        operations: [{ type: 'MODIFY_STATS', atkDelta: 500, defDelta: 0 }],
      },
    ],
  },

  // ==================== MÁGICAS ====================
  {
    ygoprodeckId: 55144522,
    internalId: 'ygo_pot_of_greed',
    nameEs: 'Olla de la Codicia',
    descriptionEs: 'Roba 2 cartas de tu Deck.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_pot',
        label: 'Robar 2 cartas',
        description: 'Roba 2 cartas de tu Deck.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        operations: [{ type: 'DRAW', value: 2 }],
      },
    ],
  },
  {
    ygoprodeckId: 12580477,
    internalId: 'ygo_raigeki',
    nameEs: 'Raigeki',
    descriptionEs: 'Destruye todos los monstruos que controle tu adversario.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_raigeki',
        label: 'Destruir Monstruos Rivales',
        description: 'Destruye todos los monstruos del oponente.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        condition: { minOpponentMonsters: 1 },
        operations: [{ type: 'DESTROY_ALL_OPPONENT_MONSTERS' }],
      },
    ],
  },
  {
    ygoprodeckId: 83764718,
    internalId: 'ygo_monster_reborn',
    nameEs: 'Monstruo Renacido',
    descriptionEs: 'Selecciona 1 monstruo en tu Cementerio e Invócalo de Modo Especial.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_reborn',
        label: 'Revivir Monstruo',
        description: 'Invoca de Modo Especial 1 monstruo de tu Cementerio.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_GY_MONSTER',
        operations: [{ type: 'SPECIAL_SUMMON_FROM_GY' }],
      },
    ],
  },
  {
    ygoprodeckId: 24094653,
    internalId: 'ygo_polymerization',
    nameEs: 'Polimerización',
    descriptionEs: 'Invoca por Fusión 1 Monstruo de Fusión de tu Deck Extra usando 2 monstruos de tu mano o campo.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_poly',
        label: 'Invocación por Fusión',
        description: 'Fusiona 2 monstruos en 1 Monstruo de Fusión del Deck Extra.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        operations: [{ type: 'FUSION_SUMMON' }],
      },
    ],
  },
  {
    ygoprodeckId: 5318639,
    internalId: 'ygo_mst',
    nameEs: 'Tifón del Espacio Místico',
    descriptionEs: 'Mágica de Juego Rápido. Destruye 1 Carta Mágica o de Trampa del oponente.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_mst',
        label: 'Destruir Mágica/Trampa',
        description: 'Destruye 1 Carta Mágica o de Trampa rival.',
        trigger: 'QUICK',
        spellSpeed: 2,
        targetRequirement: 'OPPONENT_SPELL_TRAP',
        operations: [{ type: 'DESTROY_TARGET' }],
      },
    ],
  },
  {
    ygoprodeckId: 18144506,
    internalId: 'ygo_feather_duster',
    nameEs: 'Plumero de la Arpía',
    descriptionEs: 'Destruye todas las Cartas Mágicas y de Trampa que controle tu adversario.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_duster',
        label: 'Limpiar Mágicas/Trampas',
        description: 'Destruye todas las Mágicas, Trampas y Péndulos rivales.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'NONE',
        operations: [{ type: 'DESTROY_ALL_SPELLS_TRAPS' }],
      },
    ],
  },
  {
    ygoprodeckId: 40619825,
    internalId: 'ygo_axe_of_despair',
    nameEs: 'Hacha de Desesperación',
    descriptionEs: 'Mágica de Equipo. El monstruo equipado gana +1000 ATK.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_axe',
        label: 'Equipar (+1000 ATK)',
        description: 'El monstruo objetivo gana +1000 ATK.',
        trigger: 'IGNITION',
        spellSpeed: 1,
        targetRequirement: 'OWN_MONSTER',
        operations: [{ type: 'MODIFY_STATS', atkDelta: 1000, defDelta: 0 }],
      },
    ],
  },

  // ==================== TRAMPAS ====================
  {
    ygoprodeckId: 44095762,
    internalId: 'ygo_mirror_force',
    nameEs: 'Fuerza de Espejo',
    descriptionEs: 'Cuando un monstruo del adversario declara un ataque: destruye todos los monstruos del adversario.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_mirror',
        label: 'Reflejar Ataque',
        description: 'Niega el ataque y destruye los monstruos rivales.',
        trigger: 'ON_ATTACK_DECLARE',
        spellSpeed: 2,
        targetRequirement: 'NONE',
        operations: [{ type: 'NEGATE_ATTACK' }, { type: 'DESTROY_ALL_OPPONENT_MONSTERS' }],
      },
    ],
  },
  {
    ygoprodeckId: 62279055,
    internalId: 'ygo_magic_cylinder',
    nameEs: 'Cilindro Mágico',
    descriptionEs: 'Cuando un monstruo del adversario declara un ataque: niega el ataque e inflige 1500 de daño.',
    rarity: 'SR',
    effects: [
      {
        id: 'eff_ygo_cylinder',
        label: 'Devolver Daño',
        description: 'Niega el ataque e inflige 1500 de daño al adversario.',
        trigger: 'ON_ATTACK_DECLARE',
        spellSpeed: 2,
        targetRequirement: 'NONE',
        operations: [{ type: 'NEGATE_ATTACK' }, { type: 'DAMAGE_OPPONENT', value: 1500 }],
      },
    ],
  },
  {
    ygoprodeckId: 41420027,
    internalId: 'ygo_solemn_judgment',
    nameEs: 'Juicio Solemne',
    descriptionEs: 'Trampa de Contraefecto. Paga 1000 LP para negar la activación de la carta anterior en la Cadena.',
    rarity: 'UR',
    effects: [
      {
        id: 'eff_ygo_solemn',
        label: 'Negar Activación (-1000 LP)',
        description: 'Niega el eslabón anterior de la Cadena.',
        trigger: 'COUNTER',
        spellSpeed: 3,
        targetRequirement: 'PREVIOUS_CHAIN_LINK',
        condition: { minLP: 1001, lpCost: 1000 },
        operations: [{ type: 'NEGATE_CHAIN_LINK' }],
      },
    ],
  },
];
