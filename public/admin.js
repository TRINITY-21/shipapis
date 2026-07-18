/* Admin console behaviour. Deliberately tiny and dependency-free — and, unlike app.js, it fires NO
   analytics events. Operator activity is not traffic. Every action here degrades to working HTML if
   this file fails to load. */
;(function () {
  'use strict'

  /* Approving mutates the public catalog, so it asks once. Rejection is reversible; this isn't
     (the row goes live immediately), which is the only reason there's a confirm at all. */
  var approve = document.querySelector('form[action$="/approve"]')
  if (approve) {
    approve.addEventListener('submit', function (e) {
      var name = (approve.querySelector('[name="name"]') || {}).value || 'this API'
      var slug = (approve.querySelector('[name="slug"]') || {}).value || ''
      if (!window.confirm('Publish "' + name + '" to the live catalog at /api/' + slug + '?')) {
        e.preventDefault()
      }
    })
  }

  /* Marking something as spam is a judgement call worth a beat of friction. */
  var spam = document.querySelector('button[value="spam"]')
  if (spam) {
    spam.addEventListener('click', function (e) {
      if (!window.confirm('Mark this submission as spam?')) e.preventDefault()
    })
  }

  /* Slug follows the name until the operator edits the slug themselves, then it stops fighting them. */
  var nameEl = document.querySelector('[name="name"]')
  var slugEl = document.querySelector('[name="slug"]')
  if (nameEl && slugEl) {
    var slugTouched = false
    slugEl.addEventListener('input', function () {
      slugTouched = true
    })
    nameEl.addEventListener('input', function () {
      if (slugTouched) return
      slugEl.value = nameEl.value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
    })
  }

  /* Description grows with its content — the field where the operator writes the most. */
  var ta = document.querySelector('textarea[name="description"]')
  if (ta) {
    var grow = function () {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight + 2, 520) + 'px'
    }
    ta.addEventListener('input', grow)
    grow()
  }
})()
