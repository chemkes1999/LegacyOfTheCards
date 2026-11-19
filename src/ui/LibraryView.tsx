import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { CARD_CATALOG } from '../data/cards';
import { ATTRIBUTE_LABELS_ES, SUBTYPE_LABELS_ES } from '../engine/CardManager';
import { Attribute, CardCategory, CardDefinition, PlayerProfileSave } from '../types/tcg';
import { CardArtRenderer } from './CardArtRenderer';

interface LibraryViewProps {
  profile: PlayerProfileSave;
  onClose: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ profile, onClose }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | CardCategory>('ALL');
  const [attribute, setAttribute] = useState<'ALL' | Attribute>('ALL');
  const [selectedCard, setSelectedCard] = useState<CardDefinition>(CARD_CATALOG[0]);

  const filtered = useMemo(() => {
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
              {filtered.length} de {CARD_CATALOG.length} cartas jugables disponibles
            </p>
          </div>
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

      {/* Filters */}
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

      {/* Main Split: Grid + Inspector */}
      <div className="mx-auto w-full max-w-7xl flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 min-h-0">
        <div className="overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
            {filtered.map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-1">
                <CardArtRenderer
                  card={card}
                  size="md"
                  showRarity
                  selected={selectedCard.id === card.id}
                  onClick={() => setSelectedCard(card)}
                />
                <span className="text-[11px] font-mono-num text-slate-400">
                  x{profile.unlockedCardIds[card.id] ?? 0}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-slate-400">
                No se encontraron cartas con los filtros actuales.
              </div>
            )}
          </div>
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
            <span>Copias en tu colección</span>
            <span className="font-mono-num font-bold text-emerald-400">
              {profile.unlockedCardIds[selectedCard.id] ?? 0} / 3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
