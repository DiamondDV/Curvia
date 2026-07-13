/** Hand-rolled stroke icons (lucide-style, 24x24 viewBox) — no icon
 *  library dependency added just for this UI pass. Keep new icons in
 *  this file, same prop shape, so callers stay consistent. */

interface IconProps {
  className?: string;
  size?: number;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SparklesIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9.5 3 11 7l4 1.5L11 10l-1.5 4L8 10l-4-1.5L8 7z" />
      <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z" />
    </svg>
  );
}

export function UploadCloudIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 15.5A4.5 4.5 0 0 1 6.5 7a5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 19.5 15" />
      <path d="M12 12v8" />
      <path d="m9 15 3-3 3 3" />
    </svg>
  );
}

export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronDownIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function DownloadIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function CodeIcon({ className, size = 15 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m8 6-5 6 5 6" />
      <path d="m16 6 5 6-5 6" />
    </svg>
  );
}

export function KeyIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.6 12.4 8-8" />
      <path d="m16 8 2 2" />
      <path d="m14.5 9.5 2 2" />
    </svg>
  );
}

export function SlidersIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 6h6M14 6h6M4 12h11M18 12h2M4 18h2M9 18h11" />
      <circle cx="12" cy="6" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MinusIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function XIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ImageIcon({ className, size = 28 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.75" fill="currentColor" stroke="none" />
      <path d="m21 15-5-5-9 9" />
    </svg>
  );
}

export function ZapIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}
