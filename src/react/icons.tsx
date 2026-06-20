/** @jsxImportSource react */

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}

export function ClapperboardIcon({ className, style, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} {...rest}>
      <rect x="2" y="8" width="20" height="13" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="2" y="5" width="20" height="3" rx="1" fill="currentColor" />
      <line x1="7" y1="5" x2="5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="5" x2="10" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17" y1="5" x2="15" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="5" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ClapperboardOpenIcon({ className, style, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} {...rest}>
      <rect x="2" y="8" width="20" height="13" rx="2" fill="currentColor" opacity="0.4" />
      <path d="M2 5 L22 8 L22 5 L2 2 Z" fill="currentColor" />
      <line x1="6.5" y1="4.5" x2="5.5" y2="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11.5" y1="5.5" x2="10.5" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16.5" y1="6.5" x2="15.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function VideocameraIcon({ className, style, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} {...rest}>
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.4" />
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon({ className, style, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} {...rest}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
