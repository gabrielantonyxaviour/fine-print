import type { ReactNode } from 'react';
import { normalize, VERDICT_LABEL, type LedgerEntry } from './data.ts';

interface Props {
  markdown: string;
  entries: LedgerEntry[];
  filter: string;
  onOpen: (entry: LedgerEntry) => void;
}

// Renders the policy Markdown and turns every sentence that matches a promise into a highlight.
export function Policy({ markdown, entries, filter, onOpen }: Props) {
  const byQuote = entries.map((e) => ({ entry: e, key: normalize(e.quote) }));
  const highlight = (text: string): ReactNode => {
    const hit = byQuote.find(({ key }) => normalize(text).includes(key));
    if (!hit) return text;
    const { entry } = hit;
    const dim = filter !== 'all' && entry.verdict !== filter;
    return (
      <button
        type="button"
        className={`promise v-${entry.verdict}${dim ? ' dim' : ''}`}
        id={entry.promiseId}
        onClick={() => onOpen(entry)}
        aria-label={`Section ${entry.section}, ${VERDICT_LABEL[entry.verdict]}: ${entry.quote}`}
      >
        <span className="badge">§{entry.section} · {VERDICT_LABEL[entry.verdict]}</span>
        {text}
      </button>
    );
  };

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`}>{list.map((item, i) => <li key={i}>{item}</li>)}</ul>);
    list = [];
  };
  markdown.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('- ')) { list.push(t.slice(2)); return; }
    flush();
    if (!t) return;
    if (t.startsWith('### ')) blocks.push(<h3 key={i}>{t.slice(4)}</h3>);
    else if (t.startsWith('## ')) blocks.push(<h2 key={i}>{t.slice(3)}</h2>);
    else if (t.startsWith('# ')) blocks.push(<h1 key={i} className="doc-title">{t.slice(2)}</h1>);
    else blocks.push(<p key={i}>{highlight(t)}</p>);
  });
  flush();
  return <article className="policy">{blocks}</article>;
}

// Quotes Fine Print extracted that do not appear verbatim in the document are listed, never dropped.
export function unmatched(markdown: string, entries: LedgerEntry[]): LedgerEntry[] {
  const doc = normalize(markdown);
  return entries.filter((e) => !doc.includes(normalize(e.quote)));
}
