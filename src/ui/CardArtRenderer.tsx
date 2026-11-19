import React, { useEffect, useMemo, useState } from 'react';
import { CardDefinition, LinkArrow } from '../types/tcg';
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

interface FrameTheme {
  frameBg: string;
  titleText: string;
  titleBg: string;
  titleBorder: string;
  loreBg: string;
  loreBorder: string;
  loreText: string;
  outerBorder: string;
}

const FRAME_THEMES: Record<string, FrameTheme> = {
  normal: {
    frameBg: 'linear-gradient(155deg, #dcc07c 0%, #c8a258 48%, #b3893f 100%)',
    titleText: 'text-stone-950',
    titleBg: 'bg-amber-100/35',
    titleBorder: 'border-amber-950/35',
    loreBg: 'bg-[#f4ebd3]',
    loreBorder: 'border-[#8f6c32]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  effect: {
    frameBg: 'linear-gradient(155deg, #d6854d 0%, #b96030 50%, #9b471e 100%)',
    titleText: 'text-stone-950',
    titleBg: 'bg-orange-100/25',
    titleBorder: 'border-orange-950/40',
    loreBg: 'bg-[#f3e5d0]',
    loreBorder: 'border-[#7c3d19]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  fusion: {
    frameBg: 'linear-gradient(155deg, #a66bb3 0%, #7d4590 50%, #5c2d6e 100%)',
    titleText: 'text-white',
    titleBg: 'bg-purple-950/35',
    titleBorder: 'border-purple-200/35',
    loreBg: 'bg-[#efe6f2]',
    loreBorder: 'border-[#542a66]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  ritual: {
    frameBg: 'linear-gradient(155deg, #7498d4 0%, #4d73b5 50%, #345491 100%)',
    titleText: 'text-slate-950',
    titleBg: 'bg-sky-100/30',
    titleBorder: 'border-blue-950/35',
    loreBg: 'bg-[#e6edf7]',
    loreBorder: 'border-[#33508a]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  synchro: {
    frameBg: 'linear-gradient(155deg, #f3f5f8 0%, #d8dee6 52%, #b9c3d0 100%)',
    titleText: 'text-slate-950',
    titleBg: 'bg-white/60',
    titleBorder: 'border-slate-500/45',
    loreBg: 'bg-[#f5f6f8]',
    loreBorder: 'border-slate-500',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  xyz: {
    frameBg:
      'radial-gradient(circle at 25% 20%, #2d3345 0%, #141720 45%, #07080d 100%)',
    titleText: 'text-white',
    titleBg: 'bg-white/10',
    titleBorder: 'border-amber-200/35',
    loreBg: 'bg-[#ede9e0]',
    loreBorder: 'border-zinc-600',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#2e313b]',
  },
  pendulum: {
    frameBg:
      'linear-gradient(180deg, #cf7a42 0%, #b5612e 42%, #2b8c79 58%, #166b5e 100%)',
    titleText: 'text-stone-950',
    titleBg: 'bg-amber-100/30',
    titleBorder: 'border-amber-950/40',
    loreBg: 'bg-[#eef2e8]',
    loreBorder: 'border-[#25695b]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  link: {
    frameBg:
      'linear-gradient(155deg, #1b6eb8 0%, #124d8c 50%, #0b3463 100%)',
    titleText: 'text-white',
    titleBg: 'bg-blue-950/40',
    titleBorder: 'border-sky-300/35',
    loreBg: 'bg-[#e6eef6]',
    loreBorder: 'border-[#164b82]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  SPELL: {
    frameBg: 'linear-gradient(155deg, #249e84 0%, #177b67 52%, #0e5a4b 100%)',
    titleText: 'text-white',
    titleBg: 'bg-emerald-950/30',
    titleBorder: 'border-teal-200/40',
    loreBg: 'bg-[#e6f2ed]',
    loreBorder: 'border-[#0f5c4d]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
  TRAP: {
    frameBg: 'linear-gradient(155deg, #c7478b 0%, #9c2b68 52%, #761a4c 100%)',
    titleText: 'text-white',
    titleBg: 'bg-fuchsia-950/35',
    titleBorder: 'border-pink-200/40',
    loreBg: 'bg-[#f4e6ef]',
    loreBorder: 'border-[#7a1e50]',
    loreText: 'text-stone-900',
    outerBorder: 'border-[#252529]',
  },
};

const RARITY_STYLES: Record<string, string> = {
  UR: 'text-amber-300 border-amber-400/80 bg-amber-950/90',
  SR: 'text-cyan-200 border-cyan-400/80 bg-cyan-950/90',
  R: 'text-sky-100 border-sky-400/60 bg-slate-900/90',
  N: 'text-slate-200 border-slate-500/60 bg-slate-900/90',
};

const ATTR_ORB: Record<string, { bg: string; label: string }> = {
  LIGHT: { bg: 'from-yellow-200 via-amber-400 to-amber-600 text-amber-950', label: 'LUZ' },
  DARK: { bg: 'from-fuchsia-400 via-purple-700 to-indigo-950 text-white', label: 'OSC' },
  FIRE: { bg: 'from-orange-300 via-red-600 to-red-900 text-white', label: 'FUE' },
  WATER: { bg: 'from-cyan-200 via-sky-500 to-blue-800 text-white', label: 'AGU' },
  WIND: { bg: 'from-lime-200 via-emerald-500 to-green-800 text-emerald-950', label: 'VIE' },
  EARTH: { bg: 'from-amber-300 via-amber-700 to-stone-900 text-amber-50', label: 'TIE' },
  DIVINE: { bg: 'from-yellow-100 via-yellow-400 to-amber-700 text-amber-950', label: 'DIV' },
  SPELL: { bg: 'from-teal-300 via-teal-600 to-emerald-900 text-white', label: 'MAG' },
  TRAP: { bg: 'from-pink-300 via-rose-600 to-fuchsia-950 text-white', label: 'TRA' },
};

const LINK_ARROW_POSITIONS: Record<LinkArrow, string> = {
  TL: '-top-1 -left-1 -rotate-45',
  T: '-top-1.5 left-1/2 -translate-x-1/2',
  TR: '-top-1 -right-1 rotate-45',
  L: 'top-1/2 -left-1.5 -translate-y-1/2 -rotate-90',
  R: 'top-1/2 -right-1.5 -translate-y-1/2 rotate-90',
  BL: '-bottom-1 -left-1 -rotate-[135deg]',
  B: '-bottom-1.5 left-1/2 -translate-x-1/2 rotate-180',
  BR: '-bottom-1 -right-1 rotate-[135deg]',
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
  const theme = FRAME_THEMES[frameKey] ?? FRAME_THEMES.effect;

  const sizeConfig = {
    xs: { box: 'w-16 h-24 p-[3px]', title: 'text-[7px]', star: 'w-1.5 h-1.5', showLore: false },
    sm: { box: 'w-24 h-36 p-[4px]', title: 'text-[8.5px]', star: 'w-2 h-2', showLore: false },
    md: { box: 'w-32 h-48 p-[5px]', title: 'text-[10px]', star: 'w-2.5 h-2.5', showLore: true },
    lg: { box: 'w-56 h-80 p-[7px]', title: 'text-[13px]', star: 'w-3.5 h-3.5', showLore: true },
  }[size];

  const orbKey = card.category === 'MONSTER' ? card.attribute ?? 'DARK' : card.category;
  const orb = ATTR_ORB[orbKey] ?? ATTR_ORB.DARK;

  const isXyz = card.category === 'MONSTER' && card.subtype === 'xyz';
  const isLink = card.category === 'MONSTER' && card.subtype === 'link';
  const isPendulum = card.category === 'MONSTER' && card.subtype === 'pendulum';
  const starCount = card.category === 'MONSTER' && !isLink ? Math.min(Math.max(card.level, 0), 12) : 0;

  const typeLine = useMemo(() => {
    if (card.category === 'MONSTER') {
      const parts = [
        (card.race ?? 'MONSTER').toUpperCase(),
        SUBTYPE_LABELS_ES[card.subtype].toUpperCase(),
      ];
      if (card.isTuner) parts.push('CANTANTE');
      return `[${parts.join(' / ')}]`;
    }
    return `[${card.category === 'SPELL' ? 'CARTA MÁGICA' : 'CARTA DE TRAMPA'} · ${SUBTYPE_LABELS_ES[card.subtype].toUpperCase()}]`;
  }, [card]);

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
            fillOpacity="0.85"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ) : card.artMotif === 'knight' || card.artMotif === 'mech' ? (
          <polygon
            points="60,20 88,36 82,76 60,98 38,76 32,36"
            fill={glow}
            fillOpacity="0.85"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ) : card.artMotif === 'spell' || card.artMotif === 'field' ? (
          <g stroke={glow} strokeWidth="2.2" fill="none">
            <polygon points="60,22 92,78 28,78" />
            <polygon points="60,96 92,40 28,40" />
            <circle cx="60" cy="59" r="10" fill={glow} fillOpacity="0.85" />
          </g>
        ) : (
          <polygon
            points="60,22 86,60 60,98 34,60"
            fill={glow}
            fillOpacity="0.85"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )}
      </svg>
    );
  }, [card]);

  const innerContent = (
    <div
      style={{ background: theme.frameBg }}
      className={`relative flex flex-col justify-between rounded-[5px] border-[3px] shadow-md ${
        selected
          ? 'border-amber-300 ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/30'
          : theme.outerBorder
      } ${disabled ? 'opacity-50 grayscale-[35%]' : ''} ${sizeConfig.box} overflow-hidden select-none transition-transform duration-150 ${className}`}
    >
      {/* Subtle metallic inner hairline */}
      <div className="pointer-events-none absolute inset-[1px] rounded-[3px] border border-white/25" />

      {/* Top Rarity Marker */}
      {showRarity && size !== 'xs' && (
        <span
          className={`absolute bottom-1 left-1 z-20 px-1 py-0 text-[8px] font-bold font-mono-num border rounded ${RARITY_STYLES[card.rarity]}`}
        >
          {card.rarity}
        </span>
      )}

      {/* 1. Beveled Title Plate + Circular Attribute Orb */}
      <div
        className={`relative z-10 flex items-center justify-between gap-1 px-1.5 py-[2px] rounded-[2px] border shadow-inner ${theme.titleBg} ${theme.titleBorder}`}
      >
        <span
          className={`font-serif font-extrabold uppercase tracking-tight truncate leading-tight ${sizeConfig.title} ${theme.titleText}`}
        >
          {card.name}
        </span>
        {size !== 'xs' && (
          <span
            className={`shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br border border-white/60 shadow-sm font-bold leading-none ${
              size === 'lg' ? 'w-5 h-5 text-[7px]' : 'w-3.5 h-3.5 text-[5.5px]'
            } ${orb.bg}`}
            title={card.attribute ? ATTRIBUTE_LABELS_ES[card.attribute] : orb.label}
          >
            {orb.label.slice(0, size === 'lg' ? 3 : 1)}
          </span>
        )}
      </div>

      {/* 2. Level / Rank Stars OR Spell/Trap Tag */}
      {size !== 'xs' && (
        <div
          className={`relative z-10 flex items-center min-h-[12px] px-1 py-[1px] ${
            isXyz ? 'justify-start' : 'justify-end'
          }`}
        >
          {card.category === 'MONSTER' && !isLink && starCount > 0 ? (
            <div className="flex items-center gap-[1.5px] flex-wrap">
              {Array.from({ length: Math.min(starCount, size === 'sm' ? 8 : 12) }).map((_, i) => (
                <span
                  key={i}
                  className={`${sizeConfig.star} rounded-full flex items-center justify-center shadow-sm ${
                    isXyz
                      ? 'bg-zinc-950 border border-amber-400 text-amber-300'
                      : 'bg-gradient-to-br from-orange-400 via-red-600 to-red-800 border border-amber-200/80 text-yellow-200'
                  }`}
                >
                  <span className="block w-[45%] h-[45%] bg-yellow-300 rotate-45" />
                </span>
              ))}
            </div>
          ) : card.category !== 'MONSTER' ? (
            <span className="text-[8px] font-serif font-bold tracking-wide text-white/95 drop-shadow">
              [{card.category === 'SPELL' ? 'MÁGICA' : 'TRAMPA'} · {SUBTYPE_LABELS_ES[card.subtype].toUpperCase()}]
            </span>
          ) : null}
        </div>
      )}

      {/* 3. Artwork Frame with Metallic Bevel + Link Arrows */}
      <div className="relative z-10 flex-1 mx-[2px] my-[1px]">
        <div className="relative w-full h-full border-[2px] border-[#3a3f4b] shadow-[inset_0_0_4px_rgba(0,0,0,0.85)] bg-slate-950 overflow-hidden">
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

        {/* Link Monster Red Directional Arrows */}
        {isLink && card.linkArrows && size !== 'xs' && (
          <>
            {card.linkArrows.map((arrow) => (
              <span
                key={arrow}
                aria-hidden="true"
                className={`pointer-events-none absolute z-20 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-red-500 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)] ${LINK_ARROW_POSITIONS[arrow]}`}
              />
            ))}
          </>
        )}
      </div>

      {/* 4. Pendulum Scale Strip (if Pendulum Monster) */}
      {isPendulum && card.pendulumScale !== undefined && size !== 'xs' && (
        <div className="relative z-10 mx-[2px] mb-[1px] flex items-center justify-between border border-emerald-900/70 bg-[#eef4ec]/95 px-1 py-[1px] text-stone-900">
          <span className="flex items-center gap-0.5 font-mono-num font-extrabold text-[8px] text-sky-700">
            ◆{card.pendulumScale}
          </span>
          {size === 'lg' && (
            <span className="text-[7px] text-stone-700 truncate px-1">Escala Péndulo</span>
          )}
          <span className="flex items-center gap-0.5 font-mono-num font-extrabold text-[8px] text-rose-700">
            {card.pendulumScale}◆
          </span>
        </div>
      )}

      {/* 5. Authentic Parchment Lore & Stats Box */}
      <div
        className={`relative z-10 mx-[1px] mt-[1px] rounded-[2px] border-[1.5px] ${theme.loreBg} ${theme.loreBorder} ${theme.loreText} px-1 py-[2px] flex flex-col justify-between`}
      >
        {sizeConfig.showLore && (
          <>
            <div
              className={`font-serif font-extrabold tracking-tight truncate ${
                size === 'lg' ? 'text-[8.5px]' : 'text-[6.5px]'
              }`}
            >
              {typeLine}
            </div>
            <p
              className={`leading-tight overflow-hidden ${
                size === 'lg' ? 'text-[8px] line-clamp-4 my-0.5' : 'text-[6px] line-clamp-2'
              }`}
            >
              {card.description}
            </p>
          </>
        )}

        {card.category === 'MONSTER' ? (
          <div
            className={`flex items-center justify-end gap-1.5 font-mono-num font-extrabold ${
              sizeConfig.showLore ? 'border-t border-stone-800/40 pt-[1px] mt-[1px]' : ''
            } ${size === 'lg' ? 'text-[9.5px]' : size === 'md' ? 'text-[7.5px]' : 'text-[7px]'}`}
          >
            <span>{size === 'xs' ? card.atk : `ATK/${card.atk}`}</span>
            {size !== 'xs' && (
              <span>{isLink ? `LINK-${card.level}` : `DEF/${card.def}`}</span>
            )}
          </div>
        ) : (
          !sizeConfig.showLore && (
            <div className="text-[7px] font-serif font-bold text-center truncate">
              {card.category === 'SPELL' ? 'Mágica' : 'Trampa'}
            </div>
          )
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
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-[5px] hover:-translate-y-1 transition-transform duration-150 cursor-pointer"
      >
        {innerContent}
      </button>
    );
  }

  return innerContent;
};
