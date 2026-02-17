(function () {
	'use strict';

	let scrollObserver = null;
	let mutationObserver = null;

	/* ── Find the active article's content element ────────── */
	function findActiveArticleContent() {
		// Normal view: expanded article has .active on .flux, content in .text
		const active = document.querySelector('#stream .flux.active .content .text');
		if (active) return active;

		// Reader view: single .post element
		const post = document.querySelector('#stream .post');
		if (post) return post;

		// No active article found
		return null;
	}

	/* ── Create panel DOM (idempotent) ─────────────────────── */
	function createPanelElements() {
		if (document.getElementById('toc-panel')) return;

		const panel = document.createElement('div');
		panel.id = 'toc-panel';

		const toggle = document.createElement('button');
		toggle.id = 'toc-toggle';
		toggle.textContent = '☰';
		toggle.title = 'Toggle TOC';
		toggle.addEventListener('click', function () {
			panel.classList.toggle('collapsed');
			toggle.textContent = panel.classList.contains('collapsed') ? '☰' : '✕';
		});

		const title = document.createElement('div');
		title.className = 'toc-title';
		title.textContent = 'Table of Contents';

		const list = document.createElement('ol');
		list.id = 'toc-list';

		panel.appendChild(toggle);
		panel.appendChild(title);
		panel.appendChild(list);
		document.body.appendChild(panel);
	}

	/* ── Build TOC from headings ───────────────────────────── */
	function buildTOC() {
		const panel = document.getElementById('toc-panel');
		const list = document.getElementById('toc-list');
		if (!panel || !list) return;

		// Clean up previous observer
		if (scrollObserver) {
			scrollObserver.disconnect();
			scrollObserver = null;
		}
		list.innerHTML = '';

		const content = findActiveArticleContent();
		if (!content) {
			panel.style.display = 'none';
			return;
		}

		const headings = content.querySelectorAll('h2, h3, h4, h5, h6');
		if (headings.length < 2) {
			panel.style.display = 'none';
			return;
		}

		panel.style.display = '';

		headings.forEach(function (heading, index) {
			if (!heading.id) {
				heading.id = 'toc-heading-' + index;
			}

			const level = parseInt(heading.tagName.charAt(1), 10);
			const li = document.createElement('li');
			li.setAttribute('data-level', level);
			li.setAttribute('data-heading-id', heading.id);

			const a = document.createElement('a');
			a.href = '#' + heading.id;
			a.textContent = heading.textContent.trim();
			a.addEventListener('click', function (e) {
				e.preventDefault();
				heading.scrollIntoView({ behavior: 'smooth' });
			});

			li.appendChild(a);
			list.appendChild(li);
		});

		setupScrollTracking(headings);
	}

	/* ── Scroll tracking via IntersectionObserver ──────────── */
	function setupScrollTracking(headings) {
		if (!headings || headings.length === 0) return;

		scrollObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						const id = entry.target.id;
						const items = document.querySelectorAll('#toc-list li');
						items.forEach(function (li) {
							li.classList.toggle(
								'toc-active',
								li.getAttribute('data-heading-id') === id
							);
						});

						// Scroll active item into view inside the TOC panel
						const activeLi = document.querySelector('#toc-list li.toc-active');
						if (activeLi) {
							activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
						}
					}
				});
			},
			{ rootMargin: '-20px 0px -60% 0px', threshold: 0 }
		);

		headings.forEach(function (heading) {
			scrollObserver.observe(heading);
		});
	}

	let debounceTimer = null;

	function scheduleBuildTOC() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(buildTOC, 250);
	}

	/* ── Watch for article changes ─────────────────────────── */
	function watchForArticleChanges() {
		// Click-based: most reliable for detecting article switches
		document.addEventListener('click', function (e) {
			if (e.target.closest('.flux, .flux_header')) {
				scheduleBuildTOC();
			}
		});

		// MutationObserver as backup for programmatic/AJAX changes
		const stream = document.getElementById('stream');
		if (!stream) return;

		mutationObserver = new MutationObserver(scheduleBuildTOC);
		mutationObserver.observe(stream, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
		});
	}

	/* ── Init ──────────────────────────────────────────────── */
	function init() {
		createPanelElements();
		buildTOC();
		watchForArticleChanges();
	}

	// Try FreshRSS custom event first, fallback to DOMContentLoaded
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
