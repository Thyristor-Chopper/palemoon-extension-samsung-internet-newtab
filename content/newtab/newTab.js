const Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/NewTabUtils.jsm');
Cu.import('resource://gre/modules/NetUtil.jsm');
Cu.import('resource://gre/modules/PlacesUtils.jsm');
const { links, pinnedLinks, blockedLinks, gridPrefs } = NewTabUtils;

function GetStringPref(name, def = '') {
	try {
		return Services.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
	} catch(e) {
		return def;
	}
}

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const XUL_NAMESPACE = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

const quickLaunchGrid = document.getElementById('quickLaunchGrid');
const frequentlyVisitedList = document.getElementById('frequentlyVisitedList');

function setFavicon(img, link) {
	img.src = 'chrome://mozapps/skin/places/defaultFavicon.png';
	PlacesUtils.favicons.getFaviconURLForPage(NetUtil.newURI(link.url), function(aURI) {
		if(!aURI) return;
		let iconURL = PlacesUtils.favicons.getFaviconLinkForIcon(aURI).spec;
		img.src = iconURL;
	});
}

function addShortcut(event) {
	event.preventDefault();
	window.openDialog('chrome://sinewtab/content/newtab/addShortcut.xul', '_blank', 'width=520,height=390,chrome,close,modal');
}

function saveQuickLaunchItems(quickLaunchItems) {
	Services.prefs.setCharPref('extensions.sinewtab.quick_launch_items', btoa(unescape(encodeURIComponent(JSON.stringify(quickLaunchItems)))));
}

function createGridItem(link, index) {
	const alink = document.createElementNS(HTML_NAMESPACE, 'a');
	alink.className = 'quick-launch-link';
	const faviconContainer = document.createElementNS(HTML_NAMESPACE, 'span');
	faviconContainer.className = 'quick-launch-icon-container';
	const label = document.createElementNS(HTML_NAMESPACE, 'span');
	label.className = 'quick-launch-label';
	if(link) {
		const favicon = document.createElementNS(HTML_NAMESPACE, 'img');
		favicon.className = 'quick-launch-icon';
		alink.href = link.url;
		setFavicon(favicon, link);
		faviconContainer.appendChild(favicon);
		label.textContent = link.title;
		const deleteButton = document.createElementNS(HTML_NAMESPACE, 'button');
		deleteButton.className = 'quick-launch-delete';
		attachGridItemEvent(deleteButton, 'click', function(event) {
			const quickLaunchItems = getQuickLaunchItems();
			quickLaunchItems.splice(index, 1);
			saveQuickLaunchItems(quickLaunchItems);
			alink.remove();
		});
		const editButton = document.createElementNS(HTML_NAMESPACE, 'button');
		editButton.className = 'quick-launch-edit';
		attachGridItemEvent(editButton, 'click', function(event) {
			const quickLaunchItems = getQuickLaunchItems();
			var newTitle = '';
			while(newTitle == '')
				newTitle = prompt('.', link.title);
			if(!newTitle) return;
			quickLaunchItems[index].title = newTitle;
			saveQuickLaunchItems(quickLaunchItems);
			label.textContent = newTitle;
		});
		alink.appendChild(deleteButton);
		alink.appendChild(editButton);
		attachGridItemEvent(alink, 'click', linkClickHandler);
	} else {
		faviconContainer.textContent = '+';
		label.innerHTML = '&#160;';
		alink.setAttribute('data-addlink', 'true');
		attachGridItemEvent(alink, 'click', addShortcut);
	}
	alink.appendChild(faviconContainer);
	alink.appendChild(label);
	return alink;
}

function getQuickLaunchItems() {
	var quickLaunchItems;
	try {
		quickLaunchItems = JSON.parse(decodeURIComponent(escape(atob(GetStringPref('extensions.sinewtab.quick_launch_items')))));
	} catch(e) {
		quickLaunchItems = [];
		for(var item of pinnedLinks.links) {
			if(!item) continue;
			quickLaunchItems.push({ title: (item.title || item.baseDomain), url: item.url });
		}
	}
	return quickLaunchItems;
}

function fillQuickLaunch() {
	const quickLaunchItems = getQuickLaunchItems();
	quickLaunchGrid.replaceChildren();
	for(var item of quickLaunchEvents)
		item[0].removeEventListener(item[1], item[2], false);
	quickLaunchEvents.length = 0;
	var i = 0;
	for(var item of quickLaunchItems) {
		if(!item) continue;
		quickLaunchGrid.appendChild(createGridItem(item, i));
		i++;
	}
	quickLaunchGrid.appendChild(createGridItem(null));
}

