(function () {
	'use strict';

	let scrollObserver = null;
	let mutationObserver = null;

	var NUMBERED_MAX_TEXT_LENGTH = 80;

	var NUMBERED_PATTERNS = [
		{ regex: /^第[一二三四五六七八九十百千]+[章篇部]/, level: 2 },
		{ regex: /^第[一二三四五六七八九十百千]+[节条款]/, level: 3 },
		{ regex: /^[一二三四五六七八九十]{1,3}、/, level: 2 },
		{ regex: /^[（(][一二三四五六七八九十]{1,3}[）)]/, level: 3 },
		{ regex: /^(?=[IVXLC])(X{0,3})(IX|IV|V?I{0,3})\./, level: 2 },
		{ regex: /^\d{1,3}\./, level: 2 },
		{ regex: /^[（(]?\d{1,3}[)）]\s?/, level: 3 },
	];

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

	/* ── Extraction strategies ─────────────────────────────── */

	function extractHeadings(content) {
		var headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
		var result = [];
		headings.forEach(function (heading) {
			result.push({
				element: heading,
				level: parseInt(heading.tagName.charAt(1), 10),
				text: heading.textContent.trim(),
			});
		});
		if (result.length === 0) return result;

		// 归一化：最小 level 映射到 2，保持相对层次，上限 6
		var minLevel = result[0].level;
		for (var i = 1; i < result.length; i++) {
			if (result[i].level < minLevel) minLevel = result[i].level;
		}
		var offset = 2 - minLevel;
		for (var i = 0; i < result.length; i++) {
			result[i].level = Math.min(result[i].level + offset, 6);
		}
		return result;
	}

	function extractNumberedPatterns(content) {
		var candidates = content.querySelectorAll('p, div, span');
		var result = [];
		var seen = new Set();

		candidates.forEach(function (el) {
			var text = el.textContent.trim();
			if (text.length === 0 || text.length > NUMBERED_MAX_TEXT_LENGTH) return;

			// Skip if an ancestor is already in the result set
			var dominated = false;
			var ancestor = el.parentElement;
			while (ancestor && ancestor !== content) {
				if (seen.has(ancestor)) {
					dominated = true;
					break;
				}
				ancestor = ancestor.parentElement;
			}
			if (dominated) return;

			for (var i = 0; i < NUMBERED_PATTERNS.length; i++) {
				if (NUMBERED_PATTERNS[i].regex.test(text)) {
					seen.add(el);
					result.push({
						element: el,
						level: NUMBERED_PATTERNS[i].level,
						text: text,
					});
					break;
				}
			}
		});
		return result;
	}

	function extractBoldParagraphs(content) {
		var candidates = content.querySelectorAll('p, div');
		var result = [];

		candidates.forEach(function (el) {
			// 找到第一个非空白子节点
			var firstChild = null;
			for (var i = 0; i < el.childNodes.length; i++) {
				var node = el.childNodes[i];
				if (node.nodeType === 3 && node.textContent.trim() === '') continue;
				firstChild = node;
				break;
			}
			if (!firstChild || firstChild.nodeType !== 1) return;

			var tag = firstChild.tagName;
			if (tag !== 'STRONG' && tag !== 'B') return;

			var boldText = firstChild.textContent.trim();
			if (boldText.length === 0 || boldText.length > 10) return;

			result.push({
				element: el,
				level: 2,
				text: boldText,
			});
		});
		return result;
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

		// Cascade: headings → numbered patterns → bold text
		var tocItems = extractHeadings(content);
		if (tocItems.length < 2) tocItems = extractNumberedPatterns(content);
		if (tocItems.length < 2) tocItems = extractBoldParagraphs(content);
		if (tocItems.length < 2) {
			panel.style.display = 'none';
			return;
		}

		panel.style.display = '';

		tocItems.forEach(function (item, index) {
			if (!item.element.id) {
				item.element.id = 'toc-heading-' + index;
			}

			var li = document.createElement('li');
			li.setAttribute('data-level', item.level);
			li.setAttribute('data-heading-id', item.element.id);

			var a = document.createElement('a');
			a.href = '#' + item.element.id;
			a.textContent = item.text;
			a.addEventListener('click', function (e) {
				e.preventDefault();
				item.element.scrollIntoView({ behavior: 'smooth' });
			});

			li.appendChild(a);
			list.appendChild(li);
		});

		setupScrollTracking(tocItems.map(function (item) { return item.element; }));
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
