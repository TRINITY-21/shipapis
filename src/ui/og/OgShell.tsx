import type { FC } from 'hono/jsx'

import type { Child } from 'hono/jsx'

export const OgShell: FC<{ children?: Child }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>OG render target — shipapis</title>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body class="og-body">{children}</body>
  </html>
)
