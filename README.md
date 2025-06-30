# Mesh Graph Viewer

View mesh networks described in a JSON file. This tool is meant to visualize mesh network simulations for research. Interactions with the graph (selection, deletion, etc.) and custom commands can be passed to external programs. The view is updated as soon as the JSON file is changed.

Features:

* Forcegraph and OpenStreet Map view
* Edit JSON file and view results live
* Graph data inspection via web interface
* Pass through connection to external programs

![Grid on Graph](screenshots/screenshot-grid-graph.png)
![Grid on Map](screenshots/screenshot-grid-map.png)
![Freifunk data on Graph](screenshots/screenshot-ff-graph.png)
![Freifunk on Map](screenshots/screenshot-ff-map.png)
![Freifunk zoomed out Graph](screenshots/screenshot-ff-overview-graph.png)

## Usage

Usage: `graph-viewer [<arguments>] <graph-file>`

Arguments:

* `--graph` *graph-file*  
  Graph topology and data in JSON format. May be first unnamed argument.  
  The graph file is reloaded when its timestamp changes.
* `--call` *path|address*  
  Commands triggered via the web interface are used as programm arguments,  
  or send to a unix socket file or given IP address via TCP/UDP.  
  E.g. `/usr/bin/send_program`, `unix:///var/com.sock`, `tcp://localhost:3000`.
* `--config` *json-file*  
  Configuration file for custom command buttons, colors and map tile sources.
* `--open`  
  Open browser and show graph.
* `--webserver-address` *address*  
  Address for the build-in webserver. Default: 127.0.0.1:8000
* `--webserver-path` *path*  
  Root folder for the build-in webserver. For development. Default: internal
* `--write-out-files` *path*  
  Write included html/js/css files to disk. For development.
* `--version`  
  Print version.
* `--help`  
  Display help.

## Graph JSON format

The supported JSON formats are [NetJSON](https://netjson.org/) and a very similar format used by the [Meshviewer](https://github.com/ffrgb/meshviewer) project that is used by most [Freifunk](https://freifunk.net/) communities.

Minimal graph example:
```
{
  "links": [{"source": "a", "target": "b"}]
}
```

More elaborate example:
```
{
  "nodes": [
    {
      "id": "a"
    },
    {
      "id": "b",
      "x": 52.5162,
      "y": 13.3777,
      "label": "Label",
      "name": "Name",
      "radius": 12,
      "color": "#DAA520",
      "clients": 5
    }
  ],
  "links": [
    {
      "source": "a",
      "target": "b",
      "target_tq": 1,
      "source_tq": 1,
      "color": "#7CFC00",
      "label": "Link A/B"
    }
  ]
}
```

Note:

* `id`/`source`/`target`: Node identifier. These are mandatory options.
  * An alternative for `id` is `node_id`.
* `target_tq`/`source_tq`: link quality in the range of `[0..1]`.
* `label`: Display a label on top of a node or link.
* `name`: Display a name under a node.
  * Uses `hostname` or `id` as an alternative source.
* `x`/`y`: Geographical position, also used for initial position in topological view.
  * Uses `"location": { "longitude": 52.5162, "latitude": 13.3777}` as an alternative source.
* `clients`: Display a number of small circles around each node.
* `color`: Color of a node or link. CSS color format. By default the link color is based on `target_tq` and `source_tq`.
* `radius`: Radius of the node circle.

## Build

MeshGraphViewer is written in an unholy combination of C and JavaScript. Build with [d3js](https://d3js.org/), [leafletjs](https://leafletjs.com/) and [libmicrohttpd](https://www.gnu.org/software/libmicrohttpd/).

Requirements:

- C compiler (e.g. clang or gcc)
- xxd tool to include html/js/css data into binary (package `xxd` or as part of `vim-common`)
- libmicrohttpd and the development headers

Build:

```
make
```

This should create a single standalone program called `graph-viewer`.

## Custom Buttons

Add new buttons using the configuration file [config.json](config.json) and pass it to grap-viewer via the `--config` argument. Other available options like colors etc. can be gathered from the internal index.html default config object.

In the command line, the variables `%selected_nodes%` and `%selected_links%` will be expanded to a comma separated list.

## Connection to MeshnetLab

MeshGraphViewer can be used to interact with [MeshnetLab](https://github.com/mwarning/meshnet-lab/), a mesh network simulation and test framework. This allows to run a virtual mesh network that can be viewed, edited and controlled via MeshGraphViewer. The connection between both is handled with [meshnet-lab-bridge.py](meshnet-lab-bridge.py).

Example with an initial empty graph.

Installation
```
apt install libmicrohttpd-dev xxd
mkdir project
cd project
git clone https://github.com/mwarning/meshnet-lab/
git clone https://github.com/mwarning/MeshGraphViewer/
cd MeshGraphviewer
make
```

Run
```
cd project/MeshGraphviewer
echo '{"nodes": [], "links": []}' > graph.json
sudo ./meshnet-lab-bridge.py ../meshnet-lab /tmp/sim_connector.sock ./graph.json
# switch to a new termial, same working directory
./graph-viewer --call unix:///tmp/sim_connector.sock --config config.json ./graph.json
```

Access MeshgraphViewer via the browser (https://localhost:8000). Use the buttons there to add nodes (running [batman-adv](https://en.wikipedia.org/wiki/B.A.T.M.A.N.)) and links.

Shut down the simulation afterwards in the meshnet-lab folder:
```
./software.py clear
./network.py clear
```

## Related Software

* [WebView D3](https://github.com/byt3bl33d3r/webview_d3)
* [HopGlass](https://github.com/hopglass/hopglass)
* [NetJSON NetworkGraph](https://github.com/openwisp/netjsongraph.js)
* [graph-tool](https://graph-tool.skewed.de/)
* [NetworkX](https://networkx.github.io/)
* [Gephi](https://gephi.org/)
* [vis.js](http://visjs.org/)
* [igraph](https://igraph.org/redirect.html)

## Authors

The code of the MeshGraphViewer is based on the [MeshViewer](https://github.com/ffrgb/meshviewer) project.

## License

AGPL-3.0-or-later
