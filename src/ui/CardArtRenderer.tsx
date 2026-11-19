import React, { useEffect, useMemo, useState } from 'react';
import { CardDefinition } from '../types/tcg';
import { ATTRIBUTE_LABELS_ES, SUBTYPE_LABELS_ES } from '../engine/CardManager';

interface CardArtRendererProps {
  card: CardDefinition;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  showRarity?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  className?: string;
}

const FRAME_STYLES: Record<string, { border: string; bg: string; header: string }> = {
  normal: { border: 'border-amber-600/80', bg: 'from-amber-900/90 to-amber-950/95', header: 'bg-amber-950/80' },
  effect: { border: 'border-orange-600/80', bg: 'from-orange-900/90 to-stone-950/95', header: 'bg-orange-950/80' },
  fusion: { border: 'border-purple-500/85', bg: 'from-purple-900/90 to-indigo-950/95', header: 'bg-purple-950/80' },
  synchro: { border: 'border-slate-300/85', bg: 'from-slate-600/90 to-slate-900/95', header: 'bg-slate-800/85' },
  xyz: { border: 'border-amber-400/70', bg: 'from-zinc-900/95 to-black/95', header: 'bg-zinc-950/90' },
  pendulum: { border: 'border-emerald-500/80', bg: 'from-amber-800/75 via-emerald-900/85 to-emerald-950/95', header: 'bg-emerald-950/80' },
  link: { border: 'border-blue-500/85', bg: 'from-blue-800/90 to-slate-950/95', header: 'bg-blue-950/85' },
  ritual: { border: 'border-sky-400/80', bg: 'from-sky-800/90 to-slate-950/95', header: 'bg-sky-950/80' },
  SPELL: { border: 'border-teal-500/85', bg: 'from-teal-800/90 to-emerald-950/95', header: 'bg-teal-950/85' },
  TRAP: { border: 'border-rose-500/85', bg: 'from-rose-900/90 to-fuchsia-950/95', header: 'bg-rose-950/85' },
};

const RARITY_STYLES: Record<string, string> = {
  UR: 'text-amber-300 border-amber-400/70 bg-amber-950/90',
  SR: 'text-cyan-300 border-cyan-400/70 bg-cyan-950/90',
  R: 'text-sky-200 border-sky-400/50 bg-slate-900/90',
  N: 'text-slate-300 border-slate-500/50 bg-slate-900/90',
};

const ATTR_COLORS: Record<string, string> = {
  LIGHT: 'bg-amber-300 text-slate-950',
  DARK: 'bg-purple-700 text-white',
  FIRE: 'bg-orange-600 text-white',
  WATER: 'bg-sky-500 text-slate-950',
  WIND: 'bg-emerald-500 text-slate-950',
  EARTH: 'bg-amber-700 text-amber-50',
  DIVINE: 'bg-yellow-400 text-slate-950',
};

