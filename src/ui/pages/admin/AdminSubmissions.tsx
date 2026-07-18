import type { FC } from 'hono/jsx'
import { parseMeta, type SubmissionRow } from '../../../data/admin-queries'
import { AdminLayout } from '../../layout/AdminLayout'
import { Card, Chip, Empty, FilterTabs, When } from './parts'

export const AdminSubmissions: FC<{
  rows: SubmissionRow[]
  counts: Record<string, number>
  status: string
  now: number
  flash?: { kind: 'ok' | 'bad'; message: string }
}> = ({ rows, counts, status, now, flash }) => (
  <AdminLayout
    title="Submissions"
    tab="submissions"
    pending={counts.pending ?? 0}
    actions={
      <FilterTabs
        base="/admin/submissions"
        param="status"
        active={status}
        tabs={[
          ['pending', 'Pending', counts.pending ?? 0],
          ['approved', 'Approved', counts.approved ?? 0],
          ['rejected', 'Rejected', counts.rejected ?? 0],
          ['spam', 'Spam', counts.spam ?? 0],
          ['all', 'All'],
        ]}
      />
    }
  >
    {flash && (
      <div class={`adm-alert adm-alert-${flash.kind === 'ok' ? 'good' : 'bad'}`} role="status">
        {flash.message}
      </div>
    )}

    <Card>
      {rows.length === 0 ? (
        <Empty
          title={status === 'pending' ? 'Queue is clear' : 'Nothing here'}
          body={status === 'pending' ? 'New submissions from /submit land here for review.' : 'No submissions with this status.'}
        />
      ) : (
        <div class="adm-table-scroll">
          <table class="adm-table adm-table-rows">
            <thead>
              <tr>
                <th>API</th>
                <th>Category</th>
                <th>Auth</th>
                <th>Submitter</th>
                <th>Received</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = parseMeta(r)
                // The form stores an unrecognised category as "?slug" — surface that, don't hide it.
                const cat = meta.category ?? '—'
                return (
                  <tr>
                    <td>
                      <div class="adm-cell-main">
                        <b>{r.name}</b>
                        {r.endpoint_url && <span class="adm-mono adm-dim">{r.endpoint_url}</span>}
                      </div>
                    </td>
                    <td>{cat.startsWith('?') ? <span class="adm-warn-text">{cat.slice(1)} (unknown)</span> : cat}</td>
                    <td class="adm-mono">{r.auth_type ?? 'none'}</td>
                    <td class="adm-mono adm-dim">{r.submitter_email ?? '—'}</td>
                    <td>
                      <When iso={r.created_at} now={now} />
                    </td>
                    <td>
                      <Chip status={r.status} />
                    </td>
                    <td class="adm-cell-action">
                      {r.status === 'approved' && r.approved_slug ? (
                        <a class="adm-btn adm-btn-sm" href={`/api/${r.approved_slug}`} target="_blank" rel="noopener">
                          View live ↗
                        </a>
                      ) : (
                        <a class="adm-btn adm-btn-sm adm-btn-primary" href={`/admin/submissions/${r.id}`}>
                          Review
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  </AdminLayout>
)
