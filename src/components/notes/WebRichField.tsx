import { createElement, useEffect, useLayoutEffect, useRef } from 'react';
import { sizePx, type RunStyle } from '@/utils/richText';

// Pole notatki na KOMPUTERZE (2026-11-16, user: "na wersji komputerowej te notatki też
// popraw jak na telefonie"). RN-web nie pokazuje stylowanych dzieci w TextInput, więc
// na web edycja jest w `contentEditable` div, a formatowanie widać od razu (jak na
// telefonie). Model zostaje ten sam: tekst + odcinki (utils/richText.ts) — DOM tylko
// go wyświetla. Każda zmiana: tekst z DOM → rodzic liczy odcinki (onTextEdit) → nowy
// HTML → kursor wraca na miejsce. Enter i wklejanie obsługujemy sami (zwykły tekst
// z "\n"), żeby przeglądarka nie wstawiała <div>/<br> do treści.
type Seg = { t: string; st: RunStyle };
export interface Sel { start: number; end: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function css(st: RunStyle): string {
  const out: string[] = [];
  if (st.b) out.push("font-family:Inter_800ExtraBold,system-ui,sans-serif");
  if (st.i) out.push('font-style:italic');
  if (st.u) out.push('text-decoration:underline');
  if (st.c) out.push(`color:${st.c}`);
  if (st.h) out.push(`background-color:${st.h}`);
  if (st.z != null) { const px = sizePx(st.z); out.push(`font-size:${px}px;line-height:${Math.round(px * 1.4)}px`); }
  return out.join(';');
}

export function segsToHtml(segs: Seg[]): string {
  const body = segs.map((g) => {
    const style = css(g.st);
    return style ? `<span style="${style}">${esc(g.t)}</span>` : `<span>${esc(g.t)}</span>`;
  }).join('');
  const text = segs.map((g) => g.t).join('');
  // Pusta ostatnia linia nie miałaby wysokości — <br> nie wchodzi do textContent.
  return text.endsWith('\n') ? `${body}<br>` : body;
}

function getSel(el: HTMLElement): Sel | null {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0) return null;
  const r = s.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  pre.setEnd(r.endContainer, r.endOffset);
  return { start, end: pre.toString().length };
}

function locate(el: HTMLElement, pos: number): { node: Node; offset: number } {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = pos;
  let last: Text | null = null;
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    const len = n.data.length;
    if (left <= len) return { node: n, offset: left };
    left -= len;
    last = n;
  }
  return last ? { node: last, offset: last.data.length } : { node: el, offset: 0 };
}

function setSel(el: HTMLElement, sel: Sel) {
  const s = window.getSelection();
  if (!s) return;
  const a = locate(el, sel.start), b = locate(el, sel.end);
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  s.removeAllRanges();
  s.addRange(r);
}

export default function WebRichField({ segs, text, onInput, onSelect, onKey, editable, minHeight, autoFocus, focusTick, placeholder }: {
  segs: Seg[];
  text: string;
  onInput: (t: string) => void;
  onSelect: (sel: Sel) => void;
  onKey?: (k: 'b' | 'i' | 'u') => void;
  editable: boolean;
  minHeight?: number;
  autoFocus?: boolean;
  focusTick?: number;      // rośnie po akcji z paska — przywróć fokus i zaznaczenie
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const shown = useRef<string | null>(null);
  const lastSel = useRef<Sel>({ start: text.length, end: text.length });
  const caretNext = useRef<Sel | null>(null);
  const composing = useRef(false);
  const html = segsToHtml(segs);

  // Tekst w DOM po ostatnim wpisaniu. Przy szybkim pisaniu render z poprzednim
  // (starszym) tekstem przyszedłby, gdy DOM ma już kolejne litery — nadpisanie
  // cofnęłoby kursor. Czekamy, aż model dogoni DOM.
  const typed = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown.current === html) return;
    const dom = el.textContent ?? '';
    if (typed.current != null && dom === typed.current && text !== typed.current) return;
    const focused = document.activeElement === el;
    const keep = focused && dom === text ? getSel(el) : caretNext.current ?? (focused ? getSel(el) : null);
    el.innerHTML = html;
    shown.current = html;
    typed.current = null;
    if (keep && (focused || caretNext.current)) setSel(el, keep);
    caretNext.current = null;
  });

  useEffect(() => {
    const el = ref.current;
    if (!focusTick || !el) return;
    // Skrót z klawiatury: pole ma fokus, zaznaczenie z DOM jest aktualne.
    const cur = document.activeElement === el ? getSel(el) : null;
    el.focus();
    setSel(el, cur ?? lastSel.current);
  }, [focusTick]);

  // Zaznaczenie z DOM teraz (selectionchange przychodzi z opóźnieniem).
  const syncSel = () => {
    const el = ref.current;
    const s = el ? getSel(el) : null;
    if (s) { lastSel.current = s; onSelect(s); }
    return s;
  };

  useEffect(() => {
    if (autoFocus && ref.current) { ref.current.focus(); setSel(ref.current, { start: text.length, end: text.length }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSelChange = () => {
      const el = ref.current;
      if (!el || document.activeElement !== el) return;
      const s = getSel(el);
      if (s) { lastSel.current = s; onSelect(s); }
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [onSelect]);

  // Wstawienie zwykłego tekstu w miejsce zaznaczenia (Enter, wklejanie).
  const insert = (s: string) => {
    const el = ref.current;
    if (!el) return;
    const sel = getSel(el) ?? lastSel.current;
    const next = text.slice(0, sel.start) + s + text.slice(sel.end);
    const at = sel.start + s.length;
    caretNext.current = { start: at, end: at };
    lastSel.current = caretNext.current;
    onSelect({ start: sel.start, end: sel.start });
    onInput(next);
  };

  return createElement('div', { style: { position: 'relative' } },
    !text && placeholder ? createElement('div', {
      style: { position: 'absolute', left: 16, top: 12, color: '#6E6E6E', pointerEvents: 'none', fontSize: 16, fontFamily: 'Inter_500Medium, system-ui, sans-serif' },
    }, placeholder) : null,
    createElement('div', {
      ref,
      contentEditable: editable,
      suppressContentEditableWarning: true,
      spellCheck: true,
      role: 'textbox',
      'aria-multiline': true,
      style: {
        minHeight, outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        padding: '12px 16px 40px', color: '#D6D6D6', fontSize: 16, lineHeight: '24px',
        fontFamily: 'Inter_500Medium, system-ui, sans-serif', caretColor: '#F2F2F2', cursor: editable ? 'text' : 'default',
      },
      onInput: () => {
        const el = ref.current;
        if (!el || composing.current) return;
        const s = syncSel();
        if (s) caretNext.current = s;
        typed.current = el.textContent ?? '';
        onInput(typed.current);
      },
      onCompositionStart: () => { composing.current = true; },
      onCompositionEnd: () => {
        composing.current = false;
        const el = ref.current;
        if (!el) return;
        const s = syncSel();
        if (s) caretNext.current = s;
        typed.current = el.textContent ?? '';
        onInput(typed.current);
      },
      onKeyDown: (e: any) => {
        if (e.key === 'Enter') { e.preventDefault(); insert('\n'); return; }
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey && onKey) {
          const k = String(e.key).toLowerCase();
          if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); syncSel(); onKey(k); }
        }
      },
      onPaste: (e: any) => {
        e.preventDefault();
        const t = e.clipboardData?.getData('text/plain') ?? '';
        if (t) insert(t.replace(/\r\n?/g, '\n'));
      },
      onDrop: (e: any) => e.preventDefault(),
    }),
  );
}
