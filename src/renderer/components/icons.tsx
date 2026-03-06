import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

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

export function LibraryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="4.5" width="6" height="15" rx="1.5" />
      <rect x="10.5" y="4.5" width="5" height="15" rx="1.5" />
      <rect x="16.5" y="4.5" width="4" height="15" rx="1.5" />
    </BaseIcon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </BaseIcon>
  );
}

export function DiscIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.9 7.1 14 10" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4.5 4.5" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M7.5 9a7 7 0 0 1 11-2" />
      <path d="M16.5 15a7 7 0 0 1-11 2" />
    </BaseIcon>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M14.5 4.5v15" />
    </BaseIcon>
  );
}

export function QueueIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7.5h12" />
      <path d="M5 12h10" />
      <path d="M5 16.5h8" />
      <path d="m18 11 3 2-3 2v-4Z" />
    </BaseIcon>
  );
}

export function LyricsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7.5h14" />
      <path d="M5 11.5h14" />
      <path d="M5 15.5h10" />
      <path d="M5 19.5h8" />
    </BaseIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 10.5v5" />
      <path d="M12 7.5h.01" />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}

export function PrevIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8.5 7.5v9" />
      <path d="m18 7.5-7 4.5 7 4.5Z" />
    </BaseIcon>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15.5 7.5v9" />
      <path d="m6 7.5 7 4.5-7 4.5Z" />
    </BaseIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m8.5 6.8 8 5.2-8 5.2Z" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8.5 7.5h2.5v9H8.5Z" fill="currentColor" stroke="none" />
      <path d="M13 7.5h2.5v9H13Z" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 10h3l4-4v12l-4-4H5Z" />
      <path d="M16 9a4.5 4.5 0 0 1 0 6" />
      <path d="M18.5 6.5a8 8 0 0 1 0 11" />
    </BaseIcon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 14 6-6 6 6" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 10 6 6 6-6" />
    </BaseIcon>
  );
}

export function MusicNoteIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15.5 6.5v8.2a3 3 0 1 1-1.8-2.73V8l-5.2 1v5.7a3 3 0 1 1-1.8-2.72V7.7a1 1 0 0 1 .8-.98l6.84-1.28a.92.92 0 0 1 1.08.9Z" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.55-2-3.46-2.35.8a7.3 7.3 0 0 0-1.9-1.1L14.3 3h-4.6l-.35 2.58a7.3 7.3 0 0 0-1.9 1.1l-2.35-.8-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .38.03.75.1 1.1l-2 1.55 2 3.46 2.35-.8c.58.45 1.22.82 1.9 1.1L9.7 21h4.6l.35-2.58c.68-.28 1.32-.65 1.9-1.1l2.35.8 2-3.46-2-1.55c.07-.35.1-.72.1-1.1Z" />
    </BaseIcon>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M16 6h4v4" />
      <path d="m4 18 6-6" />
      <path d="m10 12 2-2c1.1-1.1 1.65-1.65 2.3-1.83.65-.17 1.43-.17 2.99-.17H20" />
      <path d="m4 6 6 6" />
      <path d="m14 14 2 2c1.1 1.1 1.65 1.65 2.3 1.83.65.17 1.43.17 2.99.17H20" />
    </BaseIcon>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m16 4 4 4-4 4" />
      <path d="M20 8H9a4 4 0 0 0 0 8h2" />
      <path d="m8 12-4 4 4 4" />
      <path d="M4 16h11a4 4 0 0 0 0-8h-2" />
    </BaseIcon>
  );
}
