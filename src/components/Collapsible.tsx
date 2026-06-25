// Rozwijana sekcja — „dodatki ukryte": domyślnie zwinięta, otwierana jednym
// dotykiem. Klucz do intuicyjnego UI (podstawy na wierzchu, reszta schowana).
import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  defaultOpen?: boolean;
  badge?: string | number;
  children: ReactNode;
}

export function Collapsible({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" onClick={() => setOpen((v) => !v)}>
        {icon && <span className="collapsible-icon">{icon}</span>}
        <span className="collapsible-title">
          {title}
          {subtitle && <span className="collapsible-sub">{subtitle}</span>}
        </span>
        {badge != null && badge !== '' && <span className="collapsible-badge">{badge}</span>}
        <span className="collapsible-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
