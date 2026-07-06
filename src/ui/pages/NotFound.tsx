import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'

export const NotFound: FC = () => (
  <Layout title="404 — page not found · shipapis" desc="This page doesn't exist on shipapis." noindex>
    <div class="wrap" style="padding:120px 0;text-align:center">
      <span class="k">404 · NOT FOUND</span>
      <h1 style="font-size:34px;letter-spacing:-0.03em;margin-top:14px">This page isn't here.</h1>
      <p style="color:var(--text-2);margin-top:10px">
        Try the <a href="/browse" style="color:var(--accent)">API catalog</a> or check the{' '}
        <a href="/graveyard" style="color:var(--accent)">graveyard</a> for APIs that died.
      </p>
    </div>
  </Layout>
)
