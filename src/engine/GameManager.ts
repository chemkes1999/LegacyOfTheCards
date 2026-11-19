import { CAMPAIGN_STAGES, CHAOS_STARTER_MAIN, PRACTICE_TUTORIAL_DECK, STARTER_EXTRA_DECK } from '../data/decks';
import {
  AIDifficulty,
  DuelHistoryRecord,
  DuelState,
  GameMode,
  PlayerProfileSave,
  SavedDeck,
} from '../types/tcg';
import { DuelInitConfig, DuelManager } from './DuelManager';
import { SaveManager } from './SaveManager';

/**
 * Online Multiplayer Architecture Adapter Interface
 * Prepared for future WebSocket / WebRTC PvP duel synchronization without refactoring DuelManager.
 */
export interface NetworkDuelAdapter {
  readonly isConnected: boolean;
  connect(roomCode: string): Promise<void>;
  sendAction(actionPayload: { type: string; data: unknown }): void;
  onRemoteAction(handler: (actionPayload: { type: string; data: unknown }) => void): void;
  disconnect(): void;
}

export class LocalDuelAdapter implements NetworkDuelAdapter {
  readonly isConnected = false;
  async connect(): Promise<void> {}
  sendAction(): void {}
  onRemoteAction(): void {}
  disconnect(): void {}
}

export class GameManager {
  static getActiveDeck(profile: PlayerProfileSave): SavedDeck {
    return profile.decks.find((d) => d.id === profile.activeDeckId) ?? profile.decks[0];
  }

  static startQuickDuel(profile: PlayerProfileSave, difficulty: AIDifficulty = 'NORMAL'): DuelState {
    const playerDeck = this.getActiveDeck(profile);
    const diffNames: Record<AIDifficulty, string> = {
      EASY: 'Aprendiz Vex (Fácil)',
      NORMAL: 'Estratega Kaito (Normal)',
      EXPERT: 'Maestro Obsidiana (Experto)',
    };

    const config: DuelInitConfig = {
      mode: 'VS_AI',
      playerName: 'Duelista',
      opponentName: diffNames[difficulty],
      playerDeckIds: playerDeck.mainDeckIds,
      playerExtraIds: playerDeck.extraDeckIds,
      opponentDeckIds: CHAOS_STARTER_MAIN,
      opponentExtraIds: STARTER_EXTRA_DECK,
      startingLP: 8000,
      startingHandSize: 5,
      aiDifficulty: difficulty,
    };
    return DuelManager.createDuel(config);
  }

  static startPracticeDuel(profile: PlayerProfileSave): DuelState {
    const playerDeck = this.getActiveDeck(profile);
    return DuelManager.createDuel({
      mode: 'PRACTICE',
      playerName: 'Aprendiz',
      opponentName: 'Simulador de Entrenamiento',
      playerDeckIds: playerDeck.mainDeckIds,
      playerExtraIds: playerDeck.extraDeckIds,
      opponentDeckIds: PRACTICE_TUTORIAL_DECK,
      opponentExtraIds: ['m_xyz_leviathan', 'm_link_valkyrie'],
      startingLP: 4000,
      startingHandSize: 5,
      aiDifficulty: 'EASY',
    });
  }

  static startCampaignDuel(profile: PlayerProfileSave, stageId: string): DuelState {
    const stage = CAMPAIGN_STAGES.find((s) => s.id === stageId) ?? CAMPAIGN_STAGES[0];
    const playerDeck = this.getActiveDeck(profile);
    return DuelManager.createDuel({
      mode: 'CAMPAIGN',
      playerName: 'Duelista',
      opponentName: stage.opponentName,
      playerDeckIds: playerDeck.mainDeckIds,
      playerExtraIds: playerDeck.extraDeckIds,
      opponentDeckIds: stage.opponentDeckIds,
      opponentExtraIds: stage.opponentExtraIds,
      startingLP: 8000,
      startingHandSize: 5,
      aiDifficulty: stage.difficulty,
      campaignStageId: stage.id,
    });
  }

  static startFreeDuel(
    profile: PlayerProfileSave,
    options: {
      startingLP: number;
      startingHandSize: number;
      difficulty: AIDifficulty;
      opponentDeckIds: string[];
      opponentExtraIds: string[];
      opponentName: string;
    }
  ): DuelState {
    const playerDeck = this.getActiveDeck(profile);
    return DuelManager.createDuel({
      mode: 'FREE',
      playerName: 'Duelista',
      opponentName: options.opponentName,
      playerDeckIds: playerDeck.mainDeckIds,
      playerExtraIds: playerDeck.extraDeckIds,
      opponentDeckIds: options.opponentDeckIds,
      opponentExtraIds: options.opponentExtraIds,
      startingLP: options.startingLP,
      startingHandSize: options.startingHandSize,
      aiDifficulty: options.difficulty,
    });
  }

  static finalizeDuelAndSave(
    profile: PlayerProfileSave,
    duel: DuelState
  ): { nextProfile: PlayerProfileSave; rewardPoints: number; unlockedCardId?: string } {
    const isWin = duel.winner === 'player';
    const deck = this.getActiveDeck(profile);
    let rewardPoints = isWin ? 150 : 40;
    let unlockedCardId: string | undefined;
    let completedStageId: string | undefined;

    if (duel.mode === 'CAMPAIGN' && duel.campaignStageId && isWin) {
      const stage = CAMPAIGN_STAGES.find((s) => s.id === duel.campaignStageId);
      if (stage) {
        rewardPoints = stage.rewardPoints;
        completedStageId = stage.id;
        unlockedCardId = stage.unlockCardId;
      }
    } else if (isWin && duel.aiDifficulty === 'EXPERT') {
      rewardPoints = 350;
    } else if (isWin && duel.aiDifficulty === 'NORMAL') {
      rewardPoints = 220;
    }

    const record: DuelHistoryRecord = {
      id: duel.duelId,
      date: Date.now(),
      mode: duel.mode,
      opponentName: duel.opponent.name,
      difficulty: duel.aiDifficulty,
      result: isWin ? 'WIN' : 'LOSS',
      turns: duel.turnNumber,
      finalPlayerLP: duel.player.lp,
      finalOpponentLP: duel.opponent.lp,
      damageDealt: duel.stats.playerDamageDealt,
      deckName: deck.name,
    };

    const nextProfile = SaveManager.recordDuelResult(
      profile,
      record,
      rewardPoints,
      completedStageId,
      unlockedCardId
    );
    return { nextProfile, rewardPoints, unlockedCardId };
  }

  static getModeLabel(mode: GameMode): string {
    switch (mode) {
      case 'PRACTICE':
        return 'Modo Práctica';
      case 'VS_AI':
        return 'Duelo vs IA';
      case 'CAMPAIGN':
        return 'Campaña';
      case 'FREE':
        return 'Modo Libre';
    }
  }
}
