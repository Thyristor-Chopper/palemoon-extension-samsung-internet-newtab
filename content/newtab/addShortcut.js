const Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/NewTabUtils.jsm');
Cu.import('resource://gre/modules/PlacesUtils.jsm');
const { links } = NewTabUtils;

function GetStringPref(name, def = '') {
	try {
		return Services.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
	} catch(e) {
		return def;
	}
}

const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

function createListItem(title, url) {
	const treeitem = document.createElementNS(XUL_NS, 'treeitem');
	const treerow = document.createElementNS(XUL_NS, 'treerow');
	const titleCell = document.createElementNS(XUL_NS, 'treecell');
	titleCell.setAttribute('label', title);
	const urlCell = document.createElementNS(XUL_NS, 'treecell');
	urlCell.setAttribute('label', url);
	treerow.appendChild(titleCell);
	treerow.appendChild(urlCell);
	treeitem.appendChild(treerow);
	return treeitem;
}

function fillFrequentlyVisited() {
	const treeChildren = document.getElementById('frequentlyVisitedItems');
	for(var item of links.getLinks())
		treeChildren.appendChild(createListItem(item.title || item.url, item.url));
}

function fillRecentlyVisited() {
	const treeChildren = document.getElementById('recentlyVisitedItems');
	var maxResults = 10;  // Services.prefs.getIntPref('browser.history.menuMaxResults', 15);
	if(maxResults < 0) maxResults = 0;
	else if(maxResults > 50) maxResults = 50;
	const query = PlacesUtils.history.getNewQuery();
	const options = PlacesUtils.history.getNewQueryOptions();
	options.maxResults = maxResults;
	options.sortingMode = options.SORT_BY_DATE_DESCENDING;
	const history = PlacesUtils.history.executeQuery(query, options);
	const root = history.root;
	root.containerOpen = true;
	for(var i=0; i<root.childCount; i++) {
		const entry = root.getChild(i);
		treeChildren.appendChild(createListItem(entry.title, entry.uri));
	}
	root.containerOpen = false;
}

function fillPageInfo(tree) {
	const index = tree.currentIndex;
	if(index < 0) return;
	document.getElementById('titleInput').value = tree.view.getCellText(index, tree.columns[0]);
	document.getElementById('urlInput').value = tree.view.getCellText(index, tree.columns[1]);
}

function init() {
	fillFrequentlyVisited();
	fillRecentlyVisited();
}

function save() {
	if(!window.opener) return false;
	const quickLaunchItems = window.opener.getQuickLaunchItems();
	const url = document.getElementById('urlInput').value;
	if(!url) {
		Services.prompt.alert(window, null, '.');
		return false;
	}
	quickLaunchItems.push({ title: (document.getElementById('titleInput').value || url), url });
	window.opener.saveQuickLaunchItems(quickLaunchItems);
	window.opener.fillQuickLaunch();
}

window.addEventListener('load', init, false);
