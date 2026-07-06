import type { Child, FC } from 'hono/jsx';

export const StartChapterHead: FC<{ n: string; id: string; children: Child }> = ({ n, id, children }) => (
  <div class="start-chapter-head" id={id}>
    <span class="start-ch-num">{n}</span>
    <h2>{children}</h2>
    <span class="start-ch-rule" aria-hidden="true" />
  </div>
)

export const WebWireframe: FC = () => (
  <svg class="start-wire" viewBox="0 0 128 72" aria-hidden="true">
    <rect x="6" y="6" width="116" height="60" rx="2" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45" />
    <rect x="14" y="14" width="36" height="5" rx="1" fill="currentColor" opacity="0.35" />
    <rect x="58" y="14" width="20" height="5" rx="1" fill="currentColor" opacity="0.2" />
    <rect x="14" y="26" width="100" height="28" rx="1" fill="currentColor" opacity="0.1" />
    <rect x="14" y="58" width="44" height="4" rx="1" fill="currentColor" opacity="0.25" />
  </svg>
)

export const ApiWireframe: FC = () => (
  <svg class="start-wire api" viewBox="0 0 128 72" aria-hidden="true">
    <rect x="6" y="6" width="116" height="60" rx="2" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35" />
    <text x="16" y="28" fill="currentColor" font-family="ui-monospace, monospace" font-size="10">{`{`}</text>
    <text x="24" y="42" fill="currentColor" font-family="ui-monospace, monospace" font-size="8" opacity="0.65">"temp": 14.2</text>
    <text x="16" y="56" fill="currentColor" font-family="ui-monospace, monospace" font-size="10">{`}`}</text>
  </svg>
)

/** Schematic: app → request → API → JSON back. Instrument-line art, theme-aware via CSS. */
export const StartFlowDiagram: FC = () => (
  <figure class="start-fig" aria-label="Your app sends a web request to an API address; the API replies with JSON data you can use">
    <span class="start-fig-tick tl" aria-hidden="true" />
    <span class="start-fig-tick br" aria-hidden="true" />
    <svg class="start-svg start-svg-desk" viewBox="0 0 640 186" aria-hidden="true">
      <rect class="start-box" x="20" y="58" width="120" height="68" rx="3" />
      <text class="start-svg-label" x="80" y="88">your project</text>
      <text class="start-svg-k" x="80" y="108">site · app · sheet</text>
      <path class="start-arrow" d="M140 92 H196" marker-end="url(#start-arr)" />
      <text class="start-svg-k" x="168" y="48" text-anchor="middle">GET request</text>
      <text class="start-svg-mono" x="168" y="144" text-anchor="middle">/forecast?city=…</text>
      <rect class="start-box accent" x="204" y="58" width="136" height="68" rx="3" />
      <g class="start-bars" transform="translate(259, 64)">
        <rect width="6" height="8" rx="3" class="start-bar" />
        <rect x="10" width="6" height="13" rx="3" class="start-bar" />
        <rect x="20" width="6" height="18" rx="3" class="start-bar" />
      </g>
      <text class="start-svg-label" x="272" y="100">API server</text>
      <text class="start-svg-k" x="272" y="115">on the internet</text>
      <path class="start-arrow" d="M340 92 H396" marker-end="url(#start-arr)" />
      <text class="start-svg-k" x="368" y="48" text-anchor="middle">JSON answer</text>
      <text class="start-svg-mono" x="368" y="144" text-anchor="middle">{'{ temp: 14.2 }'}</text>
      <rect class="start-box" x="404" y="58" width="120" height="68" rx="3" />
      <text class="start-svg-label" x="464" y="88">you use it</text>
      <text class="start-svg-k" x="464" y="108">show · chart · store</text>
      <line class="start-rule" x1="20" y1="158" x2="620" y2="158" />
      <text class="start-svg-k" x="320" y="176" text-anchor="middle">no login page · no graphics · just the live facts you asked for</text>
      <defs>
        <marker id="start-arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path class="start-arrow-head" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
    </svg>
    <svg class="start-svg start-svg-mob" viewBox="0 0 240 312" role="img" aria-hidden="true">
      <rect class="start-box" x="30" y="8" width="180" height="54" rx="3" />
      <text class="start-svg-label" x="120" y="32">your project</text>
      <text class="start-svg-k" x="120" y="48">site · app · sheet</text>
      <path class="start-arrow" d="M120 62 V88" marker-end="url(#start-arr-m1)" />
      <text class="start-svg-k" x="120" y="78" text-anchor="middle">GET request</text>
      <rect class="start-box accent" x="30" y="96" width="180" height="54" rx="3" />
      <g class="start-bars" transform="translate(107, 104)">
        <rect width="5" height="7" rx="2.5" class="start-bar" />
        <rect x="9" width="5" height="11" rx="2.5" class="start-bar" />
        <rect x="18" width="5" height="14" rx="2.5" class="start-bar" />
      </g>
      <text class="start-svg-label" x="120" y="128">API server</text>
      <text class="start-svg-k" x="120" y="144">on the internet</text>
      <path class="start-arrow" d="M120 150 V176" marker-end="url(#start-arr-m1)" />
      <text class="start-svg-k" x="120" y="166" text-anchor="middle">JSON answer</text>
      <rect class="start-box" x="30" y="184" width="180" height="54" rx="3" />
      <text class="start-svg-label" x="120" y="208">you use it</text>
      <text class="start-svg-k" x="120" y="224">show · chart · store</text>
      <line class="start-rule" x1="24" y1="252" x2="216" y2="252" />
      <text class="start-svg-k" x="120" y="272" text-anchor="middle">live facts · no login page</text>
      <defs>
        <marker id="start-arr-m1" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path class="start-arrow-head" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
    </svg>
    <figcaption class="k">ask at a url · get structured data back</figcaption>
  </figure>
)

