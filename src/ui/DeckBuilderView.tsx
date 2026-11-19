import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Layers,
  Minus,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { BALANCED_STARTER_MAIN, STARTER_EXTRA_DECK } from '../data/decks';
import { CardManager } from '../engine/CardManager';
import {
  DeckManager,
  EXTRA_DECK_MAX,
  MAIN_DECK_MAX,
  MAIN_DECK_MIN,
  MAX_COPIES_PER_CARD,
} from '../engine/DeckManager';
import { CardCategory, PlayerProfileSave, SavedDeck } from '../types/tcg';
import { CardArtRenderer } from './CardArtRenderer';

interface DeckBuilderViewProps {
  profile: PlayerProfileSave;
  catalogVersion: number;
  onSaveDeck: (deck: SavedDeck) => void;
  onSetActiveDeck: (deckId: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onClose: () => void;
}

const DECK_CATALOG_PAGE_SIZE = 40;

export const DeckBuilderView: React.FC<DeckBuilderViewProps> = ({
  profile,
  catalogVersion,
  onSaveDeck,
  onSetActiveDeck,
  onDeleteDeck,
  onClose,
}) => {
  const initialDeck =
    profile.decks.find((d) => d.id === profile.activeDeckId) ?? profile.decks[0];

  const [editingDeck, setEditingDeck] = useState<SavedDeck>(() => ({
    ...initialDeck,
    mainDeckIds: [...initialDeck.mainDeckIds],
    extraDeckIds: [...initialDeck.extraDeckIds],
  }));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | CardCategory>('ALL');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const validation = useMemo(() => DeckManager.validateDeck(editingDeck), [editingDeck]);
  const stats = useMemo(() => DeckManager.computeStats(editingDeck), [editingDeck]);

  const allCards = useMemo(
    () => CardManager.getAll(),
    [profile.customImportedCards, catalogVersion]
  );

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter((c) => {
      if (category !== 'ALL' && c.category !== category) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allCards, query, category]);

  useEffect(() => {
    setPage(0);
  }, [query, category, catalogVersion]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalog.length / DECK_CATALOG_PAGE_SIZE));
  const pagedCatalog = useMemo(() => {
    const start = page * DECK_CATALOG_PAGE_SIZE;
    return filteredCatalog.slice(start, start + DECK_CATALOG_PAGE_SIZE);
  }, [filteredCatalog, page]);

