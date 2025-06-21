
function createSelection() {
    const self = {
        selectedNodes: new Set(),
        selectedLinks: new Set(),
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
        self.selectedNodes.clear();
        self.selectedLinks.clear();

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
        let connections = {};

        data.nodes.forEach(function(n) {
            const id = getNodeId(n);
            connections[id] = [];
        });

        data.links.forEach(function(l) {
            connections[l.source].push(l);
            connections[l.target].push(l);
        });

        function addNode(id) {
            self.selectedNodes.add(id);
            if (id in connections) {
                connections[id].forEach(function(link) {
                    self.selectedLinks.add(getLinkId(link));
                    if (!self.selectedNodes.has(link.source)) {
                        addNode(link.source);
                    }
                    if (!self.selectedNodes.has(link.target)) {
                        addNode(link.target);
                    }
                });
            }
        }

        self.selectedNodes.forEach(function (id) {
            addNode(id);
        });

        self.selectedLinks.forEach(function (id) {
            const link = id.split(",");
            addNode(link[0]);
            addNode(link[1]);
        });

        updateStats();
    }

    // Remove selected nodes/links that were deleted
    self.setData = function (nodes, links) {
        let node_set = new Set(nodes.map(n => getNodeId(n)));
        let link_set = new Set(links.map(l => getLinkId(l)));

        self.selectedNodes = self.selectedNodes.intersection(node_set);
        self.selectedLinks = self.selectedLinks.intersection(link_set);

        updateStats();
    }

    self.isLinkSelected = function (sourceId, targetId) {
        const id = sourceId + "," + targetId;
        return self.selectedLinks.has(id);
    }

    self.isNodeSelected = function (nodeId) {
        const id = String(nodeId);
        return self.selectedNodes.has(id);
    }

    self.selectNode = function (node) {
        const id = getNodeId(node);

        if (self.isMetaPressed()) {
            if (self.selectedNodes.has(id)) {
                self.selectedNodes.delete(id);
            } else {
                self.selectedNodes.add(id);
            }
        } else {
            self.selectedNodes.clear();
            self.selectedLinks.clear();
            self.selectedNodes.add(id)
        }

        sidebar.setSidebarItem(node);
        updateStats();
    };

    self.selectLink = function (link) {
        const id = getLinkId(link);

        if (self.isMetaPressed()) {
            if (self.selectedLinks.has(id)) {
                self.selectedLinks.delete(id);
            } else {
                self.selectedLinks.add(id);
            }
        } else {
            self.selectedNodes.clear();
            self.selectedLinks.clear();
            self.selectedLinks.add(id);
        }

        sidebar.setSidebarItem(link);
        updateStats();
    };

    return self;
}