/** How shipapis fits: scheduled probes → health scores on each listing. */
export const StartMonitorDiagram: FC = () => (
  <figure class="start-fig" aria-label="shipapis sends scheduled checks to free API endpoints and records uptime and speed on each listing">
    <span class="start-fig-tick tl" aria-hidden="true" />
    <span class="start-fig-tick br" aria-hidden="true" />
    <svg class="start-svg start-svg-desk" viewBox="0 0 640 160" aria-hidden="true">
      <rect class="start-box accent" x="24" y="40" width="148" height="76" rx="3" />
      <g class="start-bars" transform="translate(82, 48)">
        <rect width="6" height="8" rx="3" class="start-bar" />
        <rect x="10" width="6" height="13" rx="3" class="start-bar" />
        <rect x="20" width="6" height="17" rx="3" class="start-bar" />
      </g>
      <text class="start-svg-label" x="98" y="82">shipapis</text>
      <text class="start-svg-k" x="98" y="98">scheduled probe</text>
      <path class="start-arrow" d="M172 78 H264" marker-end="url(#start-arr2)" />
      <text class="start-svg-k" x="218" y="32" text-anchor="middle">HTTP check</text>
      <text class="start-svg-mono" x="218" y="128" text-anchor="middle">every ~90 min</text>
      <rect class="start-box" x="272" y="40" width="148" height="76" rx="3" />
      <text class="start-svg-label" x="346" y="72">free API</text>
      <text class="start-svg-k" x="346" y="92">provider endpoint</text>
      <path class="start-arrow return" d="M420 96 H332" marker-end="url(#start-arr-ret)" />
      <text class="start-svg-k" x="376" y="128" text-anchor="middle">200 OK · latency · shape</text>
      <rect class="start-box" x="444" y="40" width="168" height="76" rx="3" />
      <circle class="start-dot ok" cx="468" cy="64" r="4" />
      <text class="start-svg-label" x="528" y="72">listing page</text>
      <text class="start-svg-k" x="528" y="92">score · uptime · status</text>
      <defs>
        <marker id="start-arr2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path class="start-arrow-head" d="M0 0 L8 4 L0 8 Z" />
        </marker>
        <marker id="start-arr-ret" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path class="start-arrow-head return" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
    </svg>
    <svg class="start-svg start-svg-mob" viewBox="0 0 240 300" role="img" aria-hidden="true">
      <rect class="start-box accent" x="30" y="8" width="180" height="52" rx="3" />
      <g class="start-bars" transform="translate(107, 14)">
        <rect width="6" height="9" rx="3" class="start-bar" />
        <rect x="10" width="6" height="13" rx="3" class="start-bar" />
        <rect x="20" width="6" height="17" rx="3" class="start-bar" />
      </g>
      <text class="start-svg-label" x="120" y="36">shipapis</text>
      <text class="start-svg-k" x="120" y="46">scheduled probe</text>
      <path class="start-arrow" d="M120 60 V82" marker-end="url(#start-arr-m2)" />
      <text class="start-svg-k" x="120" y="74" text-anchor="middle">HTTP check</text>
      <rect class="start-box" x="30" y="90" width="180" height="52" rx="3" />
      <text class="start-svg-label" x="120" y="112">free API</text>
      <text class="start-svg-k" x="120" y="128">provider endpoint</text>
      <path class="start-arrow" d="M120 142 V168" marker-end="url(#start-arr-m2)" />
      <text class="start-svg-k" x="120" y="158" text-anchor="middle">200 OK · latency · shape</text>
      <rect class="start-box" x="30" y="176" width="180" height="52" rx="3" />
      <circle class="start-dot ok" cx="48" cy="192" r="4" />
      <text class="start-svg-label" x="120" y="198">listing page</text>
      <text class="start-svg-k" x="120" y="214">score · uptime · status</text>
      <defs>
        <marker id="start-arr-m2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path class="start-arrow-head" d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
    </svg>
    <figcaption class="k">we ping them so you don't ship on a dead link</figcaption>
  </figure>
)
