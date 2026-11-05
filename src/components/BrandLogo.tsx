import { useId } from "react";

/** Vector reconstruction of the supplied visual reference, not an original logo asset. */
export function BrandMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const dots = [];
  for (let row = 0; row < 10; row++) {
    const y = 18 + row * 6;
    for (let col = 0; col < 19; col++) {
      const x = 51 + col * 6.7;
      const distance = ((x - 114) / 65) ** 2 + ((y - 68) / 53) ** 2;
      if (distance <= 1 && x + y < 237) dots.push(<ellipse key={`${row}-${col}`} cx={x} cy={y} rx={1.15 + row * .14} ry={1.05 + row * .1} transform={`rotate(-24 ${x} ${y})`} opacity={.55 + col * .022} />);
    }
  }
  return <svg className={`brand-mark ${className}`} viewBox="0 0 220 180" fill="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-ink`} x1="55" y1="50" x2="170" y2="153" gradientUnits="userSpaceOnUse"><stop stopColor="#00985e"/><stop offset="1" stopColor="#07392f"/></linearGradient><linearGradient id={`${id}-orbit`} x1="15" y1="145" x2="207" y2="45" gradientUnits="userSpaceOnUse"><stop stopColor="#00844d"/><stop offset=".55" stopColor="#30ad3b"/><stop offset="1" stopColor="#9cdb24"/></linearGradient></defs>
    <g fill={`url(#${id}-orbit)`}>{dots}</g>
    <ellipse cx="110" cy="113" rx="101" ry="30" transform="rotate(-25 110 113)" stroke={`url(#${id}-orbit)`} strokeWidth="7"/>
    <path d="M45 143 108 66H133L151 142H127L117 91 71 143Z" fill={`url(#${id}-ink)`}/>
    <path d="M157 66H183L160 151H134Z" fill={`url(#${id}-ink)`}/>
    <path d="M78 129h6v13h-6zm10-8h6v21h-6zm10-9h6v30h-6z" fill="#279b48"/>
    <path d="M16 146C36 183 188 118 205 77" stroke={`url(#${id}-orbit)`} strokeWidth="8" strokeLinecap="round"/>
    <path d="m198 48 3 12 11 3-12 4-4 14-2-14-10-3 11-4Z" fill="#89ce2c"/>
  </svg>;
}
export default function BrandLogo({ large = false }: { large?: boolean }) {
  return <span className={`brand-lockup${large ? " brand-lockup-large" : ""}`}><BrandMark/><span className="brand-divider"/><span className="brand-wordmark"><strong>智点未来</strong><span>AI 广告服务</span></span></span>;
}
