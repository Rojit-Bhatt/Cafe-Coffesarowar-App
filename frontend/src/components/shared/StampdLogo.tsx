interface StampdLogoProps {
  size?: number;
  tile?: boolean;
  className?: string;
}

// Hand-built recreation of the Stampd mark (2x2 stamp-card grid: three
// outline circles + one filled "stamped" circle). Colors are fixed, not
// tenant-themed — this is the platform's own identity, distinct from
// --brand/--plat which theme per-tenant UI.
export function StampdLogo({ size = 24, tile = false, className = "" }: StampdLogoProps) {
  const iconSize = tile ? Math.round(size * 0.64) : size;

  const mark = (
    <svg
      viewBox="0 0 100 100"
      width={iconSize}
      height={iconSize}
      className={tile ? "" : className}
      aria-hidden="true"
    >
      <g stroke="#1F1B18" strokeWidth="6" fill="none" strokeLinecap="round">
        <circle cx="27" cy="27" r="15" />
        <circle cx="73" cy="27" r="15" />
        <circle cx="27" cy="73" r="15" />
        <line x1="50" y1="6" x2="50" y2="94" />
        <line x1="6" y1="50" x2="94" y2="50" />
      </g>
      <circle cx="73" cy="73" r="15" fill="#C15D2C" />
    </svg>
  );

  if (!tile) return mark;

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-[22%] ${className}`}
      style={{ width: size, height: size, background: "#F3ECE2" }}
    >
      {mark}
    </div>
  );
}
