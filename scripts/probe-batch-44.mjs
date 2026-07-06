// Probe top keyless candidates from thorough-discovery.json → batch-44.json
// run: node scripts/probe-batch-44.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import {
  UA,
  docsFetchUrl,
  emojiFor,
  extractProbeUrls,
  guessEndpoints,
  isPostmanCollection,
  probeUrl,
  slugify,
  splitBaseAndEndpoint,
  trimJson,
  writeCopy,
} from './lib/probe-utils.mjs'

const THOROUGH = fileURLToPath(new URL('./thorough-discovery.json', import.meta.url))
const EXTRA = fileURLToPath(new URL('./extra-candidates.json', import.meta.url))
const OUT = fileURLToPath(new URL('./import/batch-44.json', import.meta.url))
const LIMIT = Number(process.env.LIMIT || '120')
const MAX = 5

const existing = (() => {
  try {
    const j = JSON.parse(readFileSync(OUT, 'utf8'))
    return { verified: j.verified ?? [], slugs: new Set((j.verified ?? []).map((v) => v.slug)) }
  } catch { return { verified: [], slugs: new Set() } }
})()

const seedSrc =
  readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8') +
  readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')

const known = new Set()
for (const m of seedSrc.matchAll(/(?:docsUrl|baseUrl): ['"](https?:\/\/[^/'"]+)/g)) {
  try { known.add(new URL(m[1]).hostname.replace(/^www\./, '')) } catch { /* */ }
}
for (const f of readdirSync(fileURLToPath(new URL('./import/', import.meta.url))).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(fileURLToPath(new URL(`./import/${f}`, import.meta.url)), 'utf8')).verified ?? []) {
    try { known.add(new URL(v.baseUrl).hostname.replace(/^www\./, '')) } catch { /* */ }
  }
}

function hostKnown(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (known.has(h)) return true
    if (h.startsWith('api.') && known.has(h.slice(4))) return true
    if (known.has(`api.${h}`)) return true
  } catch { /* */ }
  return false
}

function score(c) {
  return (
    (c.https !== false ? 2 : 0) +
    (c.cors === 'yes' ? 1 : 0) +
    (c.description?.length > 20 ? 1 : 0) +
    (c.source === 'public-api-lists-cat' ? 2 : 0) +
    (c.source === 'apiEngine' ? 1 : 0)
  )
}

const thorough = JSON.parse(readFileSync(THOROUGH, 'utf8')).candidates ?? []
const extra = JSON.parse(readFileSync(EXTRA, 'utf8')).candidates ?? []

const seen = new Set()
const pool = []
for (const c of [...thorough, ...extra]) {
  if (c.auth !== 'none') continue
  if (c.source === 'directory-candidates-residual') continue
  if (!c.docsUrl || hostKnown(c.docsUrl)) continue
  const key = new URL(c.docsUrl).hostname.replace(/^www\./, '') + '|' + c.name.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  pool.push(c)
}
pool.sort((a, b) => score(b) - score(a))
const candidates = pool.slice(0, LIMIT)

