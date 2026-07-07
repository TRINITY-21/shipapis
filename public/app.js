/* shipapis.dev — client behavior. Vanilla, delegated, no framework.
   Sections: theme · copy · tabs · filter/search · tooltips · sparkline crosshair
   · try-it console · command palette · stat count-up · mobile menu */
(function () {
  'use strict'

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- tiny helpers ---------- */

  function $(sel, root) { return (root || document).querySelector(sel) }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)) }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  /* client-side JSON highlighter — mirrors the SSR one. hlJsonStr takes an already-stringified
     JSON string (so we can highlight a trimmed slice); hlJson stringifies a value first. */
  function hlJsonStr(jsonStr) {
    return escHtml(jsonStr).replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      function (m) {
        var cls = 'j-num'
        if (m.charAt(0) === '"' || m.indexOf('&quot;') === 0) cls = /:$/.test(m) ? 'j-key' : 'j-str'
        else if (/true|false|null/.test(m)) cls = 'j-bool'
        return '<span class="' + cls + '">' + m + '</span>'
      }
    )
  }
  function hlJson(value) {
    return hlJsonStr(JSON.stringify(value, null, 2))
  }

  /* Render a live-probe response body. Parse the WHOLE response first, then pretty-print and
     highlight it — trimming the FORMATTED output by whole lines so we never cut a token or fall
     back to a raw single-line blob. Non-JSON bodies (HTML, plain text) show trimmed raw text. */
  function renderJsonBody(bodyEl, text, maxChars) {
    var value, isJson = true
    try { value = JSON.parse(text) } catch (e) { isJson = false }
    if (isJson) {
      var pretty = JSON.stringify(value, null, 2)
      if (pretty.length <= maxChars) { bodyEl.innerHTML = hlJsonStr(pretty); return }
      var lines = pretty.split('\n'), keep = [], used = 0
      for (var i = 0; i < lines.length && used + lines[i].length + 1 <= maxChars; i++) {
        keep.push(lines[i]); used += lines[i].length + 1
      }
      bodyEl.innerHTML = hlJsonStr(keep.join('\n')) +
        '\n<span class="j-punc">… truncated · showing ' + keep.length + ' of ' +
        lines.length.toLocaleString() + ' lines (' + text.length.toLocaleString() + ' chars total)</span>'
    } else {
      var shown = text.length > maxChars ? text.slice(0, maxChars) : text
      bodyEl.textContent = shown
      if (text.length > maxChars) {
        bodyEl.innerHTML += '\n<span class="j-punc">… truncated (' + text.length.toLocaleString() + ' chars total)</span>'
      }
    }
  }

  /* ---------- delegated clicks: copy · tabs · theme · menu ---------- */

  document.addEventListener('click', function (e) {
    var t

    var navMenu = $('#nav-menu')
    if (navMenu && navMenu.classList.contains('open') && !e.target.closest('#menu-btn') && !e.target.closest('#nav-menu')) {
      navMenu.classList.remove('open')
      var mb0 = $('#menu-btn')
      if (mb0) mb0.setAttribute('aria-expanded', 'false')
    }

    var tipEl = e.target.closest('[data-tip]')
    if (tipEl && !e.target.closest('a')) {
      var tr = tipEl.getBoundingClientRect()
      showTip(tipEl.getAttribute('data-tip'), tr.left + tr.width / 2, tr.top)
      clearTimeout(showTip._t)
      showTip._t = setTimeout(hideTip, 1600)
      return
    }

    t = e.target.closest('[data-copy]')
    if (t) {
      navigator.clipboard.writeText(t.getAttribute('data-copy')).then(function () {
        var old = t.textContent
        t.classList.add('did')
        t.textContent = 'COPIED'
        setTimeout(function () { t.classList.remove('did'); t.textContent = old }, 1400)
      })
      return
    }

    t = e.target.closest('[role="tab"]')
    if (t) { activateTab(t); return }

    t = e.target.closest('[data-theme-toggle]')
    if (t) {
      var toLight = document.documentElement.getAttribute('data-theme') !== 'light'
      if (toLight) document.documentElement.setAttribute('data-theme', 'light')
      else document.documentElement.removeAttribute('data-theme')
      // Keep every theme toggle in sync (top bar + the one in the mobile menu).
      var toggles = document.querySelectorAll('[data-theme-toggle]')
      for (var ti = 0; ti < toggles.length; ti++) toggles[ti].setAttribute('aria-pressed', String(toLight))
      try { localStorage.setItem('shipapis-theme', toLight ? 'light' : '') } catch (err) {}
      return
    }

    t = e.target.closest('#menu-btn')
    if (t) {
      var menu = $('#nav-menu')
      var open = !menu.classList.contains('open')
      menu.classList.toggle('open', open)
      t.setAttribute('aria-expanded', String(open))
      return
    }

    t = e.target.closest('.pick-trigger')
    if (t) {
      togglePickMenu(t.closest('.pick-menu'))
      return
    }

    t = e.target.closest('.pick-opt')
    if (t) { selectPickOpt(t); return }

    if (!e.target.closest('.pick-menu')) closeAllPickMenus()

    t = e.target.closest('.facet[data-facet]')
    if (t) { toggleFacet(t); return }

    t = e.target.closest('[data-clear-search]')
    if (t) {
      if (q) { q.value = ''; filterItems(); q.focus() }
      return
    }

    /* header "Run live" — scroll to the try console and fire it (falls back to #try anchor sans JS) */
    t = e.target.closest('[data-run-live]')
    if (t) {
      var runBtn = $('.try-run')
      if (runBtn) {
        e.preventDefault()
        runBtn.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
        if (!runBtn.disabled) runBtn.click()
      }
      return
    }

    t = e.target.closest('[data-palette-open]')
    if (t) { openPalette(t); return }
  })

  /* ---------- ARIA tabs (with arrow keys) ---------- */

  function activateTab(tab) {
    var list = tab.closest('[role="tablist"]')
    var box = tab.closest('.codeblock')
    if (!list || !box) return
    var idx = tab.getAttribute('data-tab')
    $$('[role="tab"]', list).forEach(function (el) {
      var on = el === tab
      el.classList.toggle('on', on)
      el.setAttribute('aria-selected', String(on))
      el.setAttribute('tabindex', on ? '0' : '-1')
    })
    $$('[data-pane]', box).forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-pane') === idx)
    })
    tab.focus()
  }

  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]')
    if (!tab) return
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    var tabs = $$('[role="tab"]', tab.closest('[role="tablist"]'))
    var i = tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1)
    activateTab(tabs[(i + tabs.length) % tabs.length])
  })

  /* ---------- pick menus (custom dropdowns — browse category + submit form) ---------- */

  var openPickMenu = null
  var openPickHighlight = 0

  function pickOpts(menu) { return $$('.pick-opt', menu) }

  function pickLabelFor(menu, val) {
    var opt = pickOpts(menu).find(function (o) { return o.getAttribute('data-value') === val })
    return opt ? (opt.textContent || '').trim() : val
  }

  function syncPickMenu(menu) {
    var val = menu.getAttribute('data-value') || 'all'
    var trigger = $('.pick-trigger', menu)
    var hidden = $('input[type="hidden"]', menu)
    var labelEl = $('.pick-label', menu)
    if (labelEl) labelEl.textContent = pickLabelFor(menu, val)
    if (hidden) hidden.value = val
    if (trigger && menu.id === 'cat-menu') trigger.classList.toggle('on', val !== 'all')
    pickOpts(menu).forEach(function (o) {
      var on = o.getAttribute('data-value') === val
      o.classList.toggle('on', on)
      o.setAttribute('aria-selected', String(on))
    })
  }

  function setPickValue(menu, val) {
    if (!menu) return
    menu.setAttribute('data-value', val)
    syncPickMenu(menu)
    if (menu.id === 'cat-menu') collectFacets()
  }

  function closePickMenu(menu) {
    if (!menu) return
    var trigger = $('.pick-trigger', menu)
    var panel = $('.pick-panel', menu)
    if (panel) panel.hidden = true
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false')
      trigger.removeAttribute('aria-activedescendant')
    }
    pickOpts(menu).forEach(function (o) { o.classList.remove('sel') })
    if (openPickMenu === menu) openPickMenu = null
  }

  function closeAllPickMenus() { $$('.pick-menu').forEach(closePickMenu) }

  function highlightPickOpt(menu) {
    pickOpts(menu).forEach(function (o, i) {
      o.classList.toggle('sel', i === openPickHighlight)
      if (i === openPickHighlight) o.scrollIntoView({ block: 'nearest' })
    })
    var trigger = $('.pick-trigger', menu)
    var active = pickOpts(menu)[openPickHighlight]
    if (trigger && active) trigger.setAttribute('aria-activedescendant', active.id)
  }

  function openPickMenuPanel(menu) {
    closeAllPickMenus()
    var trigger = $('.pick-trigger', menu)
    var panel = $('.pick-panel', menu)
    if (!panel) return
    panel.hidden = false
    if (trigger) trigger.setAttribute('aria-expanded', 'true')
    openPickMenu = menu
    openPickHighlight = Math.max(0, pickOpts(menu).findIndex(function (o) { return o.classList.contains('on') }))
    highlightPickOpt(menu)
  }

  function togglePickMenu(menu) {
    if (!menu) return
    if (openPickMenu === menu) closePickMenu(menu)
    else openPickMenuPanel(menu)
  }

  function selectPickOpt(opt) {
    var menu = opt.closest('.pick-menu')
    if (!menu) return
    setPickValue(menu, opt.getAttribute('data-value'))
    closePickMenu(menu)
    var trigger = $('.pick-trigger', menu)
    if (trigger) trigger.focus()
  }

  function initPickMenus() {
    $$('.pick-menu').forEach(function (menu) {
      if (menu.dataset.pickInit) return
      menu.dataset.pickInit = '1'
      syncPickMenu(menu)
      pickOpts(menu).forEach(function (o, i) {
        if (!o.id) o.id = (menu.id || 'pick') + '-opt-' + i
      })
    })
  }

  initPickMenus()

  /* ---------- filter system: search + facets + empty state + home rails ---------- */

  var q = $('#q')
  var rails = $('#rails')
  var results = $('#results')
  var activeFacets = []

  function filterItems() {
    var scope = results || document
    var items = $$(results ? '#results [data-search]' : '[data-search]', document)
    var query = q ? q.value.trim().toLowerCase() : ''
    var n = 0
    items.forEach(function (el) {
      var hitQ = !query || el.getAttribute('data-search').indexOf(query) !== -1
      var facets = el.getAttribute('data-facets') || ''
      var hitF = activeFacets.every(function (f) { return facets.indexOf(f) !== -1 })
      var show = hitQ && hitF
      el.classList.toggle('hidden', !show)
      if (show) n++
    })
    var count = $('#q-count')
    if (count) {
      count.textContent = query || activeFacets.length
        ? n + ' MATCH' + (n === 1 ? '' : 'ES')
        : items.length + ' IN CATALOG'
    }
    var sr = $('#sr-count')
    if (sr) sr.textContent = query || activeFacets.length ? n + ' matching APIs' : ''
    var empty = $('[data-empty]', scope === document ? document : results)
    if (empty) empty.classList.toggle('show', n === 0)
    if (rails && results) {
      var searching = query.length > 0
      var entering = searching && !rails.hidden
      rails.hidden = searching
      results.hidden = !searching
      if (entering) {
        results.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
      }
    }
  }

  function syncFacetAria() {
    $$('.facet[data-facet]').forEach(function (el) {
      el.setAttribute('aria-pressed', String(el.classList.contains('on')))
    })
  }

  /* the category pick menu (browse) joins the facet chips in one activeFacets pool */
  var catMenu = $('#cat-menu')

  function collectFacets() {
    activeFacets = $$('.facet.on[data-facet]')
      .map(function (el) { return el.getAttribute('data-facet') })
      .filter(function (x) { return x !== 'all' })
    if (catMenu) {
      var catVal = catMenu.getAttribute('data-value') || 'all'
      if (catVal !== 'all') activeFacets.push(catVal)
    }
    var allChip = $('.facet[data-facet="all"]')
    if (allChip) allChip.classList.toggle('on', activeFacets.length === 0)
    syncFacetAria()
    filterItems()
  }

  function toggleFacet(chip) {
    var f = chip.getAttribute('data-facet')
    if (f === 'all') {
      $$('.facet[data-facet]').forEach(function (el) {
        el.classList.toggle('on', el.getAttribute('data-facet') === 'all')
      })
      setPickValue(catMenu, 'all')
    } else {
      chip.classList.toggle('on')
    }
    collectFacets()
  }

  if (q) {
    q.addEventListener('input', filterItems)
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { q.value = ''; filterItems(); q.blur() }
    })
  }

  /* pick up a server-preselected facet (from /browse?facet=…) and apply it */
  activeFacets = $$('.facet.on[data-facet]')
    .map(function (el) { return el.getAttribute('data-facet') })
    .filter(function (x) { return x !== 'all' })
  if (catMenu) {
    var catVal = catMenu.getAttribute('data-value') || 'all'
    if (catVal !== 'all') activeFacets.push(catVal)
  }
  if (activeFacets.length) filterItems()

  /* deep-linked search (?q=… — also the target of the WebSite SearchAction in JSON-LD) */
  if (q && !q.value) {
    var deepQ = new URLSearchParams(location.search).get('q')
    if (deepQ) { q.value = deepQ; filterItems() }
  }

  /* ---------- chart tooltips ---------- */

  var tip = document.createElement('div')
  tip.className = 'tip'
  tip.setAttribute('aria-hidden', 'true')
  document.body.appendChild(tip)

  function showTip(html, x, y) {
    tip.innerHTML = html
    tip.classList.add('show')
    var r = tip.getBoundingClientRect()
    var left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8)
    var top = y - r.height - 10
    if (top < 8) top = y + 14
    tip.style.left = left + 'px'
    tip.style.top = top + 'px'
  }
  function hideTip() { tip.classList.remove('show') }

  document.addEventListener('mouseover', function (e) {
    var b = e.target.closest && e.target.closest('[data-tip]')
    if (!b) return
    var r = b.getBoundingClientRect()
    showTip(b.getAttribute('data-tip'), r.left + r.width / 2, r.top)
  })
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('[data-tip]')) hideTip()
  })

  /* sparkline crosshair */
  $$('.spark-wrap').forEach(function (wrap) {
    var points = (wrap.getAttribute('data-points') || '').split(',').map(Number)
    if (!points.length) return
    var min = Math.min.apply(null, points)
    var max = Math.max.apply(null, points)
    var span = Math.max(1, max - min)
    var cross = document.createElement('div')
    cross.className = 'spark-cross'
    cross.innerHTML = '<i></i>'
    wrap.appendChild(cross)
    var dot = cross.firstChild

    wrap.addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect()
      var frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      var i = Math.round(frac * (points.length - 1))
      var x = (i / (points.length - 1)) * r.width
      cross.style.left = x + 'px'
      var pad = 3
      var yFrac = (pad + (1 - (points[i] - min) / span) * (56 - pad * 2)) / 56
      dot.style.top = 'calc(' + (yFrac * 100).toFixed(2) + '% - 4px)'
      showTip(
        '<span class="muted">check ' + (i + 1 - points.length) + '</span> · <b>' + points[i] + ' ms</b>',
        r.left + x,
        r.top
      )
    })
    wrap.addEventListener('mouseleave', hideTip)
  })

  /* ---------- try-it console ---------- */

  $$('.try-run').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-try-url')
      var out = $('.try-out', btn.closest('.try'))
      var statusEl = $('.try-status', out)
      var bodyEl = $('.try-body', out)
      var label = btn.textContent
      btn.disabled = true
      btn.textContent = 'PINGING…'
      out.hidden = false
      statusEl.innerHTML = '<span class="k">LIVE · CALLING FROM YOUR BROWSER…</span>'
      bodyEl.textContent = ''

      var ctl = new AbortController()
      var timer = setTimeout(function () { ctl.abort() }, 8000)
      var t0 = performance.now()

      bodyEl.classList.add('skeleton')
      bodyEl.textContent = '░░░░░░░░░░░░░░░░░░░░░░░░░░\n░░░░░░░░░░░░░░\n░░░░░░░░░░░░░░░░░░░░'

      fetch(url, { signal: ctl.signal })
        .then(function (res) {
          var ms = Math.round(performance.now() - t0)
          return res.text().then(function (text) {
            clearTimeout(timer)
            var cls = res.ok ? 'ok' : 'bad'
            statusEl.innerHTML =
              '<span class="k ' + cls + '">HTTP ' + res.status + '</span>' +
              '<span class="k">' + ms + ' MS</span>' +
              '<span class="k muted">FETCHED FROM YOUR BROWSER · JUST NOW</span>'
            renderJsonBody(bodyEl, text, 8000)
          })
        })
        .catch(function (err) {
          clearTimeout(timer)
          var why = err.name === 'AbortError'
            ? 'TIMEOUT AFTER 8S'
            : 'BLOCKED — LIKELY CORS OR NETWORK. THE CURL SNIPPET WILL STILL WORK.'
          statusEl.innerHTML = '<span class="k bad">FAILED</span><span class="k muted">' + why + '</span>'
          bodyEl.textContent = String(err)
        })
        .finally(function () {
          bodyEl.classList.remove('skeleton')
          btn.disabled = false
          btn.textContent = label.replace('Run it', 'Run again').replace('▶ ', '↺ ')
        })
    })
  })

  /* ---------- submit page: live validation probe ---------- */

  var sform = $('#submit-form')
  if (sform) {
    var probeGen = 0
    var probeCtl = null
    sform.addEventListener('submit', function (e) {
      e.preventDefault()
      if (probeCtl) probeCtl.abort() /* a resubmit supersedes any in-flight probe */
      var gen = ++probeGen
      var data = {}
      new FormData(sform).forEach(function (v, k) { data[k] = String(v).trim() })
      var out = $('.try-out', sform)
      var statusEl = $('.try-status', out)
      var bodyEl = $('.try-body', out)
      var goBtn = $('button[type="submit"]', sform)
      var url = data.base_url.replace(/\/+$/, '') +
        (data.sample_endpoint.charAt(0) === '/' ? '' : '/') + data.sample_endpoint
      out.hidden = false
      if (goBtn) goBtn.disabled = true
      statusEl.innerHTML = '<span class="k">LIVE · PROBING FROM YOUR BROWSER…</span>'
      bodyEl.classList.add('skeleton')
      bodyEl.textContent = '░░░░░░░░░░░░░░░░░░░░░░░░░░\n░░░░░░░░░░░░░░'

      var ctl = new AbortController()
      probeCtl = ctl
      var timer = setTimeout(function () { ctl.abort() }, 8000)
      var t0 = performance.now()

      function probeDone(label, ok, body) {
        if (gen !== probeGen) return /* superseded by a newer probe */
        if (goBtn) goBtn.disabled = false
        bodyEl.classList.remove('skeleton')
        statusEl.innerHTML =
          '<span class="k ' + (ok ? 'ok' : 'bad') + '">' + label + '</span>' +
          (ok ? '' : '<span class="k muted">A CORS BLOCK HERE DOESN\'T DISQUALIFY IT — WE VERIFY BEFORE LISTING</span>')
        renderJsonBody(bodyEl, body, 3000)
        data.browser_probe = (ok ? 'passed · ' : 'failed · ') + label.toLowerCase()
        var json = JSON.stringify(data, null, 2)
        var next = $('#submit-next')
        $('#submission-json').textContent = json
        $('#submission-copy').setAttribute('data-copy', json)
        $('#submit-mail').setAttribute(
          'href',
          'mailto:hello@shipapis.dev?subject=' + encodeURIComponent('API submission: ' + data.name) +
            '&body=' + encodeURIComponent(json)
        )
        next.hidden = false
        next.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' })
      }

      fetch(url, { signal: ctl.signal })
        .then(function (res) {
          return res.text().then(function (text) {
            clearTimeout(timer)
            var ms = Math.round(performance.now() - t0)
            probeDone('HTTP ' + res.status + ' · ' + ms + ' MS', res.ok, text)
          })
        })
        .catch(function (err) {
          clearTimeout(timer)
          if (gen === probeGen) {
            probeDone(err.name === 'AbortError' ? 'TIMEOUT AFTER 8S' : 'BLOCKED — CORS OR NETWORK', false, String(err))
          }
        })
    })
  }

  /* ---------- newsletter — mailto until the subscribe endpoint lands ---------- */

  $$('form.newsletter').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      var email = form.email.value.trim()
      if (!email) return
      location.href = 'mailto:hello@shipapis.dev?subject=' + encodeURIComponent('subscribe · the signal') +
        '&body=' + encodeURIComponent('Add me to the list: ' + email)
      var btn = $('button[type="submit"]', form)
      if (btn) {
        var old = btn.textContent
        btn.innerHTML = 'CHECK YOUR MAIL APP <svg class="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'
        setTimeout(function () { btn.textContent = old }, 3500)
      }
    })
  })

  /* ---------- keyboard-shortcut help (?) ---------- */

  var kbdOverlay = $('#kbd-overlay')
  var kbdLastFocus = null
  function toggleKbd(open) {
    if (!kbdOverlay) return
    if (open === kbdOverlay.classList.contains('open')) return
    kbdOverlay.classList.toggle('open', open)
    if (open) {
      kbdLastFocus = document.activeElement
      var help = $('.kbd-help', kbdOverlay)
      if (help) help.focus()
    } else {
      if (kbdLastFocus && kbdLastFocus.focus) kbdLastFocus.focus()
      kbdLastFocus = null
    }
  }
  if (kbdOverlay) {
    kbdOverlay.addEventListener('mousedown', function (e) {
      if (!e.target.closest('.kbd-help')) toggleKbd(false)
    })
  }

  /* ---------- command palette (⌘K) ---------- */

  var paletteData = null
  var lastInvoker = null
  var overlay = $('#palette-overlay')
  var pInput = $('#palette-input')
  var pList = $('#palette-list')
  var pSel = 0

  function loadIndex() {
    if (paletteData) return paletteData
    var el = $('#api-index')
    paletteData = el ? JSON.parse(el.textContent) : []
    return paletteData
  }

  function renderPalette() {
    var query = pInput.value.trim().toLowerCase()
    var items = loadIndex().filter(function (a) {
      return !query || (a.name + ' ' + a.category).toLowerCase().indexOf(query) !== -1
    }).slice(0, 8)
    pSel = Math.min(pSel, Math.max(0, items.length - 1))
    if (!items.length) {
      pList.innerHTML = '<div class="palette-empty"><span class="k">NO SIGNAL — NOTHING MATCHES</span></div>'
      return
    }
    pList.innerHTML = items.map(function (a, i) {
      var fb = a.emoji ? '<span class="glyph-fb">' + a.emoji + '</span>' : ''
      var icon = fb + (a.iconHost
        ? '<img class="glyph-img" src="/icons/' + encodeURIComponent(a.iconHost) + '?sz=32&v=3" alt="" width="22" height="22" loading="lazy" decoding="async" onload="this.closest(\'[data-api-glyph]\')?.classList.add(\'glyph-ok\')" onerror="this.closest(\'[data-api-glyph]\')?.classList.add(\'glyph-miss\')" />'
        : '')
      return (
        '<a class="palette-item' + (i === pSel ? ' sel' : '') + '" role="option" id="pal-opt-' + i + '" aria-selected="' + (i === pSel) + '" href="/api/' + a.slug + '">' +
        '<span class="glyph" data-api-glyph aria-hidden="true">' + icon + '</span>' +
        '<b>' + escHtml(a.name) + '</b>' +
        '<span class="k">' + escHtml(a.category).toUpperCase() + ' · ' + a.health + '</span>' +
        '</a>'
      )
    }).join('')
    pInput.setAttribute('aria-activedescendant', items.length ? 'pal-opt-' + pSel : '')
  }

  function openPalette(invoker) {
    if (!overlay) return
    // Close the mobile hamburger menu if the palette was opened from inside it (the in-menu search).
    var nm = $('#nav-menu')
    if (nm && nm.classList.contains('open')) {
      nm.classList.remove('open')
      var mb = $('#menu-btn')
      if (mb) mb.setAttribute('aria-expanded', 'false')
    }
    lastInvoker = invoker || document.activeElement
    overlay.classList.add('open')
    pInput.value = ''
    pSel = 0
    renderPalette()
    pInput.focus()
  }
  function closePalette() {
    if (overlay) overlay.classList.remove('open')
    if (lastInvoker && lastInvoker.focus) lastInvoker.focus()
    lastInvoker = null
  }

  if (overlay) {
    pInput.addEventListener('input', function () { pSel = 0; renderPalette() })
    overlay.addEventListener('mousedown', function (e) {
      if (!e.target.closest('.palette')) closePalette()
    })
  }

  /* The homepage hero search launches the ⌘K palette instead of filtering inline. Scoped by the
     [data-palette-launch] marker on the hero input alone — the browse page reuses #q inside a
     .prompt too, so it keeps its own inline filter. The invoker handed to openPalette is the nav
     search pill, so closing returns focus there, never back onto this field (refocusing it would
     re-fire 'focus' → reopen in a loop). */
  if (q && overlay && q.hasAttribute('data-palette-launch')) {
    q.readOnly = true
    var openFromHero = function (e) {
      if (e) e.preventDefault()
      if (overlay.classList.contains('open')) return
      q.blur()
      openPalette($('[data-palette-open]') || document.body)
    }
    q.addEventListener('mousedown', openFromHero)
    q.addEventListener('focus', openFromHero)
  }

  document.addEventListener('keydown', function (e) {
    var pickTrig = e.target.closest && e.target.closest('.pick-trigger')
    if (pickTrig && !openPickMenu) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openPickMenuPanel(pickTrig.closest('.pick-menu'))
        return
      }
    }
    if (openPickMenu) {
      var opts = pickOpts(openPickMenu)
      if (e.key === 'Escape') {
        e.preventDefault()
        closePickMenu(openPickMenu)
        var pt = $('.pick-trigger', openPickMenu)
        if (pt) pt.focus()
        return
      }
      if (e.key === 'Tab') { closeAllPickMenus(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        openPickHighlight = Math.min(openPickHighlight + 1, opts.length - 1)
        highlightPickOpt(openPickMenu)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        openPickHighlight = Math.max(openPickHighlight - 1, 0)
        highlightPickOpt(openPickMenu)
        return
      }
      if (e.key === 'Enter' && opts[openPickHighlight]) {
        e.preventDefault()
        selectPickOpt(opts[openPickHighlight])
        return
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      toggleKbd(false) /* the palette supersedes the shortcut help */
      overlay && overlay.classList.contains('open') ? closePalette() : openPalette()
      return
    }
    if (kbdOverlay && kbdOverlay.classList.contains('open') && e.key === 'Tab') {
      e.preventDefault() /* nothing tabbable inside the help dialog — keep focus in place */
      return
    }
    if (overlay && overlay.classList.contains('open')) {
      var items = $$('.palette-item', pList)
      if (e.key === 'Tab') { e.preventDefault(); return }
      if (e.key === 'Escape') { closePalette(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); pSel = Math.min(pSel + 1, items.length - 1); renderPalette() }
      if (e.key === 'ArrowUp') { e.preventDefault(); pSel = Math.max(pSel - 1, 0); renderPalette() }
      if (e.key === 'Enter' && items[pSel]) { window.location.href = items[pSel].getAttribute('href') }
      return
    }
    if (e.key === 'Escape') {
      if (kbdOverlay && kbdOverlay.classList.contains('open')) { toggleKbd(false); return }
      var m = $('#nav-menu')
      if (m && m.classList.contains('open')) {
        m.classList.remove('open')
        var mb = $('#menu-btn')
        if (mb) { mb.setAttribute('aria-expanded', 'false'); mb.focus() }
      }
      return
    }
    var tag = (document.activeElement && document.activeElement.tagName) || ''
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      if (q) q.focus()
      else openPalette()
      return
    }
    if (e.key === '?') {
      e.preventDefault()
      toggleKbd(!kbdOverlay || !kbdOverlay.classList.contains('open'))
    }
  })

  /* ---------- loadbar — scanline shown only while a navigation is in flight ---------- */

  var loadbar = $('#loadbar')
  var loadbarTimer = null

  function loadbarStart() {
    if (!loadbar) return
    loadbar.classList.remove('done')
    void loadbar.offsetWidth /* restart the run animation */
    loadbar.classList.add('on')
    clearTimeout(loadbarTimer)
    loadbarTimer = setTimeout(loadbarStop, 8000) /* canceled navigations shouldn't strand the bar */
  }
  function loadbarStop() {
    if (!loadbar) return
    clearTimeout(loadbarTimer)
    if (!loadbar.classList.contains('on')) return
    loadbar.classList.remove('on')
    loadbar.classList.add('done')
    setTimeout(function () { loadbar.classList.remove('done') }, 240)
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]')
    if (!a || e.defaultPrevented) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (a.target === '_blank' || a.hasAttribute('download')) return
    if (a.origin !== location.origin) return
    if (a.pathname === location.pathname && a.hash) return /* in-page anchor */
    loadbarStart()
  })
  window.addEventListener('pageshow', loadbarStop) /* covers bfcache restores too */

  /* detail nav — active tab follows document scroll order; nav link order follows layout */
  var detailNav = document.querySelector('[data-detail-nav]')
  if (detailNav) {
    var navLinks = $$('a[href^="#"]', detailNav)
    var sections = navLinks
      .map(function (a) {
        var el = document.querySelector(a.getAttribute('href'))
        return el ? { link: a, el: el } : null
      })
      .filter(Boolean)
    var navH = 104 /* site nav + detail strip */

    function syncDetailNav() {
      var y = window.scrollY + navH + 12
      var byScroll = sections.slice().sort(function (a, b) { return a.el.offsetTop - b.el.offsetTop })
      var current = byScroll[0]
      byScroll.forEach(function (s) {
        if (s.el.offsetTop <= y) current = s
      })
      navLinks.forEach(function (a) {
        a.classList.toggle('on', a === current.link)
      })
    }

    syncDetailNav()
    window.addEventListener('scroll', syncDetailNav, { passive: true })
    window.addEventListener('resize', syncDetailNav, { passive: true })
  }

  /* ---------- stat count-up (motion #3, gated) ---------- */

  if (!reducedMotion) {
    $$('[data-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10)
      if (!isFinite(target) || target === 0) return
      var t0 = null
      function frame(ts) {
        if (!t0) t0 = ts
        var p = Math.min(1, (ts - t0) / 700)
        var eased = 1 - Math.pow(1 - p, 3)
        el.textContent = Math.round(target * eased).toLocaleString('en-US')
        if (p < 1) requestAnimationFrame(frame)
      }
      el.textContent = '0'
      requestAnimationFrame(frame)
    })
  }
})()
