import type { FC } from 'hono/jsx'
import type { SubscriberRow } from '../../../data/admin-queries'
import { AdminLayout } from '../../layout/AdminLayout'
import { Card, Chip, Empty, FilterTabs, StatTile, When } from './parts'

export const AdminSubscribers: FC<{
  rows: SubscriberRow[]
  stats: { active: number; unsubscribed: number; bounced: number; total: number; last30: number }
  status: string
  q: string
  now: number
  truncated: boolean
}> = ({ rows, stats, status, q, now, truncated }) => (
  <AdminLayout
    title="Subscribers"
    tab="subscribers"
    actions={
      <FilterTabs
        base="/admin/subscribers"
        param="status"
        active={status}
        tabs={[
          ['active', 'Active', stats.active],
          ['unsubscribed', 'Unsubscribed', stats.unsubscribed],
          ['bounced', 'Bounced', stats.bounced],
          ['all', 'All', stats.total],
        ]}
      />
    }
  >
    <div class="adm-stats">
      <StatTile label="Active" value={stats.active} sub="receiving the signal" tone="ok" />
      <StatTile label="Joined (30d)" value={stats.last30} sub="new signups" />
      <StatTile label="Unsubscribed" value={stats.unsubscribed} sub="opted out" tone="flat" />
      <StatTile label="Bounced" value={stats.bounced} sub="undeliverable" tone={stats.bounced ? 'warn' : 'flat'} />
    </div>

    <Card
      title="The list"
      hint="D1 is the source of truth. Sending happens in Resend — compose a broadcast there."
      actions={
        <>
          <form class="adm-search" method="get" action="/admin/subscribers">
            {status !== 'all' && <input type="hidden" name="status" value={status} />}
            <input type="search" name="q" value={q} placeholder="Search email…" aria-label="Search subscribers" />
            <button class="adm-btn adm-btn-sm" type="submit">
              Search
            </button>
          </form>
          <a
            class="adm-btn adm-btn-sm"
            href={`/admin/subscribers.csv?status=${encodeURIComponent(status)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          >
            Export CSV
          </a>
        </>
      }
    >
      {rows.length === 0 ? (
        <Empty title="No subscribers match" body={q ? `Nothing matching "${q}".` : 'The footer form feeds this list.'} />
      ) : (
        <>
          <div class="adm-table-scroll">
            <table class="adm-table adm-table-rows">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr>
                    <td class="adm-mono">{r.email}</td>
                    <td>
                      <Chip status={r.status} />
                    </td>
                    <td class="adm-dim">{r.source ?? '—'}</td>
                    <td>
                      <When iso={r.created_at} now={now} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && (
            <p class="adm-note">
              Showing the {rows.length} most recent. Narrow with search, or export the CSV for the full list.
            </p>
          )}
        </>
      )}
    </Card>
  </AdminLayout>
)
