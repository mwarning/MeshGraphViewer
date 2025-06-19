function createSidebar() {
    const self = {
        sidebarItem: undefined,
        sidebar: document.getElementsByClassName('sidebar')[0],
        button: document.getElementsByClassName('sidebarhandle')[0],
        container: document.getElementsByClassName('container')[0],
    };

    // Needed to avoid render blocking
    const gridBreakpoints = {
        lg: [992, 446],
        xl: [1200, 560]
    };

    self.onClick = function onClick() {
        let sidebar = document.getElementsByClassName('sidebar')[0];
        var visibility = new CustomEvent('visibility');
        self.button.dispatchEvent(visibility);
        sidebar.classList.toggle('sidebar_hidden');
        self.container.classList.toggle('hidden');
    }

    self.getWidth = function getWidth() {
        let sidebar = document.getElementsByClassName('sidebar')[0];
        if (gridBreakpoints.lg[0] > window.innerWidth || sidebar.classList.contains('sidebar_hidden')) {
            return 0;
        } else if (gridBreakpoints.xl[0] > window.innerWidth) {
            return gridBreakpoints.lg[1];
        }
        return gridBreakpoints.xl[1];
    };

    self.setSidebarItem = function (item) {
        self.sidebarItem = item;
        updateSidebarTable(item);
    };

    function updateSidebarTable(item) {
        function append(parent, name, content) {
            var e = document.createElement(name);
            if ((typeof content === 'string') || (typeof content === 'number')) {
                var text = document.createTextNode(content.toString());
                e.appendChild(text);
            }
            parent.appendChild(e);
            return e;
        }

        function toTable(parent, element) {
            var type = (typeof element);
            if (type === 'string') {
                append(parent, 'span', '"' + element.toString() + '"');
            } else if (type === 'boolean' || type === 'number') {
                append(parent, 'span', element.toString());
            } else if (element === null) {
                append(parent, 'span', 'null');
            } else if (type === 'object') {
                var table = append(parent, 'table');
                for (let [key, value] of Object.entries(element)) {
                    // <tr><td><span>key</span></td><td><span>value</span></td></tr>
                    let tr = append(table, 'tr');
                    let td1 = append(tr, 'td');
                    append(td1, 'span', key.toString());
                    let td2 = append(tr, 'td');
                    toTable(td2, value);
                }
            } else {
                append(parent, 'span', '???');
            }
        }

        var div = $('#object_tab div');

        // clear table
        while (div.firstChild) {
            div.removeChild(div.firstChild);
        }

        if (item) {
            toTable(div, item);
        }
    }

    self.setData = function (nodes, links) {
        if (self.sidebarItem !== undefined) {
            const item = self.sidebarItem;
            const itemString = JSON.stringify(item);

            if ('id' in item) {
                for (node of nodes) {
                    if (node["id"] == item["id"]) {
                        self.sidebarItem = node;
                        if (itemString != JSON.stringify(node)) {
                            updateSidebarTable(node);
                        }
                        return;
                    }
                }
            }

            if ("source" in item && "target" in item) {
                for (link of links) {
                    if (link["source"] == item["source"]
                            && link["target"] == item["target"]) {
                        self.sidebarItem = link;
                        if (itemString != JSON.stringify(link)) {
                            updateSidebarTable(link);
                        }
                        return;
                    }
                }
            }

            self.sidebarItem = undefined;
            updateSidebarTable(undefined);
        }
    }

    return self;
}
