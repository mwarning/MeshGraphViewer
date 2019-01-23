
function createSelection() {
	var self = this;

	var selectedNodes = [];
	var selectedLinks = [];

	var highlightedNodes = [];
	var highlightedLinks = [];

	self.clearSelection = function () {
		selectedNodes = [];
		selectedLinks = [];
	};

	self.clearHighlight = function () {
		highlightedNodes = [];
		highlightedLinks = [];
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

	// Remove selected/highlighted nodes/links that were deleted
	self.filterSelections = function (nodes, links) {
/*
		var highlightedNodes_count = highlightedNodes.length;
		var highlightedLinks_count = highlightedLinks.length;
		var selectedNodes_count = selectedNodes.length;
		var selectedLinks_count = selectedLinks.length;

	 	//check if removing stuff really removed selected items
		console.log("beg removed selected items: "
			+ (highlightedNodes_count) + " "
			+ (highlightedLinks_count) + " "
			+ (selectedNodes_count) + " "
			+ (selectedLinks_count)
		);
*/
		highlightedNodes = highlightedNodes.filter(function(e) {
			return (nodes.indexOf(e.id) !== -1);
		});

		highlightedLinks = highlightedLinks.filter(function(e) {
			return (links.indexOf(e.source + "," + e.target) !== -1);
		});

		selectedNodes = selectedNodes.filter(function(e) {
			return (nodes.indexOf(e.id) !== -1);
		});

		selectedLinks = selectedLinks.filter(function(e) {
			return (links.indexOf(e.source + "," + e.target) !== -1);
		});
/*
		console.log("end removed selected items: "
			+ (highlightedNodes_count - highlightedNodes.length) + " "
			+ (highlightedLinks_count - highlightedLinks.length) + " "
			+ (selectedNodes_count - selectedNodes.length) + " "
			+ (selectedLinks_count - selectedLinks.length)
		);
*/
	}

	self.isSelectedLink = function (id) {
		return (selectedLinks.indexOf(id) !== -1);
	}

	self.isSelectedNode = function (id) {
		return (selectedNodes.indexOf(id) !== -1);
	}

	self.isHighlightedLink = function (id) {
		return (highlightedNodes.indexOf(id) !== -1);
	}

	self.isHighlightedNode = function (id) {
		return (highlightedLinks.indexOf(id) !== -1);
	}

	self.selectNode = function (node) {
		var id = node.id;

		if (d3.event && (d3.event.ctrlKey || d3.event.metaKey)) {
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

		if (d3.event && (d3.event.ctrlKey || d3.event.metaKey)) {
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