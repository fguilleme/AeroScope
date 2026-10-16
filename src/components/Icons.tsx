export function PlaneGlyph({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.1v-2l-8.5-5V3.6A1.6 1.6 0 0 0 12 2a1.6 1.6 0 0 0-1.5 1.6v5.5l-8.5 5v2l8.5-2.7V19l-2.2 1.5V22l3.7-1 3.7 1v-1.5L13.5 19v-5.6l8.5 2.7Z" fill="currentColor"/></svg>
}

export function LogoMark() {
  return <div className="logo-mark" aria-hidden="true"><span /><span /><i /></div>
}
