/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio/AudioManager';
import { AIController } from './engine/AIController';
import { DuelManager } from './engine/DuelManager';
import { GameManager } from './engine/GameManager';
import { SaveManager } from './engine/SaveManager';
import { DuelArena3D, ProjectedBadge, ZoneClickPayload } from './three/DuelArena3D';
import {
  AIDifficulty,
  DuelState,
  GameSettings,
  PlayerProfileSave,
  SavedDeck,
  ScreenView,
} from './types/tcg';
import { CampaignView } from './ui/CampaignView';
import { DeckBuilderView } from './ui/DeckBuilderView';
import { DuelView } from './ui/DuelView';
import { FreeDuelConfig, FreeModeView } from './ui/FreeModeView';
import { HistoryView } from './ui/HistoryView';
import { LibraryView } from './ui/LibraryView';
import { MainMenu } from './ui/MainMenu';
import { PauseModal, ResultModal, SettingsView } from './ui/ResultModal';

export default function App() {
  const [profile, setProfile] = useState<PlayerProfileSave>(() => SaveManager.load());
  const [screen, setScreen] = useState<ScreenView>('TITLE');
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('NORMAL');

  const [duel, setDuel] = useState<DuelState | null>(null);
  const [paused, setPaused] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [targetableUids, setTargetableUids] = useState<string[]>([]);
  const [projectedBadges, setProjectedBadges] = useState<ProjectedBadge[]>([]);
  const [duelReward, setDuelReward] = useState<{
    duelId: string;
    rewardPoints: number;
    unlockedCardId?: string;
  } | null>(null);

  const arenaHostRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<DuelArena3D | null>(null);
  const lastLauncherRef = useRef<((p: PlayerProfileSave) => DuelState) | null>(null);
  const playedCuesRef = useRef<Set<string>>(new Set());
  const finalizedDuelIdRef = useRef<string | null>(null);

  // Sync audio & 3D camera settings
  useEffect(() => {
    AudioManager.updateSettings(profile.settings);
    arenaRef.current?.setCameraDynamics(profile.settings.cameraDynamics);
  }, [profile.settings]);

  // Mount persistent 3D Duel Arena background
  useEffect(() => {
    const container = arenaHostRef.current;
    if (!container) return;

    let arena: DuelArena3D | null = null;
    try {
      arena = new DuelArena3D(
        container,
        (payload: ZoneClickPayload) => {
          if (payload.cardUid) {
            setSelectedUid((prev) => (prev === payload.cardUid ? null : payload.cardUid ?? null));
          } else {
            setSelectedUid(null);
          }
        },
        (badges: ProjectedBadge[]) => {
          setProjectedBadges(badges);
        }
      );
      arena.setCameraDynamics(profile.settings.cameraDynamics);
      arenaRef.current = arena;
    } catch {
      // Graceful fallback if WebGL is unavailable
      arenaRef.current = null;
    }

    return () => {
      arena?.dispose();
      arenaRef.current = null;
    };
  }, []);

  // Sync arena mode and duel state
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    arena.setMode(screen === 'DUEL' ? 'DUEL' : 'TITLE');
    arena.syncDuelState(screen === 'DUEL' ? duel : null, selectedUid, targetableUids);
  }, [screen, duel, selectedUid, targetableUids]);

  // Play SFX for new duel event cues
  useEffect(() => {
    if (!duel) return;
    for (const cue of duel.recentCues) {
      if (playedCuesRef.current.has(cue.id)) continue;
      playedCuesRef.current.add(cue.id);
      switch (cue.kind) {
        case 'BOSS_SUMMON':
          AudioManager.playSummon(true);
          break;
        case 'SUMMON':
          AudioManager.playSummon(false);
          break;
        case 'ATTACK':
        case 'DAMAGE':
        case 'DESTROY':
          AudioManager.playAttackImpact();
          break;
        case 'EFFECT':
        case 'CHAIN_RESOLVE':
          AudioManager.playEffectChain();
          break;
        default:
          break;
      }
    }
  }, [duel]);

  // Finalize duel result & persist once per finished duel
  useEffect(() => {
    if (!duel || !duel.winner) return;
    if (finalizedDuelIdRef.current === duel.duelId) return;
    finalizedDuelIdRef.current = duel.duelId;

    if (duel.winner === 'player') {
      AudioManager.playVictory();
    } else {
      AudioManager.playDefeat();
    }

    const { nextProfile, rewardPoints, unlockedCardId } = GameManager.finalizeDuelAndSave(
      profile,
      duel
    );
    setProfile(nextProfile);
    setDuelReward({ duelId: duel.duelId, rewardPoints, unlockedCardId });
  }, [duel, profile]);

  // AI turn loop
  useEffect(() => {
    if (screen !== 'DUEL' || !duel || paused || duel.winner) return;
    if (duel.activePlayer !== 'opponent' || duel.pendingInteraction) return;

    const delayMs = profile.settings.duelSpeed === 'FAST' ? 320 : 720;
    const timer = window.setTimeout(() => {
      setDuel((current) => {
        if (!current || current.winner || current.activePlayer !== 'opponent' || current.pendingInteraction) {
          return current;
        }
        const action = AIController.computeNextAction(current);
        if (!action) return current;
        return action.apply(current);
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [screen, duel, paused, profile.settings.duelSpeed]);

  // Escape key toggles Pause during Duel
  useEffect(() => {
    if (screen !== 'DUEL') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && duel && !duel.winner) {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, duel]);

  const launchDuel = useCallback(
    (launcher: (p: PlayerProfileSave) => DuelState) => {
      AudioManager.startAmbientMusic();
      lastLauncherRef.current = launcher;
      playedCuesRef.current.clear();
      finalizedDuelIdRef.current = null;
      setDuelReward(null);
      setPaused(false);
      setSelectedUid(null);
      setTargetableUids([]);
      setProjectedBadges([]);
      setDuel(launcher(profile));
      setScreen('DUEL');
    },
    [profile]
  );

  const handleStartQuickDuel = useCallback(() => {
    launchDuel((p) => GameManager.startQuickDuel(p, selectedDifficulty));
  }, [launchDuel, selectedDifficulty]);

  const handleStartPractice = useCallback(() => {
    launchDuel((p) => GameManager.startPracticeDuel(p));
  }, [launchDuel]);

  const handleStartCampaignStage = useCallback(
    (stageId: string) => {
      launchDuel((p) => GameManager.startCampaignDuel(p, stageId));
    },
    [launchDuel]
  );

  const handleStartFreeDuel = useCallback(
    (config: FreeDuelConfig) => {
      launchDuel((p) => GameManager.startFreeDuel(p, config));
    },
    [launchDuel]
  );

  const handleRematch = useCallback(() => {
    if (lastLauncherRef.current) {
      launchDuel(lastLauncherRef.current);
    }
  }, [launchDuel]);

  const handleReturnMenu = useCallback(() => {
    setPaused(false);
    setSelectedUid(null);
    setTargetableUids([]);
    setProjectedBadges([]);
    setDuel(null);
    setDuelReward(null);
    setScreen('TITLE');
  }, []);

  const handleUpdateSettings = useCallback((nextSettings: GameSettings) => {
    setProfile((prev) => {
      const next = { ...prev, settings: nextSettings };
      SaveManager.save(next);
      return next;
    });
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = SaveManager.resetSave();
    setProfile(fresh);
  }, []);

  const handleSaveDeck = useCallback((deck: SavedDeck) => {
    setProfile((prev) => SaveManager.upsertDeck(prev, deck));
  }, []);

  const handleSetActiveDeck = useCallback((deckId: string) => {
    setProfile((prev) => {
      const next = { ...prev, activeDeckId: deckId };
      SaveManager.save(next);
      return next;
    });
  }, []);

  const handleDeleteDeck = useCallback((deckId: string) => {
    setProfile((prev) => SaveManager.deleteDeck(prev, deckId));
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100">
      {/* Persistent 3D WebGL Arena Background */}
      <div ref={arenaHostRef} className="fixed inset-0 z-0" />

      {screen === 'TITLE' && (
        <MainMenu
          profile={profile}
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          onStartQuickDuel={handleStartQuickDuel}
          onStartPractice={handleStartPractice}
          onNavigate={setScreen}
        />
      )}

      {screen === 'DUEL' && duel && (
        <>
          <DuelView
            duel={duel}
            projectedBadges={projectedBadges}
            selectedUid={selectedUid}
            onSelectUid={setSelectedUid}
            onUpdateDuel={setDuel}
            onSetTargetableUids={setTargetableUids}
            onOpenPause={() => setPaused(true)}
          />

          {paused && !duel.winner && (
            <PauseModal
              onResume={() => setPaused(false)}
              onRestart={handleRematch}
              onSurrender={() => {
                setPaused(false);
                setDuel((curr) => (curr ? DuelManager.surrender(curr, 'player') : curr));
              }}
              onReturnMenu={handleReturnMenu}
            />
          )}

          {duel.winner && (
            <ResultModal
              duel={duel}
              rewardPoints={
                duelReward?.duelId === duel.duelId ? duelReward.rewardPoints : 0
              }
              unlockedCardId={
                duelReward?.duelId === duel.duelId ? duelReward.unlockedCardId : undefined
              }
              onRematch={handleRematch}
              onReturnMenu={handleReturnMenu}
            />
          )}
        </>
      )}

      {screen === 'CAMPAIGN' && (
        <CampaignView
          profile={profile}
          onStartStage={handleStartCampaignStage}
          onClose={() => setScreen('TITLE')}
        />
      )}

      {screen === 'DECK_BUILDER' && (
        <DeckBuilderView
          profile={profile}
          onSaveDeck={handleSaveDeck}
          onSetActiveDeck={handleSetActiveDeck}
          onDeleteDeck={handleDeleteDeck}
          onClose={() => setScreen('TITLE')}
        />
      )}

      {screen === 'LIBRARY' && (
        <LibraryView profile={profile} onClose={() => setScreen('TITLE')} />
      )}

      {screen === 'FREE_MODE' && (
        <FreeModeView
          onStartFreeDuel={handleStartFreeDuel}
          onClose={() => setScreen('TITLE')}
        />
      )}

      {screen === 'HISTORY' && (
        <HistoryView profile={profile} onClose={() => setScreen('TITLE')} />
      )}

      {screen === 'SETTINGS' && (
        <SettingsView
          settings={profile.settings}
          onUpdate={handleUpdateSettings}
          onResetSave={handleResetSave}
          onClose={() => setScreen('TITLE')}
        />
      )}
    </div>
  );
}