const KNOWN_ENDPOINTS = {
  'dog-api.kinduff.com': 'https://dog-api.kinduff.com/api/facts?number=1',
  'blockstream.info': 'https://blockstream.info/api/blocks/tip/height',
  'random-word-api.herokuapp.com': 'https://random-word-api.herokuapp.com/word',
  'archive-api.open-meteo.com': 'https://archive-api.open-meteo.com/v1/archive?latitude=52.5&longitude=13.4&start_date=2024-01-01&end_date=2024-01-07&daily=temperature_2m_max',
  'kanjiapi.dev': 'https://kanjiapi.dev/v1/kanji/水',
  'ssd-api.jpl.nasa.gov': 'https://ssd-api.jpl.nasa.gov/cad.api?date-min=2026-01-01&limit=1',
  'axolotlapi.xyz': 'https://axolotlapi.xyz/api/axolotl',
  'theaxolotlapi.netlify.app': 'https://theaxolotlapi.netlify.app/api/axolotl',
  'shibe.online': 'https://shibe.online/api/shibes?count=1&urls=true&httpsUrls=true',
  'www.fishwatch.gov': 'https://www.fishwatch.gov/api/species?limit=1',
  'fishwatch.gov': 'https://www.fishwatch.gov/api/species?limit=1',
  'zoo-animal-api.herokuapp.com': 'https://zoo-animal-api.herokuapp.com/animals/rand',
  'oceanfacts.herokuapp.com': 'https://oceanfacts.herokuapp.com/',
  'emailrep.io': 'https://emailrep.io/test@example.com',
  'disify.com': 'https://disify.com/api/email/test@example.com',
  'phantauth.net': 'https://phantauth.net/user/test',
  'api.coincap.io': 'https://api.coincap.io/v2/assets?limit=1',
  'api.cryptonator.com': 'https://api.cryptonator.com/api/ticker/btc-usd',
  'bleach-poems-api.codeberg.page': 'https://bleach-poems-api.codeberg.page/api/poem',
  'v6.vbb.transport.rest': 'https://v6.vbb.transport.rest/regions',
  'v6.db.transport.rest': 'https://v6.db.transport.rest/regions',
  'api.digitransit.fi': 'https://api.digitransit.fi/geocoding/v1/search?text=helsinki',
  'apis.is': 'https://apis.is/weather/forecasts/en?stations=1',
  'stooq.com': 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=json',
  'api.openaq.org': 'https://api.openaq.org/v3/latest?limit=1',
  'api.spacexdata.com': 'https://api.spacexdata.com/v4/launches/latest',
  'api.quotable.io': 'https://api.quotable.io/random',
  'urlhaus-api.abuse.ch': 'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/',
  'api.hackertarget.com': 'https://api.hackertarget.com/dnslookup/?q=google.com',
  'gutendex.com': 'https://gutendex.com/books/?search=alice',
  'api.datamuse.com': 'https://api.datamuse.com/words?ml=spoon&max=1',
  'freedictionaryapi.com': 'https://freedictionaryapi.com/api/v1/entries/en/hello',
  'api.coinpaprika.com': 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin',
  'mempool.space': 'https://mempool.space/api/v1/fees/recommended',
  'll.thespacedevs.com': 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1',
  'inspirehep.net': 'https://inspirehep.net/api/literature?q=electron&size=1',
  'api.crossref.org': 'https://api.crossref.org/works?query=electron&rows=1',
  'api.exchangerate.host': 'https://api.exchangerate.host/latest?base=USD',
  'api.fiscaldata.treasury.gov': 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/debt_to_penny?sort=-record_date&limit=1',
  'api.rainviewer.com': 'https://api.rainviewer.com/public/weather-maps.json',
  'api.citybik.es': 'https://api.citybik.es/v2/networks',
  'opensky-network.org': 'https://opensky-network.org/api/states/all?lamin=45&lomin=5&lamax=47&lomax=7',
  'export.arxiv.org': 'http://export.arxiv.org/api/query?search_query=all:electron&max_results=1',
  'api.semanticscholar.org': 'https://api.semanticscholar.org/graph/v1/paper/search?query=transformer&limit=1',
  'pubchem.ncbi.nlm.nih.gov': 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/JSON',
  'api.census.gov': 'https://api.census.gov/data/2021/acs/acs1/profile?get=NAME&for=us:1',
  'efts.sec.gov': 'https://efts.sec.gov/LATEST/search-index?q=apple&dateRange=custom&startdt=2024-01-01&enddt=2024-12-31',
  'api.stackexchange.com': 'https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&site=stackoverflow&pagesize=1',
  'rdap.org': 'https://rdap.org/domain/example.com',
  'isdayoff.ru': 'https://isdayoff.ru/api/getdata?year=2026&month=7',
  'attackontitanquotes.vercel.app': 'https://attackontitanquotes.vercel.app/api/quotes/random',
  'programming-quotesapi.vercel.app': 'https://programming-quotesapi.vercel.app/api/v2/quotes/random',
  'api.unusualunits.com': 'https://api.unusualunits.com/convert?from=meter&to=foot&value=1',
  'nationnode.vercel.app': 'https://nationnode.vercel.app/api/countries',
  'aes.shenlu.me': 'https://aes.shenlu.me/api/species?limit=1',
  'horoscope.deckaura.com': 'https://horoscope.deckaura.com/api/horoscope/today/aries',
  'echoes.soferity.com': 'https://echoes.soferity.com/api/random',
  'api.dexpaprika.com': 'https://api.dexpaprika.com/v1/networks',
  'photon.komoot.io': 'https://photon.komoot.io/api/?q=berlin&limit=1',
  'numbersapi.com': 'http://numbersapi.com/random/trivia?json',
  'docs.openalex.org': 'https://api.openalex.org/works?search=machine%20learning&per_page=1',
  'api.openalex.org': 'https://api.openalex.org/works?search=machine%20learning&per_page=1',
  'thespacedevs.com': 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1',
  'www.geojs.io': 'https://get.geojs.io/v1/ip/geo/8.8.8.8.json',
  'geojs.io': 'https://get.geojs.io/v1/ip/geo/8.8.8.8.json',
  'random-data-api.com': 'https://random-data-api.com/api/v2/users?size=1',
  'anime-facts-rest-api.herokuapp.com': 'https://anime-facts-rest-api.herokuapp.com/api/v1/0',
  'chandan-02.github.io': 'https://anime-facts-rest-api.herokuapp.com/api/v1/0',
  'ghibliapi.herokuapp.com': 'https://ghibliapi.herokuapp.com/films',
  'api.chucknorris.io': 'https://api.chucknorris.io/jokes/random',
  'icndb.com': 'http://api.icndb.com/jokes/random',
  'www.boredapi.com': 'https://www.boredapi.com/api/activity',
  'autobahn.api.bund.dev': 'https://autobahn.api.bund.dev/autobahnen',
  'dwd.api.bund.dev': 'https://dwd.api.bund.dev/weather/alerts',
  'cve.circl.lu': 'https://cve.circl.lu/api/last/1',
  'api.llama.fi': 'https://api.llama.fi/protocols',
  'registry.npmjs.org': 'https://registry.npmjs.org/-/v1/search?text=react&size=1',
  'pypi.org': 'https://pypi.org/pypi/requests/json',
  'crates.io': 'https://crates.io/api/v1/crates/serde',
  'pypistats.org': 'https://pypistats.org/api/packages/requests/recent',
  'eutils.ncbi.nlm.nih.gov': 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=cancer&retmode=json&retmax=1',
  'api.vatcomply.com': 'https://api.vatcomply.com/rates?base=USD',
  'ghoapi.azureedge.net': 'https://ghoapi.azureedge.net/api/Dimension',
  'api.ipdetails.io': 'https://ipdetails.io/?ip=8.8.8.8',
  'ipdetails.io': 'https://ipdetails.io/?ip=8.8.8.8',
  'www.whatismyip.net': 'https://www.whatismyip.net/api/8.8.8.8',
  'ksefekburczymucha.pl': 'https://ksefekburczymucha.pl/api/bank/10101010',
  'api.coinranking.com': 'https://api.coinranking.com/v2/coins?limit=1',
  'dogapi.dog': 'https://dogapi.dog/api/v2/facts?limit=1',
  'blooms-production.up.railway.app': 'https://blooms-production.up.railway.app/api',
  'aerokey-api.vercel.app': 'https://aerokey-api.vercel.app/api/airports',
  'congressionalstockbrain.com': 'https://congressionalstockbrain.com/api/trades',
  'japanneighborhoods.com': 'https://japanneighborhoods.com/api/neighborhoods?city=Tokyo',
  'crimebrasil.com.br': 'https://crimebrasil.com.br/api/v1/cities',
  'developer.epa.gov': 'https://enviro.epa.gov/enviro/ef_metadata_html.html',
  'enviro.epa.gov': 'https://enviro.epa.gov/enviro/ef_metadata_html.html',
  'catalog.data.gov': 'https://catalog.data.gov/api/3/action/package_search?q=health&rows=1',
  'api.worldbank.org': 'https://api.worldbank.org/v2/country/US?format=json',
  'api.fda.gov': 'https://api.fda.gov/drug/label.json?limit=1',
  'open.fda.gov': 'https://api.fda.gov/drug/label.json?limit=1',
  'api.coingecko.com': 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  'api.binance.com': 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
  'api.kraken.com': 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
  'blockchain.info': 'https://blockchain.info/ticker',
  'api.coinlore.com': 'https://api.coinlore.net/api/tickers/',
  'www.coinlore.com': 'https://api.coinlore.net/api/tickers/',
  'api.chucknorris.io': 'https://api.chucknorris.io/jokes/random',
  'api.adviceslip.com': 'https://api.adviceslip.com/advice',
  'api.kanye.rest': 'https://api.kanye.rest',
  'official-joke-api.appspot.com': 'https://official-joke-api.appspot.com/random_joke',
  'v2.jokeapi.dev': 'https://v2.jokeapi.dev/joke/Any?format=json&safe-mode',
  'api.agify.io': 'https://api.agify.io/?name=michael',
  'api.genderize.io': 'https://api.genderize.io/?name=alex',
  'api.nationalize.io': 'https://api.nationalize.io/?name=nathaniel',
  'deckofcardsapi.com': 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1',
  'opentdb.com': 'https://opentdb.com/api.php?amount=1',
  'api.sunrise-sunset.org': 'https://api.sunrise-sunset.org/json?lat=36.72&lng=-4.42',
  'earthquake.usgs.gov': 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=1',
  'viacep.com.br': 'https://viacep.com.br/ws/01001000/json/',
  'api.zippopotam.us': 'https://api.zippopotam.us/us/90210',
  'api.postcodes.io': 'https://api.postcodes.io/postcodes/SW1A1AA',
  'api.adoptium.net': 'https://api.adoptium.net/v3/info/release_versions',
  'data.jsdelivr.com': 'https://data.jsdelivr.com/v1/package/npm/lodash',
  'stapi.co': 'https://stapi.co/api/v1/rest/character/search?pageNumber=0&pageSize=1',
  'rickandmortyapi.com': 'https://rickandmortyapi.com/api/character/1',
  'api.tvmaze.com': 'https://api.tvmaze.com/shows/1',
  'digimon-api.vercel.app': 'https://digimon-api.vercel.app/api/digimon',
  'hp-api.onrender.com': 'https://hp-api.onrender.com/api/characters',
  'api-thirukkural.web.app': 'https://api-thirukkural.web.app/kural/1',
  'nekos.best': 'https://nekos.best/api/v2/neko',
  'api.waifu.im': 'https://api.waifu.im/search',
  'api.trace.moe': 'https://api.trace.moe/reduce/https://trace.moe/img/10.jpg',
  'api.jikan.moe': 'https://api.jikan.moe/v4/anime/1',
  'animechan.xyz': 'https://animechan.xyz/api/random',
  'kitsu.io': 'https://kitsu.io/api/edge/anime/1',
  'bible-api.com': 'https://bible-api.com/john+3:16',
  'poetrydb.org': 'https://poetrydb.org/author/Shakespeare',
  'api.alquran.cloud': 'https://api.alquran.cloud/v1/surah/1',
  'www.uuid.ink': 'https://www.uuid.ink/api/v1',
  'api.vatcomply.com': 'https://api.vatcomply.com/rates?base=USD',
  'caldays.com': 'https://caldays.com/api/holidays?country=US&year=2026',
  'httpbingo.org': 'https://httpbingo.org/json',
  'freeipapi.com': 'https://freeipapi.com/api/json/8.8.8.8',
  'www.wikidata.org': 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=python&language=en&format=json&limit=1',
  'clinicaltrials.gov': 'https://clinicaltrials.gov/api/v2/studies?query.cond=cancer&pageSize=1',
  'api.llama.fi': 'https://api.llama.fi/protocols',
  'api.blockchair.com': 'https://api.blockchair.com/bitcoin/stats',
  'api.etherscan.io': 'https://api.etherscan.io/api?module=stats&action=ethprice',
  'www.uuidgenerator.net': 'https://www.uuidgenerator.net/api/version4/1',
  'rubygems.org': 'https://rubygems.org/api/v1/gems/rails.json',
  'repo.packagist.org': 'https://repo.packagist.org/p2/laravel/framework.json',
  'api.discogs.com': 'https://api.discogs.com/database/search?q=nirvana&type=release&key=&secret=',
  'api.rss2json.com': 'https://api.rss2json.com/v1/api.json?rss_url=https://hnrss.org/frontpage',
  'swapi.info': 'https://swapi.info/api',
  'the-trivia-api.com': 'https://the-trivia-api.com/api/questions?limit=1',
  'api.beta.ons.gov.uk': 'https://api.beta.ons.gov.uk/v1/datasets?limit=1',
  'api.nal.usda.gov': 'https://api.nal.usda.gov/fdc/v1/foods/search?query=apple&pageSize=1&api_key=DEMO_KEY',
  'rhymebrain.com': 'https://rhymebrain.com/talk?function=getRhymes&word=example',
  'api.mymemory.translated.net': 'https://api.mymemory.translated.net/get?q=hello&langpair=en|es',
  'dev.to': 'https://dev.to/api/articles?per_page=1',
  'lobste.rs': 'https://lobste.rs/hottest.json',
  'remotive.com': 'https://remotive.com/api/remote-jobs?limit=1',
  'himalayas.app': 'https://himalayas.app/jobs/api?limit=1',
  'www.themuse.com': 'https://www.themuse.com/api/public/jobs?page=0',
  'landing.jobs': 'https://landing.jobs/api/v1/jobs?limit=1',
  'fakerapi.it': 'https://fakerapi.it/api/v1/persons?_quantity=1',
  'fakestoreapi.com': 'https://fakestoreapi.com/products?limit=1',
  'api.lanyard.rest': 'https://api.lanyard.rest/v1/users/499187947997114390',
  'api.dicebear.com': 'https://api.dicebear.com/7.x/pixel-art/json?seed=test',
  'baconipsum.com': 'https://baconipsum.com/api/?type=meat-and-filler&paras=1&format=json',
  'softwium.com': 'https://softwium.com/fake-api/users/1',
  'itsthisforthat.com': 'https://itsthisforthat.com/api.php?json',
  'api.potterdb.com': 'https://api.potterdb.com/v1/characters?page[size]=1',
  'www.amiiboapi.com': 'https://www.amiiboapi.com/api/amiibo/?name=mario',
  'digimoncard.io': 'https://digimoncard.io/api-public/search?card=agumon',
  'api.gbif.org': 'https://api.gbif.org/v1/species?q=Puma&limit=1',
  'api.inaturalist.org': 'https://api.inaturalist.org/v1/taxa?q=fox&per_page=1',
  'api.escuelajs.co': 'https://api.escuelajs.co/api/v1/products?limit=1',
  'api.restful-api.dev': 'https://api.restful-api.dev/objects',
  'lichess.org': 'https://lichess.org/api/user/thibault',
  'zenodo.org': 'https://zenodo.org/api/records?size=1',
  'wger.de': 'https://wger.de/api/v2/exercise/?format=json&limit=1',
  'open.er-api.com': 'https://open.er-api.com/v6/latest/USD',
  'api.fbi.gov': 'https://api.fbi.gov/wanted/v1/list',
  'www.affirmations.dev': 'https://www.affirmations.dev',
  'api.sampleapis.com': 'https://api.sampleapis.com/coffee/hot',
  'eldenring.fanapis.com': 'https://eldenring.fanapis.com/api/classes?limit=1',
  'api.bigdatacloud.net': 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=51.5&longitude=-0.1',
  'ipwho.is': 'https://ipwho.is/8.8.8.8',
  'www.thecocktaildb.com': 'https://www.thecocktaildb.com/api/json/v1/1/random.php',
  'www.dnd5eapi.co': 'https://www.dnd5eapi.co/api/spells/fireball',
  'api.magicthegathering.io': 'https://api.magicthegathering.io/v1/cards?name=Opt&pageSize=1',
  'itunes.apple.com': 'https://itunes.apple.com/search?term=beatles&limit=1',
  'api.deezer.com': 'https://api.deezer.com/search?q=eminem&limit=1',
  'api.urbandictionary.com': 'https://api.urbandictionary.com/v0/define?term=api',
  'timeapi.io': 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
  'query1.finance.yahoo.com': 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d',
  'meowfacts.herokuapp.com': 'https://meowfacts.herokuapp.com/',
  'randomfox.ca': 'https://randomfox.ca/floof/',
  'vpic.nhtsa.dot.gov': 'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/honda?format=json',
  'www.7timer.info': 'http://www.7timer.info/bin/api.pl?lon=13.4&lat=52.5&product=civil&output=json',
  'api.coindesk.com': 'https://api.coindesk.com/v1/bpi/currentprice.json',
  'api.dictionaryapi.dev': 'https://api.dictionaryapi.dev/api/v2/entries/en/hello',
  'bleach-poems-api.codeberg.page': 'https://bleach-poems-api.codeberg.page/api/poem',
  'v6.bvg.transport.rest': 'https://v6.bvg.transport.rest/locations?query=alexanderplatz',
  'api.exchangerate.host': 'https://api.exchangerate.host/latest?base=USD',
  'nvd.nist.gov': 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1',
  'www.ssllabs.com': 'https://api.ssllabs.com/api/v3/info',
  'urlhaus.abuse.ch': 'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/',
  'www.phishtank.com': 'https://checkurl.phishtank.com/checkurl/',
  'api.semanticscholar.org': 'https://api.semanticscholar.org/graph/v1/paper/search?query=transformer&limit=1',
  'core.ac.uk': 'https://api.core.ac.uk/v3/search?q=machine%20learning&limit=1',
  'data.un.org': 'https://data.un.org/Handlers/DownloadHandler.ashx?DataFilter=download',
  'www.reddit.com': 'https://www.reddit.com/r/programming.json?limit=1',
  'bsky.social': 'https://bsky.social/xrpc/app.bsky.actor.getProfile?actor=bsky.app',
  'www.gravatar.com': 'https://www.gravatar.com/avatar/205e460b479e2e5b48aec0771054aa4?d=mp&format=json',
  'api.github.com': 'https://api.github.com/search/repositories?q=web+scraping&per_page=1',
  'hacker-news.firebaseio.com': 'https://hacker-news.firebaseio.com/v0/topstories.json',
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

async function probeCandidateUrls(urls) {
  const tried = new Set()
  for (const raw of urls) {
    if (tried.size >= MAX) break
    const url = raw.trim()
    if (!url || tried.has(url)) continue
    tried.add(url)
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json != null && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      return { ...r, ...split, probedUrl: url }
    }
  }
  return null
}

