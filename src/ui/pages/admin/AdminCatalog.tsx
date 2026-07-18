import type { FC } from 'hono/jsx'
import { AdminLayout } from '../../layout/AdminLayout'
import { Card, Chip, Empty, When } from './parts'

export interface ApprovedRow {
  slug: string
  name: string
  emoji: string
  status: string
  health_score: number | null
  added_at: string
  monitored_since: string | null
  last_checked_at: string | null
  category: string
}

export const AdminCatalog: FC<{ rows: ApprovedRow[]; now: number }> = ({ rows, now }) => (
  <AdminLayout title="Approved APIs" tab="catalog">
    <Card
      title="Added through this console"
      hint="Live on the site immediately; health appears once the checker has probed them."
    >
      {rows.length === 0 ? (
        <Empty title="Nothing approved yet" body="APIs you approve from the submissions queue show up here." />
      ) : (
        <div class="adm-table-scroll">
          <table class="adm-table adm-table-rows">
            <thead>
              <tr>
                <th>API</th>
                <th>Category</th>
                <th>Status</th>
                <th>Score</th>
                <th>Added</th>
                <th>Last checked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td>
                    <div class="adm-cell-main">
                      <b>
                        {r.emoji} {r.name}
                      </b>
                      <span class="adm-mono adm-dim">/api/{r.slug}</span>
                    </div>
                  </td>
                  <td>{r.category}</td>
                  <td>
                    <Chip status={r.status} />
                  </td>
                  {/* -1 and null both mean "not scored yet" — never render a number we didn't measure. */}
                  <td class="num">{r.health_score == null || r.health_score < 0 ? <span class="adm-muted">—</span> : r.health_score}</td>
                  <td>
                    <When iso={r.added_at} now={now} />
                  </td>
                  <td>
                    {r.last_checked_at ? <When iso={r.last_checked_at} now={now} /> : <span class="adm-muted">not yet probed</span>}
                  </td>
                  <td class="adm-cell-action">
                    <a class="adm-btn adm-btn-sm" href={`/api/${r.slug}`} target="_blank" rel="noopener">
                      View ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  </AdminLayout>
)
