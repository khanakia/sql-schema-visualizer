// Tiny safe markdown → React renderer. No deps, no dangerouslySetInnerHTML.
// Used for table + column `/​* @doc ... *​/` descriptions, where we need
// just enough markdown to make prose readable: headings, lists, bold/
// italic, inline + fenced code, links, paragraphs, line breaks.
//
// Add `marked` + DOMPurify (~50KB) only if you need full CommonMark
// (tables, footnotes, autolinks, etc). For our use case this stays
// tight (~120 LOC) and the attack surface is exactly what we emit.

import { Fragment, type ReactNode } from 'react'

/** Render a markdown string as a React tree. Block-level handling
 *  (paragraphs, headings, lists, fenced code) plus inline emphasis,
 *  code, and links. Returns a Fragment so the caller can wrap it in
 *  any container they like. */
export function renderMarkdown(src: string): ReactNode {
  const blocks = splitBlocks(src)
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>
}

/** Split source into block-level chunks: blank lines separate blocks,
 *  fenced ``` ``` ``` code blocks survive as one unit. */
function splitBlocks(src: string): string[] {
  const lines = src.split('\n')
  const out: string[] = []
  let buf: string[] = []
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      buf.push(line)
      if (inFence) {
        out.push(buf.join('\n'))
        buf = []
        inFence = false
      } else {
        inFence = true
      }
      continue
    }
    if (inFence) {
      buf.push(line)
      continue
    }
    if (line.trim() === '') {
      if (buf.length) {
        out.push(buf.join('\n'))
        buf = []
      }
      continue
    }
    buf.push(line)
  }
  if (buf.length) out.push(buf.join('\n'))
  return out
}

function renderBlock(block: string, key: number): ReactNode {
  // Fenced code (preserves whitespace; no syntax highlighting).
  if (block.startsWith('```')) {
    const lines = block.split('\n')
    const code = lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n')
    return (
      <pre
        key={key}
        className="my-1 overflow-x-auto rounded bg-[var(--surface)] px-2 py-1 text-[10px] leading-relaxed text-[var(--text)]"
      >
        <code>{code}</code>
      </pre>
    )
  }

  // ATX heading (1-6 #'s). Start at h4 visually so it doesn't compete
  // with the page's own h1/h2.
  const h = block.match(/^(#{1,6})\s+(.*)$/)
  if (h && !h[2].includes('\n')) {
    const level = h[1].length
    const cls = [
      'mb-0.5 mt-2 text-[12px] font-semibold text-[var(--text-strong)]',
      'mb-0.5 mt-2 text-[11px] font-semibold text-[var(--text-strong)]',
      'mb-0.5 mt-1.5 text-[11px] font-semibold text-[var(--text)]',
      'mb-0.5 mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-soft)]',
      'mb-0.5 mt-1 text-[10px] font-semibold text-[var(--text-soft)]',
      'mb-0.5 mt-1 text-[10px] text-[var(--text-soft)]',
    ][Math.min(level - 1, 5)]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tag = (`h${Math.min(level + 3, 6)}` as unknown) as any
    return (
      <Tag key={key} className={cls}>
        {renderInline(h[2])}
      </Tag>
    )
  }

  // Lists — every line starts with the same marker.
  const lines = block.split('\n')
  if (lines.every((l) => /^[-*]\s+/.test(l))) {
    return (
      <ul key={key} className="my-1 list-disc pl-4 text-[11px] leading-relaxed">
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.replace(/^[-*]\s+/, ''))}</li>
        ))}
      </ul>
    )
  }
  if (lines.every((l) => /^\d+\.\s+/.test(l))) {
    return (
      <ol key={key} className="my-1 list-decimal pl-5 text-[11px] leading-relaxed">
        {lines.map((l, j) => (
          <li key={j}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    )
  }

  // Paragraph: single \n becomes a <br/>.
  return (
    <p key={key} className="my-1 text-[11px] leading-relaxed text-[var(--text)]">
      {lines.map((l, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(l)}
        </Fragment>
      ))}
    </p>
  )
}

/** Inline tokens: `code`, **bold**, *italic*, [text](url). Anything
 *  not matched is emitted as plain text. Links are restricted to
 *  http(s)/mailto/relative/fragment so `javascript:` etc can't sneak
 *  in via user-authored SQL. */
function renderInline(text: string): ReactNode {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) {
      out.push(
        <code
          key={key++}
          className="rounded bg-[var(--surface)] px-1 text-[10px] text-purple-300"
        >
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!
      const url = lm[2]
      const safe = /^(https?:|\/|#|mailto:)/i.test(url) ? url : '#'
      out.push(
        <a
          key={key++}
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-300 underline hover:text-purple-200"
        >
          {lm[1]}
        </a>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