async function verify(c) {
  const hint = findHint(c)
  const urls = []
  if (hint) urls.push(hint.baseUrl.replace(/\/+$/, '') + hint.sampleEndpoint)
  urls.push(...guessEndpoints(c))

  try {
    const host = new URL(c.docsUrl).hostname.replace(/^www\./, '')
    const full = KNOWN_ENDPOINTS[host] || KNOWN_ENDPOINTS[new URL(c.docsUrl).hostname]
    if (full) urls.unshift(full)
  } catch { /* */ }

  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), {
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
    })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text()))
  } catch { /* */ }

  const hit = await probeCandidateUrls(urls)
  if (!hit) return { ok: false, name: c.name, docsUrl: c.docsUrl }

  const copy = writeCopy(c)
  return {
    ok: true,
    entry: {
      name: hint?.name || c.name,
      slug: slugify(hint?.name || c.name),
      emoji: hint?.emoji || emojiFor(c.sourceCategory),
      tagline: hint?.tagline || copy.tagline,
      description: hint?.description || copy.description,
      sourceCategory: c.sourceCategory,
      docsUrl: c.docsUrl,
      baseUrl: hit.baseUrl,
      sampleEndpoint: hit.sampleEndpoint,
      latencyMs: hit.latencyMs,
      corsObserved: hit.corsObserved,
      httpStatus: 200,
      sampleJson: trimJson(hit.json),
      freeTier: 'Free — limits not published',
      rateLimit: 'Unpublished',
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      notes: `Batch-44 source ${c.source}; probed ${hit.probedUrl}`,
    },
  }
}

