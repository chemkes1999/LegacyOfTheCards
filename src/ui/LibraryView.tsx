import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Globe, Loader2, Search } from 'lucide-react';
import { CARD_CATALOG } from '../data/cards';
import { ATTRIBUTE_LABELS_ES, SUBTYPE_LABELS_ES } from '../engine/CardManager';
import { searchOfficialCards, YgoApiLanguage } from '../services/ygoprodeckApi';
import { Attribute, CardCategory, CardDefinition, PlayerProfileSave } from '../types/tcg';
import { CardArtRenderer } from './CardArtRenderer';

interface LibraryViewProps {
  profile: PlayerProfileSave;
  onClose: () => void;
}

const PAGE_SIZE = 24;

export const LibraryView: React.FC<LibraryViewProps> = ({ profile, onClose }) => {
  const [tab, setTab] = useState<'PLAYABLE' | 'YGOPRODECK'>('PLAYABLE');

  // Local playable catalog filters
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | CardCategory>('ALL');
  const [attribute, setAttribute] = useState<'ALL' | Attribute>('ALL');
  const [selectedCard, setSelectedCard] = useState<CardDefinition>(CARD_CATALOG[0]);

  // Live YGOPRODeck search state
  const [ygoQuery, setYgoQuery] = useState('Blue-Eyes');
  const [ygoType, setYgoType] = useState('ALL');
  const [ygoAttr, setYgoAttr] = useState('ALL');
  const [ygoLang, setYgoLang] = useState<YgoApiLanguage>('en');
  const [ygoOffset, setYgoOffset] = useState(0);
  const [ygoCards, setYgoCards] = useState<CardDefinition[]>([]);
  const [ygoTotal, setYgoTotal] = useState(0);
  const [ygoHasMore, setYgoHasMore] = useState(false);
  const [ygoLoading, setYgoLoading] = useState(false);
  const [ygoError, setYgoError] = useState<string | null>(null);

  const playableYgoIds = useMemo(() => {
    const set = new Set<number>();
    for (const c of CARD_CATALOG) {
      if (c.ygoprodeckId) set.add(c.ygoprodeckId);
    }
    return set;
  }, []);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CARD_CATALOG.filter((c) => {
      if (category !== 'ALL' && c.category !== category) return false;
      if (attribute !== 'ALL' && c.attribute !== attribute) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [query, category, attribute]);

  // Debounced live fetch from YGOPRODeck when on YGOPRODECK tab
  useEffect(() => {
    if (tab !== 'YGOPRODECK') return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setYgoLoading(true);
      setYgoError(null);
      try {
        const res = await searchOfficialCards(
          {
            fname: ygoQuery,
            type: ygoType,
            attribute: ygoAttr,
            language: ygoLang,
            num: PAGE_SIZE,
            offset: ygoOffset,
          },
          controller.signal
        );
        setYgoCards(res.cards);
        setYgoTotal(res.totalRows);
        setYgoHasMore(res.hasMore);
        if (res.cards.length > 0) {
          setSelectedCard(res.cards[0]);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setYgoError((err as Error).message || 'Error al consultar la API de YGOPRODeck.');
        }
      } finally {
        setYgoLoading(false);
      }
    }, 380);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [tab, ygoQuery, ygoType, ygoAttr, ygoLang, ygoOffset]);

  const activeList = tab === 'PLAYABLE' ? filteredLocal : ygoCards;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#070a12]/95 p-4 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="mx-auto w-full max-w-7xl flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">Biblioteca de Cartas</h2>
            <p className="text-xs text-slate-400">
              {tab === 'PLAYABLE'
                ? `${filteredLocal.length} de ${CARD_CATALOG.length} cartas jugables (incluye set oficial YGOPRODeck)`
                : `${ygoTotal.toLocaleString()} resultados oficiales en YGOPRODeck API v7`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setTab('PLAYABLE')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === 'PLAYABLE'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Catálogo Jugable ({CARD_CATALOG.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('YGOPRODECK')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                tab === 'YGOPRODECK'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>YGOPRODeck (En vivo)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {tab === 'PLAYABLE' ? (
        <div className="mx-auto w-full max-w-7xl flex flex-wrap items-center gap-3 py-4 shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o efecto..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
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
                className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  category === cat.id ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filtrar por atributo"
            value={attribute}
            onChange={(e) => setAttribute(e.target.value as 'ALL' | Attribute)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="ALL">Todos los atributos</option>
            {(['LIGHT', 'DARK', 'FIRE', 'WATER', 'WIND', 'EARTH', 'DIVINE'] as Attribute[]).map((attr) => (
              <option key={attr} value={attr}>
                {ATTRIBUTE_LABELS_ES[attr]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-7xl flex flex-wrap items-center gap-3 py-4 shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={ygoQuery}
              onChange={(e) => {
                setYgoOffset(0);
                setYgoQuery(e.target.value);
              }}
              placeholder="Buscar carta oficial (ej. Blue-Eyes, Dark Magician, Kuriboh)..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <select
            aria-label="Tipo oficial"
            value={ygoType}
            onChange={(e) => {
              setYgoOffset(0);
              setYgoType(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="Normal Monster">Normal Monster</option>
            <option value="Effect Monster">Effect Monster</option>
            <option value="Fusion Monster">Fusion Monster</option>
            <option value="Synchro Monster">Synchro Monster</option>
            <option value="XYZ Monster">XYZ Monster</option>
            <option value="Link Monster">Link Monster</option>
            <option value="Spell Card">Spell Card</option>
            <option value="Trap Card">Trap Card</option>
          </select>

          <select
            aria-label="Atributo oficial"
            value={ygoAttr}
            onChange={(e) => {
              setYgoOffset(0);
              setYgoAttr(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
          >
            <option value="ALL">Todos los atributos</option>
            {(['LIGHT', 'DARK', 'FIRE', 'WATER', 'WIND', 'EARTH', 'DIVINE'] as Attribute[]).map((attr) => (
              <option key={attr} value={attr}>
                {ATTRIBUTE_LABELS_ES[attr]}
              </option>
            ))}
          </select>

          <select
            aria-label="Idioma API YGOPRODeck"
            value={ygoLang}
            onChange={(e) => {
              setYgoOffset(0);
              setYgoLang(e.target.value as YgoApiLanguage);
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
          >
            <option value="en">Inglés (EN)</option>
            <option value="pt">Portugués (PT)</option>
            <option value="fr">Francés (FR)</option>
            <option value="de">Alemán (DE)</option>
            <option value="it">Italiano (IT)</option>
          </select>
        </div>
      )}

      {/* Main Split: Grid + Inspector */}
      <div className="mx-auto w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 min-h-0">
        <div className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pr-1">
            {tab === 'YGOPRODECK' && ygoLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span>Consultando YGOPRODeck API v7...</span>
              </div>
            ) : tab === 'YGOPRODECK' && ygoError ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-6 text-center text-sm text-rose-200">
                {ygoError}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                {activeList.map((card) => {
                  const isPlayableOfficial =
                    card.ygoprodeckId !== undefined && playableYgoIds.has(card.ygoprodeckId);
                  return (
                    <div key={card.id} className="flex flex-col items-center gap-1">
                      <CardArtRenderer
                        card={card}
                        size="md"
                        showRarity={tab === 'PLAYABLE'}
                        selected={selectedCard.id === card.id}
                        onClick={() => setSelectedCard(card)}
                      />
                      {tab === 'PLAYABLE' ? (
                        <span className="text-[11px] font-mono-num text-slate-400">
                          x{profile.unlockedCardIds[card.id] ?? 3}
                          {card.ygoprodeckId ? ' · Oficial' : ''}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-semibold ${
                            isPlayableOfficial ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {isPlayableOfficial ? 'Jugable en Duelo' : `#${card.ygoprodeckId}`}
                        </span>
                      )}
                    </div>
                  );
                })}
                {activeList.length === 0 && (
                  <div className="col-span-full py-12 text-center text-sm text-slate-400">
                    No se encontraron cartas con los filtros actuales.
                  </div>
                )}
              </div>
            )}
          </div>

          {tab === 'YGOPRODECK' && !ygoLoading && ygoTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-2 text-xs shrink-0">
              <button
                type="button"
                disabled={ygoOffset === 0}
                onClick={() => setYgoOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 px-3 py-1.5 text-slate-100 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>
              <span className="font-mono-num text-slate-400">
                Mostrando {ygoOffset + 1}–{Math.min(ygoOffset + PAGE_SIZE, ygoTotal)} de {ygoTotal}
              </span>
              <button
                type="button"
                disabled={!ygoHasMore}
                onClick={() => setYgoOffset((o) => o + PAGE_SIZE)}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 px-3 py-1.5 text-slate-100 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 overflow-y-auto space-y-4">
          <div className="flex justify-center">
            <CardArtRenderer card={selectedCard} size="lg" showRarity />
          </div>

          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold text-white">{selectedCard.name}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold">
                {selectedCard.category === 'MONSTER'
                  ? `Monstruo · ${SUBTYPE_LABELS_ES[selectedCard.subtype]}`
                  : selectedCard.category === 'SPELL'
                  ? `Mágica · ${SUBTYPE_LABELS_ES[selectedCard.subtype]}`
                  : `Trampa · ${SUBTYPE_LABELS_ES[selectedCard.subtype]}`}
              </span>
              {selectedCard.attribute && (
                <span className="rounded bg-slate-800 px-2 py-0.5">
                  {ATTRIBUTE_LABELS_ES[selectedCard.attribute]}
                </span>
              )}
              {selectedCard.race && (
                <span className="rounded bg-slate-800 px-2 py-0.5">{selectedCard.race}</span>
              )}
              {selectedCard.isTuner && (
                <span className="rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5">
                  Cantante
                </span>
              )}
            </div>
          </div>

          {selectedCard.category === 'MONSTER' && (
            <div className="grid grid-cols-3 gap-2 font-mono-num text-xs">
              <div className="rounded-lg bg-slate-900 p-2 text-center border border-slate-800">
                <div className="text-slate-400">
                  {selectedCard.subtype === 'xyz'
                    ? 'Rango'
                    : selectedCard.subtype === 'link'
                    ? 'Enlace'
                    : 'Nivel'}
                </div>
                <div className="text-amber-300 font-bold text-sm">{selectedCard.level}</div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2 text-center border border-slate-800">
                <div className="text-slate-400">ATK</div>
                <div className="text-white font-bold text-sm">{selectedCard.atk}</div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2 text-center border border-slate-800">
                <div className="text-slate-400">DEF</div>
                <div className="text-sky-300 font-bold text-sm">
                  {selectedCard.subtype === 'link' ? '—' : selectedCard.def}
                </div>
              </div>
            </div>
          )}

          {selectedCard.summonRequirementText && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              <span className="font-semibold">Requisitos: </span>
              {selectedCard.summonRequirementText}
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            {selectedCard.description}
          </p>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            {selectedCard.ygoprodeckId ? (
              <>
                <span>ID Oficial YGOPRODeck</span>
                <span className="font-mono-num font-bold text-emerald-400">
                  #{selectedCard.ygoprodeckId}
                </span>
              </>
            ) : (
              <>
                <span>Copias en tu colección</span>
                <span className="font-mono-num font-bold text-emerald-400">
                  {profile.unlockedCardIds[selectedCard.id] ?? 0} / 3
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
