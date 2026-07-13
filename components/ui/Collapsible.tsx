'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/icons';

interface CollapsibleProps {
  icon: ReactNode;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ icon, label, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-zinc-200 py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-zinc-700 hover:text-zinc-900"
        aria-expanded={open}
      >
        <span className="text-zinc-400">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronDownIcon
          className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="flex flex-col gap-3 pb-3 pl-6">{children}</div>}
    </div>
  );
}
