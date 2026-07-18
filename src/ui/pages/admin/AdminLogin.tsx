import type { FC } from 'hono/jsx'
import { Logo } from '../../components/Logo'
import { AdminAuthLayout } from '../../layout/AdminLayout'

export const AdminLogin: FC<{ error?: string; next?: string }> = ({ error, next }) => (
  <AdminAuthLayout title="Sign in">
    <main class="adm-auth">
      <form class="adm-auth-card" method="post" action="/admin/login">
        <div class="adm-auth-brand">
          <Logo size={26} />
          <div>
            <b>shipapis</b>
            <span class="k">operator console</span>
          </div>
        </div>

        <p class="adm-auth-lede">
          This console reviews submissions and reads the subscriber list. It is not part of the public
          site and is excluded from analytics and search.
        </p>

        {error && (
          <div class="adm-alert adm-alert-bad" role="alert">
            {error}
          </div>
        )}

        <label class="adm-field">
          <span class="k">Password</span>
          {/* Single-operator console: no username to enumerate, so the password is the whole factor. */}
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            required
            autofocus
            aria-label="Admin password"
          />
        </label>
        {next && <input type="hidden" name="next" value={next} />}

        <button class="adm-btn adm-btn-primary adm-btn-block" type="submit">
          Sign in
        </button>

        <p class="adm-auth-foot k">
          Sessions last 12 hours · <a href="/">back to shipapis.dev</a>
        </p>
      </form>
    </main>
  </AdminAuthLayout>
)
