/**
 * Apple App Store + Google Play badges.
 * Two variants:
 *   - Full (used inside modals)
 *   - Compact (used directly under crest icons)
 * Both gracefully grey out when no href is provided.
 */
import Link from "next/link";

interface Props {
  href?: string;
  className?: string;
}

const badgeBase =
  "inline-flex items-center gap-2.5 px-4 py-2.5 brut-line h-[52px] transition";
const badgeActive =
  "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--bg)] hover:text-[var(--fg)] hover:border-[var(--fg)]";
const badgeDisabled =
  "bg-transparent text-[var(--fg-3)] border-[var(--line)] opacity-60 cursor-not-allowed";

const AppleSvg = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={(size * 26) / 22}
    viewBox="0 0 22 26"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.55 13.85c0-3.18 2.6-4.7 2.72-4.78-1.48-2.16-3.79-2.46-4.6-2.49-1.96-.2-3.83 1.15-4.83 1.15-1.01 0-2.55-1.12-4.19-1.09-2.16.03-4.15 1.25-5.27 3.18-2.25 3.9-.58 9.66 1.61 12.83 1.07 1.55 2.34 3.29 4.01 3.23 1.61-.06 2.22-1.04 4.17-1.04 1.94 0 2.49 1.04 4.19 1 1.73-.03 2.83-1.58 3.89-3.14 1.22-1.79 1.73-3.53 1.76-3.62-.04-.02-3.38-1.3-3.46-5.13zM14.42 4.34c.88-1.07 1.48-2.55 1.32-4.04-1.27.05-2.83.85-3.74 1.91-.81.94-1.53 2.45-1.34 3.91 1.42.11 2.87-.72 3.76-1.78z" />
  </svg>
);

const PlaySvg = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={(size * 24) / 22}
    viewBox="0 0 22 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M1 1.5c0-.5.4-1 .9-1.1.3 0 .6.1.9.3l16.7 9.6c.3.2.5.5.5.9s-.2.7-.5.9L2.8 21.7c-.3.2-.6.3-.9.3-.5-.1-.9-.6-.9-1.1V1.5z"
      fill="currentColor"
    />
    <path
      d="M14.4 8.7L2.6.5C2.5.4 2.4.3 2.3.3l9.7 9.6 2.4-1.2zM12 12L2.3 21.6c.1-.1.2-.1.3-.2L14.4 14l-2.4-2zM19.5 11l-3.5 1.9 1.9 1.9 1.7-1c.6-.3.6-1.5-.1-1.8z"
      fill="currentColor"
      opacity="0.65"
    />
  </svg>
);

/* ───── full-size badges (modal) ───── */

export function AppleBadge({ href, className = "" }: Props) {
  const inner = (
    <>
      <AppleSvg />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[9px] uppercase tracking-wider opacity-80">
          Download on the
        </span>
        <span className="text-[15px] font-semibold mt-0.5">App Store</span>
      </span>
    </>
  );
  if (!href) {
    return (
      <span className={`${badgeBase} ${badgeDisabled} ${className}`} aria-disabled="true">
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${badgeBase} ${badgeActive} ${className}`}
    >
      {inner}
    </Link>
  );
}

export function PlayBadge({ href, className = "" }: Props) {
  const inner = (
    <>
      <PlaySvg />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[9px] uppercase tracking-wider opacity-80">
          Get it on
        </span>
        <span className="text-[15px] font-semibold mt-0.5">Google Play</span>
      </span>
    </>
  );
  if (!href) {
    return (
      <span className={`${badgeBase} ${badgeDisabled} ${className}`} aria-disabled="true">
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${badgeBase} ${badgeActive} ${className}`}
    >
      {inner}
    </Link>
  );
}

/* ───── compact badges (crest, under each icon) ───── */

export function CompactAppleBadge({ href, className = "" }: Props) {
  const inner = (
    <>
      <AppleSvg size={11} />
      <span>App Store</span>
    </>
  );
  if (!href) {
    return (
      <span
        className={`compact-badge compact-badge-disabled ${className}`}
        aria-disabled="true"
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`compact-badge compact-badge-active ${className}`}
    >
      {inner}
    </Link>
  );
}

export function CompactPlayBadge({ href, className = "" }: Props) {
  const inner = (
    <>
      <PlaySvg size={11} />
      <span>Play</span>
    </>
  );
  if (!href) {
    return (
      <span
        className={`compact-badge compact-badge-disabled ${className}`}
        aria-disabled="true"
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`compact-badge compact-badge-active ${className}`}
    >
      {inner}
    </Link>
  );
}
