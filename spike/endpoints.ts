// Week-1 validation spike sample — MASTERPLAN §12 rows #1/#2.
// ~100 real, popular free-API endpoints, hand-curated from the public-apis ecosystem.
// auth semantics:
//   'none'       keyless — a 2xx here counts toward the keyless-checkable rate
//   'keyed-demo' public demo key baked into the url — 2xx counts as keyless-checkable too
//   'keyed'      documented endpoint hit WITHOUT a key — the expected 401/403 proves the
//                server answers (server-up signal), it is NOT a health pass
// Etiquette: single GET per endpoint per run, no retries, identified UA. A few entries are
// deliberate canaries (challenge-prone, geo-blocked, quota-capped, or dead) — see notes.

export interface SpikeEndpoint {
  slug: string
  url: string
  expects: 'json' | 'any'
  auth: 'none' | 'keyed-demo' | 'keyed'
  notes?: string
}

export const ENDPOINTS: SpikeEndpoint[] = [
  // --- weather & environment ---------------------------------------------
  { slug: 'open-meteo', url: 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true', expects: 'json', auth: 'none' },
  { slug: 'weather-gov', url: 'https://api.weather.gov/points/39.7456,-97.0892', expects: 'json', auth: 'none', notes: 'NWS requires an identified UA — we send one' },
  { slug: 'seventimer', url: 'http://www.7timer.info/bin/astro.php?lon=13.4&lat=52.5&ac=0&unit=metric&output=json', expects: 'json', auth: 'none', notes: 'http-only' },
  { slug: 'sunrise-sunset', url: 'https://api.sunrise-sunset.org/json?lat=36.7201600&lng=-4.4203400', expects: 'json', auth: 'none' },
  { slug: 'usgs-earthquakes', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson', expects: 'json', auth: 'none' },
  { slug: 'carbon-intensity-uk', url: 'https://api.carbonintensity.org.uk/intensity', expects: 'json', auth: 'none' },
  { slug: 'openweathermap', url: 'https://api.openweathermap.org/data/2.5/weather?q=London', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'weatherapi', url: 'https://api.weatherapi.com/v1/current.json?q=London', expects: 'json', auth: 'keyed', notes: 'expect 401/403' },
  { slug: 'accuweather', url: 'https://dataservice.accuweather.com/locations/v1/cities/search?q=london', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'visualcrossing', url: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/London', expects: 'json', auth: 'keyed', notes: 'expect 4xx keyless' },

  // --- geocoding & IP ------------------------------------------------------
  { slug: 'nominatim', url: 'https://nominatim.openstreetmap.org/search?q=Brandenburg+Gate&format=json&limit=1', expects: 'json', auth: 'none', notes: 'OSMF policy demands an identified UA — ours qualifies' },
  { slug: 'zippopotam', url: 'https://api.zippopotam.us/us/90210', expects: 'json', auth: 'none' },
  { slug: 'postcodes-io', url: 'https://api.postcodes.io/postcodes/OX495NU', expects: 'json', auth: 'none' },
  { slug: 'ip-api', url: 'http://ip-api.com/json/8.8.8.8', expects: 'json', auth: 'none', notes: 'free tier is http-only by design' },
  { slug: 'ipapi-co', url: 'https://ipapi.co/8.8.8.8/json/', expects: 'json', auth: 'none', notes: 'Cloudflare-fronted, known bot-sensitive — challenge canary' },
  { slug: 'ipify', url: 'https://api.ipify.org/?format=json', expects: 'json', auth: 'none' },
  { slug: 'opencage', url: 'https://api.opencagedata.com/geocode/v1/json?q=Berlin', expects: 'json', auth: 'keyed', notes: 'expect 401/403' },
  { slug: 'mapbox', url: 'https://api.mapbox.com/geocoding/v5/mapbox.places/Berlin.json', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'locationiq', url: 'https://us1.locationiq.com/v1/search?q=Berlin&format=json', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'openrouteservice', url: 'https://api.openrouteservice.org/geocode/search?text=Berlin', expects: 'json', auth: 'keyed', notes: 'expect 401/403' },
  { slug: 'ipstack', url: 'http://api.ipstack.com/8.8.8.8', expects: 'json', auth: 'keyed', notes: 'apilayer — may answer 200 with an error body keyless' },

  // --- FX & crypto ----------------------------------------------------------
  { slug: 'frankfurter', url: 'https://api.frankfurter.app/latest', expects: 'json', auth: 'none' },
  { slug: 'er-api', url: 'https://open.er-api.com/v6/latest/USD', expects: 'json', auth: 'none' },
  { slug: 'exchangerate-host', url: 'https://api.exchangerate.host/live', expects: 'json', auth: 'keyed', notes: 'apilayer-run since 2023 — may 200 with error body keyless' },
  { slug: 'coingecko', url: 'https://api.coingecko.com/api/v3/ping', expects: 'json', auth: 'none', notes: 'Cloudflare-fronted + tight anon rate limits — challenge canary' },
  { slug: 'coinpaprika', url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin', expects: 'json', auth: 'none' },
  { slug: 'binance', url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', expects: 'json', auth: 'none', notes: 'geo-blocks US and some cloud regions (451) — geo canary' },
  { slug: 'polygon', url: 'https://api.polygon.io/v2/aggs/ticker/AAPL/prev', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'finnhub', url: 'https://finnhub.io/api/v1/quote?symbol=AAPL', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'alphavantage', url: 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=demo', expects: 'json', auth: 'keyed-demo', notes: 'documented demo key, valid for demo symbols only' },
  { slug: 'coindesk-bpi', url: 'https://api.coindesk.com/v1/bpi/currentprice.json', expects: 'json', auth: 'none', notes: 'RETIRED mid-2024 — deliberate dead control for dns/4xx classification' },

  // --- dev & code -----------------------------------------------------------
  { slug: 'github', url: 'https://api.github.com/repos/public-apis/public-apis', expects: 'json', auth: 'none', notes: '60 req/h per IP keyless — shared Worker egress may 403/429; quota canary' },
  { slug: 'npm-registry', url: 'https://registry.npmjs.org/react/latest', expects: 'json', auth: 'none' },
  { slug: 'pypi', url: 'https://pypi.org/pypi/requests/json', expects: 'json', auth: 'none' },
  { slug: 'crates-io', url: 'https://crates.io/api/v1/crates/serde', expects: 'json', auth: 'none', notes: 'requires an identified UA — we send one' },
  { slug: 'stackexchange', url: 'https://api.stackexchange.com/2.3/info?site=stackoverflow', expects: 'json', auth: 'none', notes: 'shared-IP daily quota — quota canary' },
  { slug: 'jsonplaceholder', url: 'https://jsonplaceholder.typicode.com/todos/1', expects: 'json', auth: 'none' },
  { slug: 'httpbin', url: 'https://httpbin.org/get', expects: 'json', auth: 'none', notes: 'community-run, flaky under load' },
  { slug: 'reddit', url: 'https://www.reddit.com/r/programming/about.json', expects: 'json', auth: 'none', notes: 'aggressively blocks datacenter IPs — challenge canary' },
  { slug: 'hackernews', url: 'https://hacker-news.firebaseio.com/v0/topstories.json', expects: 'json', auth: 'none' },

  // --- gov, science & space ------------------------------------------------
  { slug: 'restcountries', url: 'https://restcountries.com/v3.1/alpha/jp', expects: 'json', auth: 'none', notes: '/all requires ?fields since 2024 — use a scoped path' },
  { slug: 'worldbank', url: 'https://api.worldbank.org/v2/country/USA?format=json', expects: 'json', auth: 'none' },
  { slug: 'openfda', url: 'https://api.fda.gov/drug/label.json?limit=1', expects: 'json', auth: 'none' },
  { slug: 'nvd-cve', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1', expects: 'json', auth: 'none', notes: 'notoriously slow — 5s timeout may trip; latency canary' },
  { slug: 'tfl', url: 'https://api.tfl.gov.uk/Line/victoria/Status', expects: 'json', auth: 'none' },
  { slug: 'disease-sh', url: 'https://disease.sh/v3/covid-19/all', expects: 'json', auth: 'none' },
  { slug: 'nasa-apod', url: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', expects: 'json', auth: 'keyed-demo', notes: 'DEMO_KEY ~30 req/h per IP — shared Worker egress may 429' },
  { slug: 'spaceflight-news', url: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=1', expects: 'json', auth: 'none' },
  { slug: 'launch-library', url: 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1', expects: 'json', auth: 'none', notes: '~15 req/h keyless — expect 429; throttle canary' },
  { slug: 'spacex', url: 'https://api.spacexdata.com/v4/launches/latest', expects: 'json', auth: 'none', notes: 'unmaintained since 2022; origin TLS broken (525) observed 2026-07 — rot sample' },
  { slug: 'open-notify', url: 'http://api.open-notify.org/iss-now.json', expects: 'json', auth: 'none', notes: 'http-only' },

  // --- books & culture -------------------------------------------------------
  { slug: 'wikipedia', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Albert_Einstein', expects: 'json', auth: 'none' },
  { slug: 'wayback', url: 'https://archive.org/wayback/available?url=example.com', expects: 'json', auth: 'none' },
  { slug: 'open-library', url: 'https://openlibrary.org/search.json?q=lord+of+the+rings&limit=1', expects: 'json', auth: 'none', notes: 'search can be slow' },
  { slug: 'gutendex', url: 'https://gutendex.com/books/?search=dickens', expects: 'json', auth: 'none' },
  { slug: 'met-museum', url: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535', expects: 'json', auth: 'none' },
  { slug: 'itunes-search', url: 'https://itunes.apple.com/search?term=radiohead&limit=1', expects: 'json', auth: 'none', notes: 'serves JSON with a text/javascript content-type' },
  { slug: 'guardian', url: 'https://content.guardianapis.com/search?q=api', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'nytimes', url: 'https://api.nytimes.com/svc/topstories/v2/home.json', expects: 'json', auth: 'keyed', notes: 'expect 401' },

  // --- entertainment ---------------------------------------------------------
  { slug: 'tvmaze', url: 'https://api.tvmaze.com/singlesearch/shows?q=girls', expects: 'json', auth: 'none' },
  { slug: 'rickandmorty', url: 'https://rickandmortyapi.com/api/character/1', expects: 'json', auth: 'none' },
  { slug: 'jikan', url: 'https://api.jikan.moe/v4/anime/1', expects: 'json', auth: 'none', notes: 'rate-limited ~3 req/s' },
  { slug: 'scryfall', url: 'https://api.scryfall.com/cards/named?fuzzy=black+lotus', expects: 'json', auth: 'none' },
  { slug: 'swapi', url: 'https://swapi.dev/api/people/1/', expects: 'json', auth: 'none', notes: 'cert has lapsed before — flakiness canary' },
  { slug: 'deckofcards', url: 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1', expects: 'json', auth: 'none' },
  { slug: 'thesportsdb', url: 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal', expects: 'json', auth: 'keyed-demo', notes: '"3" is the documented free test key' },
  { slug: 'balldontlie', url: 'https://api.balldontlie.io/v1/teams', expects: 'json', auth: 'keyed', notes: 'keyless until 2024; expect 401' },
  { slug: 'omdb', url: 'https://www.omdbapi.com/?t=inception', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'tmdb', url: 'https://api.themoviedb.org/3/movie/550', expects: 'json', auth: 'keyed', notes: 'expect 401' },

  // --- animals & fun ----------------------------------------------------------
  { slug: 'pokeapi', url: 'https://pokeapi.co/api/v2/pokemon/ditto', expects: 'json', auth: 'none' },
  { slug: 'dog-ceo', url: 'https://dog.ceo/api/breeds/image/random', expects: 'json', auth: 'none' },
  { slug: 'catfact', url: 'https://catfact.ninja/fact', expects: 'json', auth: 'none' },
  { slug: 'chucknorris', url: 'https://api.chucknorris.io/jokes/random', expects: 'json', auth: 'none' },
  { slug: 'jokeapi', url: 'https://v2.jokeapi.dev/joke/Programming?safe-mode', expects: 'json', auth: 'none' },
  { slug: 'bored-api', url: 'https://bored-api.appbrewery.com/random', expects: 'json', auth: 'none', notes: 'community mirror — original boredapi.com died 2024; verify before trusting' },
  { slug: 'adviceslip', url: 'https://api.adviceslip.com/advice', expects: 'json', auth: 'none', notes: 'JSON body under a text/html content-type' },
  { slug: 'quotable', url: 'https://api.quotable.io/random', expects: 'json', auth: 'none', notes: 'recurrent cert lapses — flakiness canary' },
  { slug: 'numbersapi', url: 'http://numbersapi.com/42/trivia', expects: 'any', auth: 'none', notes: 'plain text; http-only; serving HTML 404s as of 2026-07 — rot sample' },

  // --- words & people -----------------------------------------------------------
  { slug: 'dictionaryapi', url: 'https://api.dictionaryapi.dev/api/v2/entries/en/hello', expects: 'json', auth: 'none' },
  { slug: 'datamuse', url: 'https://api.datamuse.com/words?ml=ocean&max=1', expects: 'json', auth: 'none' },
  { slug: 'agify', url: 'https://api.agify.io/?name=alice', expects: 'json', auth: 'none', notes: '100 req/day per IP — shared Worker egress may 429; quota canary' },
  { slug: 'genderize', url: 'https://api.genderize.io/?name=alice', expects: 'json', auth: 'none', notes: 'same 100 req/day per-IP cap as agify' },
  { slug: 'randomuser', url: 'https://randomuser.me/api/', expects: 'json', auth: 'none' },

  // --- food & commerce ------------------------------------------------------------
  { slug: 'openfoodfacts', url: 'https://world.openfoodfacts.org/api/v2/product/3017624010701.json', expects: 'json', auth: 'none' },
  { slug: 'openbrewerydb', url: 'https://api.openbrewerydb.org/v1/breweries?per_page=1', expects: 'json', auth: 'none' },
  { slug: 'fruityvice', url: 'https://www.fruityvice.com/api/fruit/banana', expects: 'json', auth: 'none' },
  { slug: 'fakestoreapi', url: 'https://fakestoreapi.com/products/1', expects: 'json', auth: 'none' },

  // --- utility & images --------------------------------------------------------------
  { slug: 'picsum', url: 'https://picsum.photos/id/237/200/300', expects: 'any', auth: 'none', notes: 'serves an image after a redirect' },
  { slug: 'nager-date', url: 'https://date.nager.at/api/v3/PublicHolidays/2026/US', expects: 'json', auth: 'none' },
  { slug: 'hibp-breaches', url: 'https://haveibeenpwned.com/api/v3/breaches', expects: 'json', auth: 'none', notes: 'keyless endpoint on a Cloudflare-hardened domain — prime challenge canary' },
  { slug: 'reqres', url: 'https://reqres.in/api/users/2', expects: 'json', auth: 'keyed', notes: 'free header key required since 2025; expect 401/403' },

  // --- keyed media & security (server-up probes) ---------------------------------------
  { slug: 'newsapi', url: 'https://newsapi.org/v2/top-headlines?country=us', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'gnews', url: 'https://gnews.io/api/v4/top-headlines?lang=en', expects: 'json', auth: 'keyed', notes: 'expect 400/401' },
  { slug: 'giphy', url: 'https://api.giphy.com/v1/gifs/trending', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'unsplash', url: 'https://api.unsplash.com/photos/random', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'pexels', url: 'https://api.pexels.com/v1/search?query=nature', expects: 'json', auth: 'keyed', notes: 'expect 401; observed 200 keyless 2026-07' },
  { slug: 'pixabay', url: 'https://pixabay.com/api/?q=flowers', expects: 'json', auth: 'keyed', notes: 'returns 400 keyless, not 401; also Cloudflare-fronted' },
  { slug: 'spotify', url: 'https://api.spotify.com/v1/search?q=beatles&type=artist', expects: 'json', auth: 'keyed', notes: 'oauth; expect 401' },
  { slug: 'twitch', url: 'https://api.twitch.tv/helix/games/top', expects: 'json', auth: 'keyed', notes: 'oauth; expect 401' },
  { slug: 'virustotal', url: 'https://www.virustotal.com/api/v3/domains/google.com', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'shodan', url: 'https://api.shodan.io/shodan/host/8.8.8.8', expects: 'json', auth: 'keyed', notes: 'expect 401; observed 200 keyless 2026-07' },
  { slug: 'abuseipdb', url: 'https://api.abuseipdb.com/api/v2/check?ipAddress=8.8.8.8', expects: 'json', auth: 'keyed', notes: 'expect 401' },
  { slug: 'openaq', url: 'https://api.openaq.org/v3/locations?limit=1', expects: 'json', auth: 'keyed', notes: 'key required since v3 (2024); expect 401' },
]
