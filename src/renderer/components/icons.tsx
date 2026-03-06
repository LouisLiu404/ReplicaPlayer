import {
  ArrowPathIcon as ArrowPathOutlineIcon,
  ArrowPathRoundedSquareIcon as ArrowPathRoundedSquareOutlineIcon,
  ArrowsRightLeftIcon as ArrowsRightLeftOutlineIcon,
  Bars3BottomLeftIcon as Bars3BottomLeftOutlineIcon,
  ChevronDownIcon as ChevronDownOutlineIcon,
  ChevronUpIcon as ChevronUpOutlineIcon,
  Cog6ToothIcon as Cog6ToothOutlineIcon,
  FolderIcon as FolderOutlineIcon,
  InformationCircleIcon as InformationCircleOutlineIcon,
  MagnifyingGlassIcon as MagnifyingGlassOutlineIcon,
  MusicalNoteIcon as MusicalNoteOutlineIcon,
  PlusIcon as PlusOutlineIcon,
  QueueListIcon as QueueListOutlineIcon,
  SpeakerWaveIcon as SpeakerWaveOutlineIcon,
  XMarkIcon as XMarkOutlineIcon
} from "@heroicons/react/24/outline";
import {
  BackwardIcon as BackwardSolidIcon,
  ForwardIcon as ForwardSolidIcon,
  PauseIcon as PauseSolidIcon,
  PlayIcon as PlaySolidIcon
} from "@heroicons/react/20/solid";
import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ReplicaMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="28" height="28" rx="14" fill="currentColor" opacity="0.16" />
      <path
        d="M20.4 9.4V18a3.7 3.7 0 1 1-1.6-3.05v-5.1l-6.4 1.2v7a3.7 3.7 0 1 1-1.6-3.04V8.1a1.1 1.1 0 0 1 .9-1.08l7.64-1.43a.92.92 0 0 1 1.08.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlayerGlyph(props: IconProps) {
  const iconId = useId().replace(/:/g, "");
  const orangeGradId = `${iconId}-orange-grad`;
  const blackGradId = `${iconId}-black-grad`;
  const glowId = `${iconId}-orange-glow`;

  return (
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={orangeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8a00" />
          <stop offset="100%" stopColor="#ff3300" />
        </linearGradient>

        <linearGradient id={blackGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#000000" />
        </linearGradient>

        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="20" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g transform="translate(-15, 12)">
        <path
          d="M 176 136 C 166 130 156 136 156 148 L 156 324 C 156 336 166 342 176 336 L 336 248 C 346 242 346 230 336 224 Z"
          fill={`url(#${orangeGradId})`}
          filter={`url(#${glowId})`}
          opacity="0.85"
        />

        <path
          d="M 226 186 C 216 180 206 186 206 198 L 206 374 C 206 386 216 392 226 386 L 386 298 C 396 292 396 280 386 274 Z"
          fill={`url(#${blackGradId})`}
          stroke={`url(#${orangeGradId})`}
          strokeWidth="6"
        />
      </g>
    </svg>
  );
}

export function ReplicaWordmark(props: IconProps) {
  const iconId = useId().replace(/:/g, "");
  const orangeGradId = `${iconId}-orange-grad`;
  const topSliceId = `${iconId}-top-slice`;
  const bottomSliceId = `${iconId}-bottom-slice`;

  return (
    <svg viewBox="0 0 600 200" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={orangeGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff8a00" />
          <stop offset="100%" stopColor="#ff3300" />
        </linearGradient>

        <clipPath id={topSliceId}>
          <rect x="0" y="0" width="600" height="98" />
        </clipPath>
        <clipPath id={bottomSliceId}>
          <rect x="0" y="102" width="600" height="100" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${bottomSliceId})`}>
        <text
          x="315"
          y="135"
          fill={`url(#${orangeGradId})`}
          fontFamily="'Arial Black', Impact, system-ui, sans-serif"
          fontSize="85"
          fontWeight="900"
          letterSpacing="14"
          textAnchor="middle"
        >
          REPLICA
        </text>
      </g>

      <g clipPath={`url(#${topSliceId})`}>
        <text
          x="300"
          y="135"
          fill="#ffffff"
          fontFamily="'Arial Black', Impact, system-ui, sans-serif"
          fontSize="85"
          fontWeight="900"
          letterSpacing="14"
          textAnchor="middle"
        >
          REPLICA
        </text>
      </g>

      <line
        x1="80"
        y1="100"
        x2="520"
        y2="100"
        stroke={`url(#${orangeGradId})`}
        strokeWidth="2"
        opacity="0.8"
      />
    </svg>
  );
}

export function DiscIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="7.5" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2" strokeWidth="1.7" />
      <path d="M16.9 7.1 14 10" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export const LibraryIcon = QueueListOutlineIcon;
export const FolderIcon = FolderOutlineIcon;
export const SearchIcon = MagnifyingGlassOutlineIcon;
export const PlusIcon = PlusOutlineIcon;
export const RefreshIcon = ArrowPathOutlineIcon;
export const PanelIcon = Bars3BottomLeftOutlineIcon;
export const QueueIcon = QueueListOutlineIcon;
export const LyricsIcon = Bars3BottomLeftOutlineIcon;
export const InfoIcon = InformationCircleOutlineIcon;
export const CloseIcon = XMarkOutlineIcon;
export const PrevIcon = BackwardSolidIcon;
export const NextIcon = ForwardSolidIcon;
export const PlayIcon = PlaySolidIcon;
export const PauseIcon = PauseSolidIcon;
export const VolumeIcon = SpeakerWaveOutlineIcon;
export const ChevronUpIcon = ChevronUpOutlineIcon;
export const ChevronDownIcon = ChevronDownOutlineIcon;
export const MusicNoteIcon = MusicalNoteOutlineIcon;
export const SettingsIcon = Cog6ToothOutlineIcon;
export const ShuffleIcon = ArrowsRightLeftOutlineIcon;
export const RepeatIcon = ArrowPathRoundedSquareOutlineIcon;
