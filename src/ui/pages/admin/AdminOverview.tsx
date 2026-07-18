import type { FC } from 'hono/jsx'
import { AdminLayout } from '../../layout/AdminLayout'
import { Card, Chip, Empty, StatTile, When } from './parts'

export interface OverviewData {
  submissions: Record<string, number>
  subscribers: { active: number; unsubscribed: number; bounced: number; total: number; last30: number }
  catalog: { total: number; monitored: number; approvedHere: number }
  audit: Array<{ action: string; subject: string | null; detail: string | null; created_at: string }>
  now: number
}

export const AdminOverview: FC<{ data: OverviewData }> = ({ data }) => {
  const pending = data.submissions.pending ?? 0
  const s = data.subscribers
  return (
    <AdminLayout title="Overview" tab="overview" pending={pending}>
      <div class="adm-stats">
        <StatTile
          label="Awaiting review"
          value={pending}
          sub={pending ? 'in the queue now' : 'queue is clear'}
          tone={pending ? 'warn' : 'ok'}
        />
        <StatTile label="Active subscribers" value={s.active} sub={`${s.last30} joined in 30d`} tone="ok" />
        <StatTile label="APIs in catalog" value={data.catalog.total} sub={`${data.catalog.monitored} probed`} />
        <StatTile
          label="Approved here"
          value={data.catalog.approvedHere}
          sub="added via this console"
        />
      </div>

      <div class="adm-grid-2">
        <Card
          title="Review queue"
          hint="Approving writes a real catalog row and schedules the API for probing."
          actions={
            <a class="adm-btn" href="/admin/submissions">
              Open queue
            </a>
          }
        >
          <dl class="adm-kv">
            <div>
              <dt>Pending</dt>
              <dd class="num">{data.submissions.pending ?? 0}</dd>
            </div>
            <div>
              <dt>Approved</dt>
              <dd class="num">{data.submissions.approved ?? 0}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd class="num">{data.submissions.rejected ?? 0}</dd>
            </div>
            <div>
              <dt>Spam</dt>
              <dd class="num">{data.submissions.spam ?? 0}</dd>
            </div>
          </dl>
        </Card>

        <Card
          title="The signal"
          hint="D1 is the source of truth; Resend sends. Broadcasts are composed in the Resend dashboard."
          actions={
            <a class="adm-btn" href="/admin/subscribers">
              View list
            </a>
          }
        >
          <dl class="adm-kv">
            <div>
              <dt>Active</dt>
              <dd class="num">{s.active}</dd>
            </div>
            <div>
              <dt>Unsubscribed</dt>
              <dd class="num">{s.unsubscribed}</dd>
            </div>
            <div>
              <dt>Bounced</dt>
              <dd class="num">{s.bounced}</dd>
            </div>
            <div>
              <dt>Total ever</dt>
              <dd class="num">{s.total}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Recent activity" hint="Every approval, rejection and sign-in, most recent first.">
        {data.audit.length === 0 ? (
          <Empty title="Nothing logged yet" body="Actions you take in this console will appear here." />
        ) : (
          <table class="adm-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Subject</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map((a) => (
                <tr>
                  <td>
                    <Chip status={a.action} />
                  </td>
                  <td class="adm-mono">{a.subject ?? '—'}</td>
                  <td class="adm-dim">{a.detail ?? '—'}</td>
                  <td>
                    <When iso={a.created_at} now={data.now} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminLayout>
  )
}
