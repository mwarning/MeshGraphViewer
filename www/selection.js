
function createSelection() {
    let self = this;

    let selectedNodes = [];
    let selectedLinks = [];
    let meta_pressed = false;

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
        let selectedNodesDict = {};
        let selectedLinksDict = {};

        // Map node id to array of link objects
        let connections = {};

        data.nodes.forEach(function(n) {
            const id = getNodeId(n);
            connections[id] = [];
        });

        data.links.forEach(function(l) {
            connections[l.source].push(l);
            connections[l.target].push(l);
        });

        function selectNode(id) {
            selectedNodesDict[id] = true;
            if (id in connections) {
                connections[id].forEach(function(l) {
                    const link_id = getLinkId(l);
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
            const link = id.split(",");
            selectNode(link[0]);
            selectNode(link[1]);
        });

        selectedNodes = Object.keys(selectedNodesDict);
        selectedLinks = Object.keys(selectedLinksDict);
    }

    // Remove selected nodes/links that were deleted
    self.filterSelections = function (nodes, links) {
        node_set = new Set();
        link_set = new Set();

        for (node in nodes) {
            node_set.add(String(node.id));
        }

        for (link in links) {
            link_set.add(link.source + "," + link.target);
        }

        selectedNodes = selectedNodes.filter(function(e) {
            const node_id = String(e.id);
            return node_set.has(node_id);
        });

        selectedLinks = selectedLinks.filter(function(e) {
            const link_id = e.source + "," + e.target
            return link_set.has(link_id);
        });
    }

    self.isLinkSelected = function (sourceId, targetId) {
        const id = sourceId + "," + targetId;
        return (selectedLinks.indexOf(id) !== -1);
    }

    self.isNodeSelected = function (nodeId) {
        const id = String(nodeId);
        return (selectedNodes.indexOf(id) !== -1);
    }

    self.selectNode = function (nodeId) {
        const id = String(nodeId);

        if (self.isMetaPressed()) {
            const i = selectedNodes.indexOf(id);
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
    };

    self.selectLink = function (sourceId, targetId) {
        const id = sourceId + ',' + targetId;

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
    };

    return self;
}