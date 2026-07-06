// One-off probe for underrepresented categories — run: node scripts/probe-thin-categories.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isPostmanCollection } from './lib/probe-utils.mjs'

const SEED = readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8')
  + readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')

const UA = 'shipapisbot/1.0 (+https://shipapis.dev/methodology)'

/** @type {[string, string, string][]} */
const urls = [
  // Animals
  ['Axolotl API', 'https://axolotlapi.xyz/api/axolotl', 'Animals'],
  ['Axolotl alt', 'https://theaxolotlapi.netlify.app/api/axolotl', 'Animals'],
  ['Shibe', 'https://shibe.online/api/shibes?count=1&urls=true&httpsUrls=true', 'Animals'],
  ['Cataas JSON', 'https://cataas.com/cat?json=true', 'Animals'],
  ['Cat Facts alt', 'https://cat-facts.herokuapp.com/facts/random?animal_type=cat', 'Animals'],
  ['Dog Facts kinduff', 'https://dog-api.kinduff.com/api/facts?number=1', 'Animals'],
  ['MeowFacts', 'https://meowfacts.herokuapp.com/', 'Animals'],
  ['Random Fox', 'https://randomfox.ca/floof/', 'Animals'],
  ['FishWatch', 'https://www.fishwatch.gov/api/species?limit=1', 'Animals'],
  ['Zoo Animals', 'https://zoo-animal-api.herokuapp.com/animals/rand', 'Animals'],
  // Security
  ['URLhaus recent', 'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/', 'Security'],
  ['EmailRep', 'https://emailrep.io/test@example.com', 'Security'],
  ['Disify email', 'https://disify.com/api/email/test@example.com', 'Security'],
  ['HackerTarget DNS', 'https://api.hackertarget.com/dnslookup/?q=google.com', 'Security'],
  // Crypto
  ['CoinCap', 'https://api.coincap.io/v2/assets?limit=1', 'Cryptocurrency'],
  ['CoinPaprika', 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin', 'Cryptocurrency'],
  ['Mempool fees', 'https://mempool.space/api/v1/fees/recommended', 'Cryptocurrency'],
  ['Blockchain.info stats', 'https://blockchain.info/stats?format=json', 'Cryptocurrency'],
  ['CoinDesk BPI', 'https://api.coindesk.com/v1/bpi/currentprice.json', 'Cryptocurrency'],
  ['CoinGecko simple', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', 'Cryptocurrency'],
  ['Binance ticker', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', 'Cryptocurrency'],
  ['Kraken ticker', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', 'Cryptocurrency'],
  ['Blockstream height', 'https://blockstream.info/api/blocks/tip/height', 'Cryptocurrency'],
  // Books / Dictionaries
  ['Datamuse', 'https://api.datamuse.com/words?ml=spoon&max=1', 'Dictionaries'],
  ['Free Dictionary', 'https://freedictionaryapi.com/api/v1/entries/en/hello', 'Dictionaries'],
  ['Dictionary API dev', 'https://api.dictionaryapi.dev/api/v2/entries/en/hello', 'Dictionaries'],
  ['Random Word API', 'https://random-word-api.herokuapp.com/word', 'Dictionaries'],
  ['Quotable', 'https://api.quotable.io/random', 'Books'],
  ['Gutendex', 'https://gutendex.com/books/?search=alice', 'Books'],
  // Transport
  ['VBB transport.rest', 'https://v6.vbb.transport.rest/regions', 'Transportation'],
  ['DB transport.rest', 'https://v6.db.transport.rest/regions', 'Transportation'],
  ['BVG transport.rest', 'https://v6.bvg.transport.rest/locations?query=alexanderplatz', 'Transportation'],
  ['CityBikes networks', 'https://api.citybik.es/v2/networks', 'Transportation'],
  ['OpenSky states', 'https://opensky-network.org/api/states/all?lamin=45&lomin=5&lamax=47&lomax=7', 'Transportation'],
  ['NHTSA models', 'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/honda?format=json', 'Vehicle'],
  // Finance
  ['ExchangeRate host', 'https://api.exchangerate.host/latest?base=USD', 'Currency Exchange'],
  ['Treasury Fiscal', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/debt_to_penny?sort=-record_date&limit=1', 'Finance'],
  ['Yahoo chart', 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', 'Finance'],
  ['Stooq quote', 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=json', 'Finance'],
  // Weather
  ['RainViewer maps', 'https://api.rainviewer.com/public/weather-maps.json', 'Weather'],
  ['Open-Meteo archive', 'https://archive-api.open-meteo.com/v1/archive?latitude=52.5&longitude=13.4&start_date=2024-01-01&end_date=2024-01-07&daily=temperature_2m_max', 'Weather'],
  ['7Timer', 'http://www.7timer.info/bin/api.pl?lon=13.4&lat=52.5&product=civil&output=json', 'Weather'],
  // Science
  ['NASA NeoWs', 'https://api.nasa.gov/neo/rest/v1/feed?start_date=2026-01-01&end_date=2026-01-07&api_key=DEMO_KEY', 'Science & Math'],
  ['SpaceX latest', 'https://api.spacexdata.com/v4/launches/latest', 'Science & Math'],
  ['Launch Library', 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1', 'Science & Math'],
  ['Inspire HEP', 'https://inspirehep.net/api/literature?q=electron&size=1', 'Science & Math'],
  ['Crossref', 'https://api.crossref.org/works?query=electron&rows=1', 'Science & Math'],
  // More animals
  ['Axolotl API', 'https://axolotlapi.xyz/api/axolotl', 'Animals'],
  ['Shibe Online', 'https://shibe.online/api/shibes?count=1&urls=true&httpsUrls=true', 'Animals'],
  ['FishWatch', 'https://www.fishwatch.gov/api/species?limit=1', 'Animals'],
  ['Zoo Animals', 'https://zoo-animal-api.herokuapp.com/animals/rand', 'Animals'],
  ['MeowFacts', 'https://meowfacts.herokuapp.com/', 'Animals'],
  ['Random Fox', 'https://randomfox.ca/floof/', 'Animals'],
  ['Ocean Facts', 'https://oceanfacts.herokuapp.com/', 'Animals'],
  // More security
  ['URLhaus recent', 'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/', 'Security'],
  ['EmailRep', 'https://emailrep.io/test@example.com', 'Security'],
  ['Disify email', 'https://disify.com/api/email/test@example.com', 'Security'],
  ['PhantAuth user', 'https://phantauth.net/user/test', 'Security'],
  ['Classify', 'https://classify-web.herokuapp.com/api/classify?text=hello', 'Security'],
  // More crypto
  ['CoinCap', 'https://api.coincap.io/v2/assets?limit=1', 'Cryptocurrency'],
  ['Blockchain.info stats', 'https://blockchain.info/stats?format=json', 'Cryptocurrency'],
  ['CoinDesk BPI', 'https://api.coindesk.com/v1/bpi/currentprice.json', 'Cryptocurrency'],
  ['Binance ticker', 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', 'Cryptocurrency'],
  ['Kraken ticker', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', 'Cryptocurrency'],
  ['Cryptonator', 'https://api.cryptonator.com/api/ticker/btc-usd', 'Cryptocurrency'],
  ['0x gas price', 'https://api.0x.org/swap/v1/price?sellToken=ETH&buyToken=DAI&sellAmount=1000000000000000000', 'Cryptocurrency'],
  // More books
  ['Quotable', 'https://api.quotable.io/random', 'Books'],
  ['Kanji API', 'https://kanjiapi.dev/v1/kanji/水', 'Books'],
  ['Bleach Poems', 'https://bleach-poems-api.codeberg.page/api/poem', 'Books'],
  ['Free Dictionary', 'https://freedictionaryapi.com/api/v1/entries/en/hello', 'Dictionaries'],
  ['Dictionary API dev', 'https://api.dictionaryapi.dev/api/v2/entries/en/hello', 'Dictionaries'],
  // More transport
  ['VBB transport.rest', 'https://v6.vbb.transport.rest/regions', 'Transportation'],
  ['DB transport.rest', 'https://v6.db.transport.rest/regions', 'Transportation'],
  ['CityBikes networks', 'https://api.citybik.es/v2/networks', 'Transportation'],
  ['OpenSky states', 'https://opensky-network.org/api/states/all?lamin=45&lomin=5&lamax=47&lomax=7', 'Transportation'],
  ['Digitransit Finland', 'https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql', 'Transportation'],
  ['Iceland APIs', 'https://apis.is/weather/forecasts/en?stations=1', 'Transportation'],
  ['NHTSA models', 'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/honda?format=json', 'Vehicle'],
  // More finance
  ['ExchangeRate host', 'https://api.exchangerate.host/latest?base=USD', 'Currency Exchange'],
  ['Treasury Fiscal', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/debt_to_penny?sort=-record_date&limit=1', 'Finance'],
  ['Stooq quote', 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=json', 'Finance'],
  // More weather
  ['RainViewer maps', 'https://api.rainviewer.com/public/weather-maps.json', 'Weather'],
  ['OpenAQ latest', 'https://api.openaq.org/v3/latest?limit=1', 'Weather'],
  ['7Timer', 'http://www.7timer.info/bin/api.pl?lon=13.4&lat=52.5&product=civil&output=json', 'Weather'],
  ['NASA NeoWs', 'https://api.nasa.gov/neo/rest/v1/feed?start_date=2026-01-01&end_date=2026-01-07&api_key=DEMO_KEY', 'Science & Math'],
  ['JPL Close Approach', 'https://ssd-api.jpl.nasa.gov/cad.api?date-min=2026-01-01&limit=1', 'Science & Math'],
  ['Inspire HEP', 'https://inspirehep.net/api/literature?q=electron&size=1', 'Science & Math'],
]

function hostKnown(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return [...SEED.matchAll(/https?:\/\/[^/'"\s]+/g)].some((m) => {
      try {
        const sh = new URL(m[0].endsWith('/') ? m[0] : m[0] + '/').hostname.replace(/^www\./, '')
        return sh === h || sh === h.replace(/^api\./, '') || `api.${sh}` === h
      } catch { return false }
    })
  } catch { return true }
}

const wins = []
for (const [name, url, cat] of urls) {
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      redirect: 'follow',
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* */ }
    if (r.status === 200 && json != null && !isPostmanCollection(json) && !hostKnown(url)) {
      wins.push({ cat, name, url })
    }
  } catch { /* */ }
}

const by = {}
for (const w of wins) by[w.cat] = (by[w.cat] ?? 0) + 1
console.log(`NEW working ${wins.length}`)
for (const [k, v] of Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${v} ${k}`)
}
for (const w of wins) console.log(`${w.cat} | ${w.name} | ${w.url}`)
