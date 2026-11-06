"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

export type TopicOption = { id: string; title: string; progress: string };

type Props = {
  // The id of the visible label above the dropdown.
  labelId: string;
  options: TopicOption[];
  value: string;
  onChange: (id: string) => void;
};

// The topic picker on Home. A native select opens the phone's own dark popup, so this is a listbox in the site's style, the
// same on phone and laptop. Focus sits on the list while it is open, and the arrow keys move the active option.
export function TopicDropdown({ labelId, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const selected = options.find((o) => o.id === value);
  const optionId = (i: number) => `${baseId}-option-${i}`;

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on baseId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function show() {
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(id: string) {
    if (id !== value) onChange(id);
    close();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show();
    }
  }

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const moves: Record<string, number> = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) choose(options[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="topic-pick" ref={root}>
      <button
        ref={trigger}
        id={`${baseId}-trigger`}
        type="button"
        className="select topic-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-labelledby={`${labelId} ${baseId}-trigger`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onTriggerKey}
      >
        <span className="topic-trigger-text">{selected?.title}</span>
        {selected ? <span className="topic-count">{selected.progress}</span> : null}
        <ChevronDown className="ico topic-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul ref={list} id={`${baseId}-list`} className="topic-menu" role="listbox" tabIndex={-1} aria-labelledby={labelId} aria-activedescendant={optionId(active)} onKeyDown={onListKey}>
          {options.map((o, i) => (
            <li
              key={o.id}
              id={optionId(i)}
              role="option"
              aria-selected={o.id === value}
              className={`topic-option${i === active ? " topic-option-active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o.id)}
            >
              <span>{o.title}</span>
              <span className="topic-count">{o.progress}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