export const CardArtRenderer: React.FC<CardArtRendererProps> = ({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  showRarity = false,
  onClick,
  onMouseEnter,
  className = '',
}) => {
  const artSrc = card.imageUrl ?? card.bossImage;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [artSrc]);

  const frameKey = card.category === 'MONSTER' ? card.subtype : card.category;
  const frame = FRAME_STYLES[frameKey] ?? FRAME_STYLES.effect;

  const sizeClasses = {
    xs: 'w-16 h-24 text-[9px]',
    sm: 'w-22 h-32 text-[10px]',
    md: 'w-28 h-40 text-xs',
    lg: 'w-48 h-70 text-xs',
  }[size];

  const svgEmblem = useMemo(() => {
    const [c1, c2, glow] = card.artPalette;
    return (
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id={`grad_${card.id}`} cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="60%" stopColor={c2} />
            <stop offset="100%" stopColor="#07090f" />
          </radialGradient>
        </defs>
        <rect width="120" height="120" fill={`url(#grad_${card.id})`} />
        <circle cx="60" cy="60" r="40" fill="none" stroke={glow} strokeWidth="1.4" strokeOpacity="0.45" />
        <circle cx="60" cy="60" r="28" fill="none" stroke={glow} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4 3" />
        {card.artMotif === 'dragon' || card.artMotif === 'seraph' ? (
          <polygon
            points="60,18 98,48 76,68 86,96 60,80 34,96 44,68 22,48"
            fill={glow}
            fillOpacity="0.82"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ) : card.artMotif === 'knight' || card.artMotif === 'mech' ? (
          <polygon
            points="60,20 88,36 82,76 60,98 38,76 32,36"
            fill={glow}
            fillOpacity="0.82"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ) : card.artMotif === 'spell' || card.artMotif === 'field' ? (
          <g stroke={glow} strokeWidth="2.2" fill="none">
            <polygon points="60,22 92,78 28,78" />
            <polygon points="60,96 92,40 28,40" />
            <circle cx="60" cy="59" r="10" fill={glow} fillOpacity="0.8" />
          </g>
        ) : (
          <polygon
            points="60,22 86,60 60,98 34,60"
            fill={glow}
            fillOpacity="0.82"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )}
      </svg>
    );
  }, [card]);

  const innerContent = (
    <div
      className={`relative flex flex-col justify-between rounded-md border-2 bg-gradient-to-b ${frame.bg} ${
        selected
          ? 'border-amber-300 ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/25'
          : frame.border
      } ${disabled ? 'opacity-50 grayscale-[35%]' : ''} ${sizeClasses} p-1 overflow-hidden select-none transition-transform duration-150 ${className}`}
    >
      {/* Top Rarity Marker */}
      {showRarity && (
        <span
          className={`absolute top-0.5 right-0.5 z-10 px-1 py-0 text-[9px] font-bold font-mono-num border rounded ${RARITY_STYLES[card.rarity]}`}
        >
          {card.rarity}
        </span>
      )}

      {/* Title Header */}
      <div className={`flex items-center justify-between gap-1 px-1 py-0.5 rounded-sm ${frame.header}`}>
        <span className="font-semibold text-slate-100 truncate leading-tight">
          {card.name}
        </span>
        {card.attribute && size !== 'xs' && (
          <span
            className={`shrink-0 px-1 rounded-sm text-[8px] font-bold ${ATTR_COLORS[card.attribute]}`}
            title={ATTRIBUTE_LABELS_ES[card.attribute]}
          >
            {card.attribute.slice(0, 3)}
          </span>
        )}
      </div>

      {/* Level / Rank / Scale line */}
      {size !== 'xs' && (
        <div className="flex items-center justify-between px-1 py-0.5 text-[9px] leading-none">
          {card.category === 'MONSTER' ? (
            <span className="text-amber-300 font-mono-num font-bold">
              {card.subtype === 'xyz'
                ? `R${card.level}`
                : card.subtype === 'link'
                ? `L-${card.level}`
                : `★${card.level}`}
            </span>
          ) : (
            <span className="text-teal-200 font-medium truncate">
              {SUBTYPE_LABELS_ES[card.subtype]}
            </span>
          )}
          {card.pendulumScale !== undefined && (
            <span className="text-emerald-300 font-mono-num font-bold">
              ESC {card.pendulumScale}
            </span>
          )}
        </div>
      )}

      {/* Artwork Frame */}
      <div className="relative flex-1 my-0.5 rounded-sm overflow-hidden border border-slate-900 bg-slate-950">
        {artSrc && !imgFailed ? (
          <img
            src={artSrc}
            alt={card.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          svgEmblem
        )}
      </div>

      {/* Bottom Stats */}
      <div className="bg-slate-950/85 px-1 py-0.5 rounded-sm border border-white/10 flex items-center justify-between font-mono-num">
        {card.category === 'MONSTER' ? (
          <>
            <span className="text-amber-200 font-bold">
              {size === 'xs' ? card.atk : `ATK ${card.atk}`}
            </span>
            {size !== 'xs' && (
              <span className="text-sky-200 font-semibold">
                {card.subtype === 'link' ? `LNK-${card.level}` : `DEF ${card.def}`}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px] text-slate-300 font-sans truncate">
            {card.category === 'SPELL' ? 'Mágica' : 'Trampa'} · {SUBTYPE_LABELS_ES[card.subtype]}
          </span>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        aria-label={card.name}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md hover:-translate-y-1 transition-transform duration-150 cursor-pointer"
      >
        {innerContent}
      </button>
    );
  }

  return innerContent;
};
