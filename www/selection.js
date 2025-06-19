
function createSelection() {
    const self = {
        selectedNodes: [],
        selectedLinks: [],
        meta_pressed: false,
    };

    window.onmousemove = function (e) {
        if (!e) e = window.event;
        meta_pressed = e.ctrlKey || e.metaKey;
    }

    self.isMetaPressed = function () {
        return meta_pressed;
    }

    self.clearSelection = function () {
        self.selectedNodes = [];
        self.selectedLinks = [];

        sidebar.setSidebarItem(undefined);
        updateStats();
    }

    self.getSelectedNodes = function () {
        return self.selectedNodes;
    }

    self.getSelectedLinks = function () {
        return self.selectedLinks;
    }

    self.extendSelection = function (data) {
        let selectedNodesSet = new Set();
        let selectedLinksSet = new Set();

        // Map node id to array of link objects
        let connections = {};

        data.nodes.forEach(function(n) {
            const id = getNodeId(n);
            connections[id] = [];
        });

        data.links.forEach(function(link) {
            connections[link.source].push(link);
            connections[link.target].push(link);
        });

        function selectNode(id) {
            selectedNodesSet.add(id);
            if (id in connections) {
                connections[id].forEach(function(link) {
                    const link_id = getLinkId(link);
                    if (!selectedLinksSet.has(link_id)) {
                        selectedLinksSet.add(link_id);
                    }
                    if (!selectedNodesSet.has(link.source)) {
                        selectNode(link.source);
                    }
                    if (!selectedNodesSet.has(link.target)) {
                        selectNode(link.target);
                    }
                });
            }
        }

        self.selectedNodes.forEach(function (id) {
            selectNode(id);
        });

        self.selectedLinks.forEach(function (id) {
            const link = id.split(",");
            selectNode(link[0]);
            selectNode(link[1]);
        });

        self.selectedNodes = Array.from(selectedNodesSet);
        self.selectedLinks = Array.from(selectedLinksSet);

        updateStats();
    }

    // Remove selected nodes/links that were deleted
    self.setData = function (nodes, links) {
        let node_set = new Set();
        let link_set = new Set();

        for (node in nodes) {
            node_set.add(getNodeId(node));
        }

        for (link in links) {
            link_set.add(getLinkId(link));
        }

        self.selectedNodes = self.selectedNodes.filter(function(e) {
            const node_id = getNodeId(e);
            return node_set.has(node_id);
        });

        self.selectedLinks = self.selectedLinks.filter(function(e) {
            const link_id = getLinkId(e);
            return link_set.has(link_id);
        });

        updateStats();
    }

    self.isLinkSelected = function (sourceId, targetId) {
        const id = sourceId + "," + targetId;
        return (self.selectedLinks.indexOf(id) !== -1);
    }

    self.isNodeSelected = function (nodeId) {
        const id = String(nodeId);
        return (self.selectedNodes.indexOf(id) !== -1);
    }

    self.selectNode = function (node) {
        const id = getNodeId(node);

        if (self.isMetaPressed()) {
            const i = self.selectedNodes.indexOf(id);
            if (i < 0) {
                // add to selection
                self.selectedNodes.push(id);
            } else {
                // remove from selection
                self.selectedNodes.splice(i, 1);
            }
        } else {
            self.selectedNodes = [id];
            self.selectedLinks = [];
        }

        sidebar.setSidebarItem(node);
        updateStats();
    };

    self.selectLink = function (link) {
        const id = getLinkId(link);

        if (self.isMetaPressed()) {
            var i = self.selectedLinks.indexOf(id);
            if (i < 0) {
                self.selectedLinks.push(id);
            } else {
                self.selectedLinks.splice(i, 1);
            }
        } else {
            self.selectedNodes = [];
            self.selectedLinks = [id];
        }

        sidebar.setSidebarItem(link);
        updateStats();
    };

    return self;
}