  const groupedMain = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of editingDeck.mainDeckIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([id, count]) => ({
      def: CardManager.getDef(id),
      count,
    }));
  }, [editingDeck.mainDeckIds]);

  const groupedExtra = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of editingDeck.extraDeckIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([id, count]) => ({
      def: CardManager.getDef(id),
      count,
    }));
  }, [editingDeck.extraDeckIds]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 2400);
  };

  const handleSelectDeck = (deckId: string) => {
    const found = profile.decks.find((d) => d.id === deckId);
    if (!found) return;
    setEditingDeck({
      ...found,
      mainDeckIds: [...found.mainDeckIds],
      extraDeckIds: [...found.extraDeckIds],
    });
  };

  const handleAddCard = (cardId: string) => {
    const res = DeckManager.addCardToDeck(editingDeck, cardId);
    if (res.error) {
      showTempNotice(res.error);
      return;
    }
    setEditingDeck(res.deck);
  };

  const handleRemoveCard = (cardId: string) => {
    setEditingDeck((prev) => DeckManager.removeCardFromDeck(prev, cardId));
  };

  const handleCreateNewDeck = () => {
    const newDeck: SavedDeck = {
      id: `deck_${Date.now()}`,
      name: `Mazo Personalizado ${profile.decks.length + 1}`,
      mainDeckIds: [...BALANCED_STARTER_MAIN],
      extraDeckIds: [...STARTER_EXTRA_DECK],
      updatedAt: Date.now(),
    };
    onSaveDeck(newDeck);
    setEditingDeck(newDeck);
    showTempNotice('Nuevo mazo creado.');
  };

  const handleSave = () => {
    if (!validation.valid) {
      showTempNotice(validation.errors[0]);
      return;
    }
    onSaveDeck({ ...editingDeck, updatedAt: Date.now() });
    showTempNotice('Mazo guardado correctamente.');
  };

  const handleActivate = () => {
    if (!validation.valid) {
      showTempNotice('Corrige los errores del mazo antes de activarlo.');
      return;
    }
    onSaveDeck({ ...editingDeck, updatedAt: Date.now() });
    onSetActiveDeck(editingDeck.id);
    showTempNotice(`"${editingDeck.name}" establecido como mazo activo.`);
  };

  const handleDelete = () => {
    if (profile.decks.length <= 1) {
      showTempNotice('Debes conservar al menos 1 mazo.');
      return;
    }
    const remaining = profile.decks.find((d) => d.id !== editingDeck.id);
    onDeleteDeck(editingDeck.id);
    if (remaining) {
      setEditingDeck({
        ...remaining,
        mainDeckIds: [...remaining.mainDeckIds],
        extraDeckIds: [...remaining.extraDeckIds],
      });
    }
    showTempNotice('Mazo eliminado.');
  };

  const isActive = profile.activeDeckId === editingDeck.id;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#070a12]/95 p-4 sm:p-6 overflow-hidden">
      {/* Top Bar */}
      <div className="mx-auto w-full max-w-7xl flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">Constructor de Mazos</h2>
            <p className="text-xs text-slate-400">
              Principal: {MAIN_DECK_MIN}–{MAIN_DECK_MAX} cartas · Extra: hasta {EXTRA_DECK_MAX} · Máx. {MAX_COPIES_PER_CARD} copias
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar mazo"
            value={editingDeck.id}
            onChange={(e) => handleSelectDeck(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            {profile.decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.id === profile.activeDeckId ? '★' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNewDeck}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 cursor-pointer"
          >
            <CopyPlus className="h-3.5 w-3.5" />
            <span>Nuevo</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="mx-auto mt-2 w-full max-w-7xl rounded-lg border border-amber-500/50 bg-amber-950/60 px-3 py-1.5 text-xs text-amber-200 shrink-0">
          {notice}
        </div>
      )}

      {/* Main Split */}
      <div className="mx-auto mt-4 w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 min-h-0">
        {/* Left: Catalog */}
        <div className="flex flex-col min-h-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar carta para añadir..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
              {(
                [
                  { id: 'ALL', label: 'Todas' },
                  { id: 'MONSTER', label: 'Monstruos' },
                  { id: 'SPELL', label: 'Mágicas' },
                  { id: 'TRAP', label: 'Trampas' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    category === cat.id ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
              {pagedCatalog.map((card) => {
                const inDeck = DeckManager.getCopyCount(editingDeck, card.id);
                const maxed = inDeck >= MAX_COPIES_PER_CARD;
                return (
                  <div
                    key={card.id}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-950/70 p-2"
                  >
                    <CardArtRenderer
                      card={card}
                      size="sm"
                      showRarity
                      disabled={maxed}
                      onClick={() => handleAddCard(card.id)}
                    />
                    <div className="flex items-center justify-between w-full px-1 text-[11px] font-mono-num">
                      <span className={inDeck > 0 ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                        {inDeck}/{MAX_COPIES_PER_CARD}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(card.id)}
                          disabled={inDeck === 0}
                          aria-label={`Quitar ${card.name}`}
                          className="rounded bg-slate-800 p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddCard(card.id)}
                          disabled={maxed}
                          aria-label={`Añadir ${card.name}`}
                          className="rounded bg-amber-500 p-1 text-slate-950 hover:bg-amber-400 disabled:opacity-35 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs shrink-0">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 px-3 py-1.5 text-slate-100 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>
              <span className="font-mono-num text-slate-400">
                Página {page + 1} de {totalPages} ({filteredCatalog.length.toLocaleString()} cartas)
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 px-3 py-1.5 text-slate-100 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Deck Editor & Validation */}
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-4 min-h-0 space-y-3">
          <div className="space-y-2 shrink-0">
            <input
              type="text"
              aria-label="Nombre del mazo"
              value={editingDeck.name}
              onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
            />

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-1.5 text-center font-mono-num text-[11px]">
              <div className="rounded bg-slate-900 p-1.5 border border-slate-800">
                <div className="text-slate-400">Main</div>
                <div className={stats.mainCount >= MAIN_DECK_MIN && stats.mainCount <= MAIN_DECK_MAX ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {stats.mainCount}
                </div>
              </div>
              <div className="rounded bg-slate-900 p-1.5 border border-slate-800">
                <div className="text-slate-400">Extra</div>
                <div className="text-purple-300 font-bold">{stats.extraCount}/{EXTRA_DECK_MAX}</div>
              </div>
              <div className="rounded bg-slate-900 p-1.5 border border-slate-800">
                <div className="text-slate-400">M / Mag / Tr</div>
                <div className="text-white font-bold">
                  {stats.monsters}/{stats.spells}/{stats.traps}
                </div>
              </div>
              <div className="rounded bg-slate-900 p-1.5 border border-slate-800">
                <div className="text-slate-400">ATK Med</div>
                <div className="text-amber-300 font-bold">{stats.avgAtk}</div>
              </div>
            </div>

            {/* Validation status */}
            <div
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                validation.valid
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
              }`}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Mazo válido y listo para duelos.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{validation.errors[0]}</span>
                </>
              )}
            </div>
          </div>

          {/* Card lists */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Mazo Principal ({stats.mainCount})
              </h3>
              <div className="space-y-1">
                {groupedMain.map(({ def, count }) => (
                  <div
                    key={def.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-slate-800/80 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-slate-100 font-medium">{def.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono-num">
                      <span className="text-amber-300 font-bold">x{count}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(def.id)}
                        aria-label={`Quitar ${def.name}`}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 hover:bg-rose-900 hover:text-white cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddCard(def.id)}
                        disabled={count >= MAX_COPIES_PER_CARD}
                        aria-label={`Añadir ${def.name}`}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-35 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-300 mb-1.5">
                Deck Extra ({stats.extraCount})
              </h3>
              <div className="space-y-1">
                {groupedExtra.map(({ def, count }) => (
                  <div
                    key={def.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-purple-900/40 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-slate-100 font-medium">{def.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono-num">
                      <span className="text-purple-300 font-bold">x{count}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(def.id)}
                        aria-label={`Quitar ${def.name}`}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 hover:bg-rose-900 hover:text-white cursor-pointer"
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-bold text-slate-950 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Guardar</span>
            </button>
            <button
              type="button"
              onClick={handleActivate}
              disabled={isActive}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-emerald-900/60 disabled:text-emerald-300 py-2.5 text-xs font-bold text-white cursor-pointer"
            >
              <Star className="h-3.5 w-3.5" />
              <span>{isActive ? 'Mazo Activo' : 'Activar Mazo'}</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={profile.decks.length <= 1}
              aria-label="Eliminar mazo"
              className="rounded-lg bg-rose-950 hover:bg-rose-900 disabled:opacity-35 border border-rose-700/60 p-2.5 text-rose-200 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