console.log(`Probing top ${candidates.length} keyless candidates for batch-44 (${existing.verified.length} already verified)...`)
const verified = [...existing.verified]
const skipped = []
const CONC = 8
const q = [...candidates]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let c; (c = q.shift()); ) {
    const r = await verify(c)
    if (r.ok) {
      if (existing.slugs.has(r.entry.slug)) continue
      verified.push(r.entry)
      existing.slugs.add(r.entry.slug)
      console.log('  ✓', r.entry.name)
    } else {
      skipped.push({ name: r.name, docsUrl: r.docsUrl })
    }
  }
}))

// Fix mis-probed PubMed if present
for (const v of verified) {
  if (/pubmed/i.test(v.name) && /pubchem/i.test(v.baseUrl)) {
    v.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
    v.sampleEndpoint = '/esearch.fcgi?db=pubmed&term=cancer&retmode=json&retmax=1'
    v.notes = 'Batch-44; reprobed PubMed E-utilities'
  }
  if (/whatismyip/i.test(v.name) && v.sampleEndpoint.includes('%3C')) {
    v.baseUrl = 'https://www.whatismyip.net'
    v.sampleEndpoint = '/api/8.8.8.8'
    v.notes = 'Batch-44; fixed WhatIsMyIP endpoint'
  }
}

writeFileSync(OUT, JSON.stringify({ batch: 44, verified, skipped }, null, 2) + '\n')
console.log(`\nDone: ${verified.length} verified, ${skipped.length} skipped → ${OUT}`)
