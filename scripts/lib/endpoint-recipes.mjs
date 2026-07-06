// Curated multi-endpoint recipes — matched by slug or baseUrl host after import.
// Each list must include the probed sampleEndpoint as one row (marked monitored).

import { GENERATED_ENDPOINTS } from './generated-endpoints.mjs'
import { expandEndpointsSync } from './endpoint-heuristics.mjs'

/** @param {string} slug @param {string} baseUrl @param {string} sampleEndpoint */
export function matchRecipe(slug, baseUrl, sampleEndpoint) {
  let host = ''
  try { host = new URL(baseUrl).hostname.replace(/^www\./, '') } catch { /* */ }
  for (const r of RECIPES) {
    if (r.slug?.test(slug)) return r
    if (r.host?.test(host)) return r
  }
  return null
}

/** @param {{ slug: string, baseUrl: string, sampleEndpoint: string, tagline?: string, endpoints?: unknown[] }} spec */
export function applyEndpointRecipe(spec) {
  const generated = GENERATED_ENDPOINTS[spec.slug]
  if (generated?.length) {
    return applyRecipeRows(spec, { endpoints: generated })
  }

  if (spec.endpoints?.length > 1) return spec

  const recipe = matchRecipe(spec.slug, spec.baseUrl, spec.sampleEndpoint)
  if (recipe) return applyRecipeRows(spec, recipe)

  const synced = expandEndpointsSync(spec)
  if (synced.length > 1) return { ...spec, endpoints: synced }
  return spec
}

/** @param {object} spec @param {{ endpoints: Array<{ method?: string, path: string, description: string, monitored?: boolean }> }} recipe */
function applyRecipeRows(spec, recipe) {
  const norm = (p) => (p.startsWith('/') ? p : `/${p}`)
  const sample = norm(spec.sampleEndpoint)
  const endpoints = recipe.endpoints.map((e, i) => ({
    method: e.method || 'GET',
    path: norm(e.path),
    description: e.description,
    monitored: norm(e.path) === sample || (!!e.monitored && !recipe.endpoints.some((x) => norm(x.path) === sample)),
  }))
  if (!endpoints.some((e) => e.monitored)) {
    const hit = endpoints.findIndex((e) => e.path === sample)
    if (hit >= 0) endpoints[hit].monitored = true
    else endpoints[0].monitored = true
  }
  return { ...spec, endpoints }
}

