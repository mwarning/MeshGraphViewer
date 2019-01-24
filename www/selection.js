
function createSelection() {
	var self = this;

	var selectedNodes = [];
	var selectedLinks = [];
	var meta_pressed = false;

	window.onmousemove = function (e) {
		if (!e) e = window.event;
		meta_pressed = e.ctrlKey || e.metaKey;
	}

	self.isMetaPressed = function () {
		return meta_pressed;
	}

	self.clearSelection = function () {
		selectedNodes = [];
		selectedLinks = [];
	};

	self.getSelectedNodes = function () {
		return selectedNodes;
	}

	self.getSelectedLinks = function () {
		return selectedLinks;
	}

	self.extendSelection = function (data) {
		var selectedNodesDict = {};
		var selectedLinksDict = {};

		// Map node id to array of link objects
		var connections = {};

		data.nodes.forEach(function(n) {
			connections[n.id] = [];
		});

		data.links.forEach(function(l) {
			connections[l.source].push(l);
			connections[l.target].push(l);
		});

		function selectNode(id) {
			selectedNodesDict[id] = true;
			if (id in connections) {
				connections[id].forEach(function(l) {
					var link_id = l.source + "," + l.target;
					if (!(link_id in selectedLinksDict)) {
						selectedLinksDict[link_id] = true;
					}
					if (!(l.source in selectedNodesDict)) {
						selectNode(l.source);
					}
					if (!(l.target in selectedNodesDict)) {
						selectNode(l.target);
					}
				});
			}
		}

		selectedNodes.forEach(function (id) {
			selectNode(id);
		});

		selectedLinks.forEach(function (id) {
			var link = id.split(",");
			selectNode(link[0]);
			selectNode(link[1]);
		});

		selectedNodes = Object.keys(selectedNodesDict);
		selectedLinks = Object.keys(selectedLinksDict);
	}

	// Remove selected nodes/links that were deleted
	self.filterSelections = function (nodes, links) {

		selectedNodes = selectedNodes.filter(function(e) {
			return (nodes.indexOf(e.id) !== -1);
		});

		selectedLinks = selectedLinks.filter(function(e) {
			return (links.indexOf(e.source + "," + e.target) !== -1);
		});
	}

	self.isSelectedLink = function (id) {
		return (selectedLinks.indexOf(id) !== -1);
	}

	self.isSelectedNode = function (id) {
		return (selectedNodes.indexOf(id) !== -1);
	}

	self.selectNode = function (node) {
		var id = node.id;

		if (self.isMetaPressed()) {
			var i = selectedNodes.indexOf(id);
			if (i < 0) {
				// add to selection
				selectedNodes.push(id);
			} else {
				// remove from selection
				selectedNodes.splice(i, 1);
			}
		} else {
			selectedNodes = [id];
			selectedLinks = [];
		}

		// fill info table
		updateSidebarTable(node);
	};

	self.selectLink = function (link) {
		var id = link.source + ',' + link.target;

		if (self.isMetaPressed()) {
			var i = selectedLinks.indexOf(id);
			if (i < 0) {
				selectedLinks.push(id);
			} else {
				selectedLinks.splice(i, 1);
			}
		} else {
			selectedNodes = [];
			selectedLinks = [id];
		}

		// fill info table
		updateSidebarTable(link);
	};

	return self;
}