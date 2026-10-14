import { hostOf } from '../lib/recent'
import type { Recent } from '../lib/store'
import { ago } from '../lib/time'

export function RecentList({ items, now, onPick, onClear }: { items: Recent[]; now: number; onPick: (url: string) => void; onClear: () => void }) {
  return (
    <section className="recent" aria-labelledby="recent-title">
      <div className="section-head">
        <h2 id="recent-title" className="section-title">
          Recent
        </h2>
        {items.length > 0 && (
          <button type="button" className="text-button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="recent-empty">Links you fetch show up here. Only the address, title and time are kept, in this browser.</p>
      ) : (
        <ul className="recent-list">
          {items.map((r) => (
            <li key={r.url}>
              <button type="button" className="recent-item" onClick={() => onPick(r.url)}>
                <span className="recent-title">{r.title || hostOf(r.url)}</span>
                <span className="recent-meta">
                  {hostOf(r.url)} · {ago(r.at, now)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