function linkClickHandler(event) {
	if(event.target.localName == 'button')
		event.preventDefault();
}

function createListItem(link, index, hidden) {
	const li = document.createElementNS(HTML_NAMESPACE, 'li');
	li.className = 'frequently-visited-item';
	if(hidden) li.setAttribute('data-hidden', 'true');
	const alink = document.createElementNS(HTML_NAMESPACE, 'a');
	alink.className = 'frequently-visited-link';
	const faviconContainer = document.createElementNS(HTML_NAMESPACE, 'span');
	faviconContainer.className = 'frequently-visited-icon-container';
	const favicon = document.createElementNS(HTML_NAMESPACE, 'img');
	favicon.className = 'frequently-visited-icon';
	faviconContainer.appendChild(favicon);
	const label = document.createElementNS(HTML_NAMESPACE, 'span');
	label.className = 'frequently-visited-label';
	alink.appendChild(faviconContainer);
	alink.appendChild(label);
	if(link) {
		alink.href = link.url;
		setFavicon(favicon, link)
		label.textContent = link.title || link.baseDomain;
		const blockButton = document.createElementNS(HTML_NAMESPACE, 'button');
		blockButton.className = 'frequently-visited-block';
		attachListItemEvent(blockButton, 'click', function(event) {
			if(blockedLinks.isBlocked(link)) return;
			blockedLinks.block(link);
			li.remove();
		});
		const pinButton = document.createElementNS(HTML_NAMESPACE, 'button');
		pinButton.className = 'frequently-visited-pin';
		attachListItemEvent(pinButton, 'click', function(event) {
			if(pinnedLinks.isPinned(link)) {
				pinnedLinks.unpin(link);
				li.removeAttribute('data-pinned');
				pinButton.removeAttribute('open');
			} else {
				pinnedLinks.pin(link, index);
				li.setAttribute('data-pinned', 'true');
				pinButton.setAttribute('open', 'true');
			}
		});
		if(pinnedLinks.isPinned(link)) {
			li.setAttribute('data-pinned', 'true');
			pinButton.setAttribute('open', 'true');
		}
		alink.appendChild(blockButton);
		alink.appendChild(pinButton);
		attachListItemEvent(alink, 'click', linkClickHandler);
	} else {
		li.setAttribute('data-expander', 'true');
		attachListItemEvent(alink, 'click', function(event) {
			event.preventDefault();
			if(li.getAttribute('data-expanded') == 'true') {
				for(var item of document.querySelectorAll('div#frequentlyVisitedCard ul#frequentlyVisitedList > li.frequently-visited-item[data-hidden="false"]'))
					item.setAttribute('data-hidden', 'true');
				li.removeAttribute('data-expanded');
				label.textContent = '▾';
			} else {
				for(var item of document.querySelectorAll('div#frequentlyVisitedCard ul#frequentlyVisitedList > li.frequently-visited-item[data-hidden="true"]'))
					item.setAttribute('data-hidden', 'false');
				li.setAttribute('data-expanded', 'true');
				label.textContent = '▴';
			}
		});
		label.textContent = '▾';
	}
	li.appendChild(alink);
	return li;
}

function attachGridItemEvent(element, event, handler) {
	element.addEventListener(event, handler, false);
	quickLaunchEvents.push([element, event, handler]);
}

function attachListItemEvent(element, event, handler) {
	element.addEventListener(event, handler, false);
	frequentlyVisitedEvents.push([element, event, handler]);
}

function fillFrequentlyVisited() {
	const maxCount = gridPrefs.gridColumns * gridPrefs.gridRows;
	frequentlyVisitedList.replaceChildren();
	for(var item of frequentlyVisitedEvents)
		item[0].removeEventListener(item[1], item[2], false);
	frequentlyVisitedEvents.length = 0;
	var i = 0;
	for(var item of links.getLinks()) {
		if(!item) continue;
		frequentlyVisitedList.appendChild(createListItem(item, i, i >= maxCount));
		i++;
	}
	if(i > maxCount)
		frequentlyVisitedList.appendChild(createListItem(null));
}

var quickLaunchEvents = [];
var frequentlyVisitedEvents = [];

fillQuickLaunch();
links.populateCache(() => fillFrequentlyVisited());