/** @type {Array<{ slug?: RegExp, host?: RegExp, endpoints: Array<{ method?: string, path: string, description: string, monitored?: boolean }> }>} */
export const RECIPES = [
  {
    slug: /^lastfm$/,
    endpoints: [
      { path: '/?method=artist.search&artist=cher&api_key=YOUR_API_KEY&format=json', description: 'Search artists by name.', monitored: true },
      { path: '/?method=artist.getinfo&artist=Cher&api_key=YOUR_API_KEY&format=json', description: 'Artist biography, tags and play counts.' },
      { path: '/?method=artist.getSimilar&artist=Cher&api_key=YOUR_API_KEY&format=json', description: 'Similar artists from listener data.' },
      { path: '/?method=artist.getTopTracks&artist=Cher&api_key=YOUR_API_KEY&format=json', description: 'Most popular tracks for an artist.' },
      { path: '/?method=chart.getTopArtists&api_key=YOUR_API_KEY&format=json', description: 'Global top-artists chart.' },
      { path: '/?method=tag.getTopTracks&tag=rock&api_key=YOUR_API_KEY&format=json', description: 'Top tracks for a genre tag.' },
    ],
  },
  {
    slug: /^trakt$/,
    endpoints: [
      { path: '/movies/trending?extended=full', description: 'Trending movies with full metadata.', monitored: true },
      { path: '/search/movie?query=fight+club', description: 'Search movies and shows by title.' },
      { path: '/shows/tt0903747?extended=full', description: 'Show details by IMDb ID (Breaking Bad example).' },
      { path: '/calendars/all/shows/2026-07-05/7', description: 'Upcoming episode air dates for all shows.' },
    ],
  },
  {
    slug: /^simkl$/,
    host: /api\.simkl\.com/i,
    endpoints: [
      { path: '/movies/trending', description: 'Movies trending on Simkl right now.', monitored: true },
      { path: '/tv/trending', description: 'TV series trending this week.' },
      { path: '/anime/trending', description: 'Anime trending across the community.' },
      { path: '/movies/54114', description: 'Movie details by Simkl ID.' },
      { path: '/search/movie?q=matrix', description: 'Search movies by title (client_id required).' },
    ],
  },
  {
    slug: /^watchmode$/,
    host: /api\.watchmode\.com/i,
    endpoints: [
      { path: '/sources/?apiKey=YOUR_API_KEY', description: 'All streaming sources Watchmode tracks.', monitored: true },
      { path: '/search/?apiKey=YOUR_API_KEY&search_field=name&search_value=breaking%20bad', description: 'Search titles by name.' },
      { path: '/title/345534/details/?apiKey=YOUR_API_KEY', description: 'Title metadata by Watchmode ID.' },
      { path: '/title/345534/sources/?apiKey=YOUR_API_KEY', description: 'Streaming sources for a title by region.' },
    ],
  },
  {
    slug: /^rick-and-morty$/,
    host: /rickandmortyapi\.com/i,
    endpoints: [
      { path: '/character/1', description: 'Character sheet with status, species and episodes.', monitored: true },
      { path: '/character', description: 'Paginated list of all characters.' },
      { path: '/location/1', description: 'Location metadata and residents.' },
      { path: '/episode/1', description: 'Episode record with character list.' },
    ],
  },
  {
    slug: /^kitsu$/,
    host: /kitsu\.io/i,
    endpoints: [
      { path: '/anime/1', description: 'Anime record with genres and episode count.', monitored: true },
      { path: '/anime?filter[text]=naruto', description: 'Search anime by title.' },
      { path: '/trending/anime', description: 'Trending anime on Kitsu.' },
      { path: '/anime/1/episodes', description: 'Episode list for an anime.' },
    ],
  },
  {
    slug: /^studio-ghibli$/,
    host: /ghibliapi\.(vercel\.app|dev)/i,
    endpoints: [
      { path: '/films', description: 'All Studio Ghibli films.', monitored: true },
      { path: '/films/574b58d0-3d93-4daf-8942-a54a890f8035', description: 'Single film by ID (My Neighbor Totoro).' },
      { path: '/people', description: 'People who worked on Ghibli films.' },
      { path: '/locations', description: 'Locations from the film catalog.' },
    ],
  },
  {
    slug: /^trace-moe$/,
    host: /api\.trace\.moe/i,
    endpoints: [
      { path: '/search?url=https://trace.moe/img/10.jpg', description: 'Identify anime from a screenshot URL.', monitored: true },
      { path: '/me', description: 'Your trace.moe API quota and usage.' },
    ],
  },
  {
    host: /musicbrainz\.org/i,
    endpoints: [
      { path: '/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da?fmt=json', description: 'Artist record by MusicBrainz ID (Nirvana).', monitored: true },
      { path: '/release?query=release:nevermind&fmt=json', description: 'Search releases by title.' },
      { path: '/recording?query=recording:smells+like+teen+spirit&fmt=json', description: 'Search recordings by title.' },
    ],
  },
  {
    host: /api\.discogs\.com/i,
    endpoints: [
      { path: '/database/search?q=nirvana&type=release', description: 'Search releases in the Discogs database.', monitored: true },
      { path: '/artists/125246', description: 'Artist profile by Discogs ID.' },
      { path: '/releases/249504', description: 'Release details with tracklist.' },
    ],
  },
  {
    host: /waifu\.im/i,
    endpoints: [
      { path: '/search', description: 'Random SFW anime image with tags.', monitored: true },
      { path: '/search?included_tags=waifu&is_nsfw=false', description: 'Filtered image search by tag.' },
    ],
  },
  {
    host: /waifu\.pics/i,
    endpoints: [
      { path: '/api/sfw', description: 'Random SFW waifu image URL.', monitored: true },
      { path: '/api/sfw/waifu', description: 'Random waifu category image.' },
      { path: '/api/sfw/neko', description: 'Random neko category image.' },
    ],
  },
  {
    slug: /^tmdb$/,
    endpoints: [
      { path: '/movie/550?api_key=YOUR_API_KEY', description: 'Full movie record — cast, crew, images and metadata.', monitored: true },
      { path: '/movie/popular?api_key=YOUR_API_KEY', description: 'Paginated list of popular movies right now.' },
      { path: '/tv/1399?api_key=YOUR_API_KEY', description: 'TV series details by TMDb ID (example: Game of Thrones).' },
      { path: '/search/multi?query=inception&api_key=YOUR_API_KEY', description: 'Search movies, TV and people in one call.' },
      { path: '/trending/movie/day?api_key=YOUR_API_KEY', description: 'Trending movies in the daily window.' },
      { path: '/movie/550/watch/providers?api_key=YOUR_API_KEY', description: 'Streaming availability by country for a movie.' },
    ],
  },
  {
    slug: /^omdb$/,
    endpoints: [
      { path: '/?t=Inception&apikey=trilogy', description: 'Lookup by title — plot, cast, ratings and poster.', monitored: true },
      { path: '/?i=tt1375666&apikey=trilogy', description: 'Lookup by IMDb ID (tt-prefixed).' },
      { path: '/?s=batman&type=movie&apikey=trilogy', description: 'Search movies and series by keyword.' },
      { path: '/?t=Inception&plot=full&apikey=trilogy', description: 'Full plot text instead of the short summary.' },
    ],
  },
  {
    slug: /^fanart-tv$/,
    endpoints: [
      { path: '/movies/550?api_key=YOUR_API_KEY', description: 'Movie artwork — posters, logos and backgrounds.', monitored: true },
      { path: '/tv/1399?api_key=YOUR_API_KEY', description: 'TV series artwork by TVDB ID.' },
      { path: '/music/c6017d8a-2c37-4d51-a1c3-9246cc7ebc25?api_key=YOUR_API_KEY', description: 'Music artist artwork by MusicBrainz ID.' },
    ],
  },
  {
    slug: /^imdb-api$/,
    endpoints: [
      { path: '/Title/knight/tt1375666/YourApiKey', description: 'Full title record by IMDb ID.', monitored: true },
      { path: '/SearchMovie/knight/YourApiKey', description: 'Search movies by keyword.' },
      { path: '/Top250Movies/YourApiKey', description: 'IMDb Top 250 movies list.' },
      { path: '/Title/knight/tt0903747/YourApiKey', description: 'TV series details (Breaking Bad example).' },
    ],
  },
  {
    slug: /^comic-vine$/,
    endpoints: [
      { path: '/api/characters/?api_key=YOUR_API_KEY&format=json&limit=10', description: 'Paginated character list.', monitored: true },
      { path: '/api/issues/?api_key=YOUR_API_KEY&format=json&limit=10', description: 'Recent comic issues.' },
      { path: '/api/search/?api_key=YOUR_API_KEY&format=json&query=batman&resources=character', description: 'Search characters by name.' },
    ],
  },
  {
    slug: /^musixmatch$/,
    endpoints: [
      { path: '/ws/1.1/chart.tracks.get?apikey=YOUR_API_KEY', description: 'Current chart tracks.', monitored: true },
      { path: '/ws/1.1/track.search?q_track=hello&apikey=YOUR_API_KEY', description: 'Search tracks by title.' },
      { path: '/ws/1.1/artist.search?q_artist=adele&apikey=YOUR_API_KEY', description: 'Search artists by name.' },
      { path: '/ws/1.1/matcher.lyrics.get?q_track=hello&q_artist=adele&apikey=YOUR_API_KEY', description: 'Lyrics for a track/artist match.' },
    ],
  },
  {
    slug: /^spotify-web-api$/,
    endpoints: [
      { path: '/v1/browse/new-releases?limit=5', description: 'New album releases (OAuth Bearer token required).', monitored: true },
      { path: '/v1/search?q=daft%20punk&type=artist&limit=5', description: 'Search artists, albums and tracks.' },
      { path: '/v1/artists/4tZwfgrHOc4mvQaXQtj0bZ', description: 'Artist profile by Spotify ID (Daft Punk).' },
      { path: '/v1/albums/2noRn2Aes5aoNVsU6iWThc', description: 'Album with track listing (Random Access Memories).' },
    ],
  },
  {
    slug: /^game-brain$/,
    endpoints: [
      { path: '/v1/games?query=first+person+shooter+from+2025', description: 'AI-powered game search by natural language.', monitored: true },
      { path: '/v1/games?query=open+world+rpg', description: 'Search games by genre and style keywords.' },
      { path: '/v1/games?query=indie+platformer', description: 'Discover indie titles matching a description.' },
    ],
  },
  {
    slug: /^rawg$/,
    host: /api\.rawg\.io/i,
    endpoints: [
      { path: '/api/games?key=YOUR_API_KEY&search=portal', description: 'Search games by title.', monitored: true },
      { path: '/api/games/3498?key=YOUR_API_KEY', description: 'Game details by RAWG ID (Grand Theft Auto V).' },
      { path: '/api/platforms?key=YOUR_API_KEY', description: 'All gaming platforms RAWG tracks.' },
      { path: '/api/genres?key=YOUR_API_KEY', description: 'Genre list with slug identifiers.' },
    ],
  },
  {
    slug: /^tvdb$/,
    endpoints: [
      { path: '/languages', description: 'Supported language codes for localized metadata.', monitored: true },
      { path: '/series/39340', description: 'Series record by TVDB ID (example: Breaking Bad).' },
      { path: '/search?query=breaking%20bad', description: 'Full-text series search.' },
      { path: '/series/39340/episodes/default', description: 'Default-ordered episode list for a series.' },
    ],
  },
  {
    slug: /^jikan$/,
    host: /api\.jikan\.moe/i,
    endpoints: [
      { path: '/v4/anime/1', description: 'Anime details by MyAnimeList ID.', monitored: true },
      { path: '/v4/anime?q=cowboy%20bebop&limit=5', description: 'Search anime by title.' },
      { path: '/v4/top/anime', description: 'Top-ranked anime list.' },
      { path: '/v4/seasons/now', description: 'Anime airing in the current season.' },
    ],
  },
  {
    slug: /^swapi-dev$/,
    host: /swapi\.dev/i,
    endpoints: [
      { path: '/people/1', description: 'Person record with homeworld and film links.', monitored: true },
      { path: '/films', description: 'All Star Wars films.' },
      { path: '/planets?search=tatooine', description: 'Search planets by name.' },
      { path: '/starships/9', description: 'Starship record (Death Star).' },
    ],
  },
  {
    slug: /^themealdb$/,
    host: /themealdb\.com/i,
    endpoints: [
      { path: '/random.php', description: 'Random meal with ingredients and thumbnail.', monitored: true },
      { path: '/search.php?s=Arrabiata', description: 'Search meals by name.' },
      { path: '/filter.php?c=Seafood', description: 'Filter meals by category.' },
      { path: '/lookup.php?i=52772', description: 'Meal details by ID.' },
    ],
  },
  {
    slug: /^tvmaze$/,
    host: /api\.tvmaze\.com/i,
    endpoints: [
      { path: '/shows/1', description: 'Show metadata, schedule and cast.', monitored: true },
      { path: '/search/shows?q=breaking%20bad', description: 'Search TV shows by title.' },
      { path: '/schedule?country=US&date=2026-07-05', description: 'Airing schedule for a country and date.' },
      { path: '/shows/1/episodes', description: 'Episode list for a show.' },
    ],
  },
  {
    slug: /^cat-facts$/,
    endpoints: [
      { path: '/fact', description: 'Random cat fact as JSON.', monitored: true },
      { path: '/facts?limit=3', description: 'Several random facts in one response.' },
    ],
  },
  {
    host: /pokeapi\.co/i,
    endpoints: [
      { path: '/pokemon/pikachu', description: 'Full Pokémon record — stats, types and sprites.', monitored: true },
      { path: '/pokemon?limit=20&offset=0', description: 'Paginated list of Pokémon.' },
      { path: '/type/fire', description: 'Type metadata and member Pokémon.' },
      { path: '/ability/stench', description: 'Ability details and Pokémon that have it.' },
    ],
  },
  {
    host: /api\.nasa\.gov/i,
    endpoints: [
      { path: '/planetary/apod?api_key=DEMO_KEY', description: 'Astronomy Picture of the Day.', monitored: true },
      { path: '/neo/rest/v1/feed?start_date=2026-01-01&end_date=2026-01-07&api_key=DEMO_KEY', description: 'Near-Earth object close approaches.' },
    ],
  },
  {
    host: /openlibrary\.org/i,
    endpoints: [
      { path: '/search.json?q=python&limit=3', description: 'Full-text book search.', monitored: true },
      { path: '/works/OL45804W.json', description: 'Work metadata by Open Library work ID.' },
      { path: '/authors/OL23919A.json', description: 'Author record by OLID.' },
      { path: '/subjects/science.json?limit=5', description: 'Books tagged with a subject.' },
    ],
  },
  {
    host: /api\.coingecko\.com/i,
    endpoints: [
      { path: '/ping', description: 'API status ping.', monitored: true },
      { path: '/simple/price?ids=bitcoin&vs_currencies=usd', description: 'Spot price for one or more coin IDs.' },
      { path: '/coins/list', description: 'All supported coin IDs and symbols.' },
      { path: '/search/trending', description: 'Trending coins in the last 24 hours.' },
    ],
  },
  {
    host: /restcountries\.com/i,
    endpoints: [
      { path: '/name/germany?fields=name,capital,population,flags', description: 'Country by common name with field filter.', monitored: true },
      { path: '/alpha/DEU', description: 'Country by ISO alpha-3 code.' },
      { path: '/region/europe?fields=name,capital', description: 'All countries in a region.' },
      { path: '/currency/eur', description: 'Countries that use a given currency.' },
    ],
  },
  {
    host: /open-meteo\.com/i,
    endpoints: [
      { path: '/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m', description: 'Current and forecast weather for coordinates.', monitored: true },
      { path: '/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m,precipitation', description: 'Hourly forecast variables.' },
      { path: '/air-quality?latitude=52.52&longitude=13.41&current=us_aqi,pm2_5', description: 'Air-quality index at a point.' },
      { path: '/elevation?latitude=52.52&longitude=13.41', description: 'Terrain elevation in meters.' },
    ],
  },
]
