/*
 * Psyber Recommendations — embeddable widget script
 * ---------------------------------------------------
 * Drop this file into a Django template (or include it as a static asset
 * loaded after the markup). Self-contained, no dependencies, vanilla JS.
 *
 * Required markup hooks (already present in the page template):
 *   <section data-recommendations
 *            data-recommendations-max="3"
 *            data-recommendations-endpoint="/api/recommendations/<id>/toggle/"
 *            data-recommendations-method="POST">
 *      ...
 *      <ul data-recommendations-list>
 *         <li class="recommendations-card__item {% if rec.completed %}is-completed{% endif %}"
 *             data-recommendation
 *             data-recommendation-id="{{ rec.id }}">
 *            <button data-recommendation-toggle> ... </button>
 *            <p>{{ rec.text }}</p>
 *         </li>
 *         ...
 *      </ul>
 *      <p data-recommendations-all-done hidden>...</p>
 *      <button data-recommendations-toggle hidden>
 *         <span data-recommendations-toggle-show>View completed recommendations</span>
 *         <span data-recommendations-toggle-hide hidden>Hide completed recommendations</span>
 *      </button>
 *   </section>
 *
 * Endpoint contract (suggested — adapt to your URL conf):
 *   - URL pattern: anything you want; put it in data-recommendations-endpoint.
 *       The literal token "<id>" in the URL is replaced with the item's
 *       data-recommendation-id. If "<id>" is absent, the id is appended.
 *   - Method: POST by default; override with data-recommendations-method.
 *   - Body: JSON  { "completed": true | false }
 *   - Auth: same-origin cookies are sent.
 *   - CSRF: header "X-CSRFToken" is set from <meta name="csrf-token">
 *       if present, otherwise from cookie "csrftoken" (Django default).
 *   - Response: any 2xx counts as success. On non-2xx or network error
 *       the widget rolls the UI state back to keep it in sync with the DB.
 *
 * Init-time state: render the list with the current persisted state. Items
 * that are already completed should have class "is-completed" on the <li>.
 * The widget handles the rest (top-N visibility, completed section, toggle
 * link, all-done message).
 *
 * Re-init safe: the widget marks each section with data-recommendations-init
 * and skips already-initialised sections, so it is safe to include in a
 * shared bundle and also paste inline.
 */
(function () {
	function getCookie(name) {
		const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
		return m ? decodeURIComponent(m.pop()) : ''
	}

	function getCsrfToken() {
		const meta = document.querySelector('meta[name="csrf-token"]')
		if (meta && meta.getAttribute('content')) return meta.getAttribute('content')
		return getCookie('csrftoken')
	}

	function initCard(card) {
		if (card.dataset.recommendationsInit === '1') return
		card.dataset.recommendationsInit = '1'

		const list = card.querySelector('[data-recommendations-list]')
		if (!list) return

		const allDoneEl = card.querySelector('[data-recommendations-all-done]')
		const toggleBtn = card.querySelector('[data-recommendations-toggle]')
		const toggleShow = card.querySelector('[data-recommendations-toggle-show]')
		const toggleHide = card.querySelector('[data-recommendations-toggle-hide]')
		const max = parseInt(card.dataset.recommendationsMax, 10) || 3
		const endpoint = card.dataset.recommendationsEndpoint || ''
		const method = (card.dataset.recommendationsMethod || 'POST').toUpperCase()

		let completedRevealed = false

		function items() {
			return Array.from(list.querySelectorAll('[data-recommendation]'))
		}

		function refresh() {
			let visible = 0
			const all = items()
			all.forEach(function (item) {
				const isCompleted = item.classList.contains('is-completed')
				if (isCompleted) {
					if (completedRevealed) {
						item.classList.add('is-revealed')
						item.classList.remove('is-hidden')
					} else {
						item.classList.remove('is-revealed')
						item.classList.add('is-hidden')
					}
					return
				}
				if (visible < max) {
					item.classList.remove('is-hidden', 'is-revealed')
					visible++
				} else {
					item.classList.add('is-hidden')
					item.classList.remove('is-revealed')
				}
			})

			const completedCount = all.filter(function (i) {
				return i.classList.contains('is-completed')
			}).length
			const incompleteCount = all.length - completedCount

			if (allDoneEl) {
				if (incompleteCount === 0) allDoneEl.removeAttribute('hidden')
				else allDoneEl.setAttribute('hidden', '')
			}

			if (toggleBtn) {
				if (completedCount > 0) toggleBtn.removeAttribute('hidden')
				else {
					toggleBtn.setAttribute('hidden', '')
					completedRevealed = false
				}
			}

			if (toggleShow && toggleHide) {
				if (completedRevealed) {
					toggleShow.setAttribute('hidden', '')
					toggleHide.removeAttribute('hidden')
				} else {
					toggleShow.removeAttribute('hidden')
					toggleHide.setAttribute('hidden', '')
				}
			}
		}

		function persist(item, completed) {
			if (!endpoint) return Promise.resolve()
			const id = encodeURIComponent(item.dataset.recommendationId || '')
			const url = endpoint.indexOf('<id>') !== -1
				? endpoint.replace('<id>', id)
				: endpoint.replace(/\/?$/, '/') + id + '/'

			return fetch(url, {
				method: method,
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCsrfToken(),
					'X-Requested-With': 'XMLHttpRequest'
				},
				body: JSON.stringify({ completed: completed })
			}).then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status)
			})
		}

		list.addEventListener('click', function (e) {
			const btn = e.target.closest('[data-recommendation-toggle]')
			if (!btn) return
			const item = btn.closest('[data-recommendation]')
			if (!item) return

			const willBeCompleted = !item.classList.contains('is-completed')
			item.classList.toggle('is-completed')
			refresh()

			persist(item, willBeCompleted).catch(function () {
				// Roll back on failure so the UI keeps matching the server.
				item.classList.toggle('is-completed')
				refresh()
			})
		})

		if (toggleBtn) {
			toggleBtn.addEventListener('click', function () {
				completedRevealed = !completedRevealed
				refresh()
			})
		}

		refresh()
	}

	function boot() {
		document.querySelectorAll('[data-recommendations]').forEach(initCard)
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot)
	} else {
		boot()
	}
})()
