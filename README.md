# Graph Viewer

Read a simple json graph file from disk and display a fancy interactive graph. Interactions with the graph (selection, deletion, etc.) can be passed to external programs.

Written in an unholy combination of C and JavaScript. Build with [d3js](https://d3js.org/), [leafletjs](https://leafletjs.com/) and [libmicrohttpd](https://www.gnu.org/software/libmicrohttpd/).

![graph and map view](screenshot.png)

(Icons for side menu, fullscreen and location picker and view switch are not yet set.)

## Usage

Usage: `graph-tool <graph-file> [<call-program>]`

Arguments:

* `--graph` *json-file*  
  Graph topology and data in JSON format. File is reloaded when content changes.
* `--call` *program*  
  Call an external program when an action on the graph view is performed.  
    `<program> [connect|disconnect|remove] '<nodes>' '<links>'`  
  `<nodes>` is a comma separate string of node identifiers.  
  `<links>` is a comma separate string of node identifiers pairs.
* `--config` *json-file*  
  Configuration file for map tile source and colors etc.
* `--open`  
  Open browser and show graph.
* `--webserver-address` *address*  
  Address for the build-in webserver. Default: 127.0.0.1
* `--webserver-port` *port*  
  Port for the build-in webserver. Default: 8000
* `--webserver-path` *path*  
  Root folder for the build-in webserver. For development. Default: internal
* `--write-out-files` *path*  
  Write included html/js/css files to disk. For development.
* `--version`  
  Print version.
* `--help`  
  Display help.

## Graph JSON format

Minimal graph data format example:
```
{
  "nodes": [{"id": "a"}, {"id": "b"}],
  "links": [{"source": "a", "target": "b", "target_tq": 1, "source_tq": 1}]
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
      "x": 100,
      "y": 200,
      "label": "Node B",
      "name": "",
      "clients": 5,
      "ring_color": "#fff",
      "border_color": "#fff"
    }
  ],
  "links": [
    {
      "source": "a",
      "target": "b",
      "target_tq": 1,
      "source_tq": 1,
      "label": "Link A/B"
    }
  ]
}
```

Note:

* `id`/`source`/`target`: Node identifier. `source` and `target` are interchangeable.
* `target_tq`/`source_tq`: link quality in the range of `[0..1]`. Madatory.
* `label`: Display a label on top of a node or link.
* `name`: Display a name under a node.
* `x`/`y`: Geographical position, also used for initial position in topological view.
* `client_count`: Display a number of small circles around each node.
* `body_color`: Color of a node. CSS color format.
* `ring_color`: Color of a ring around a node. CSS color format.

## Build Dependencies

- xxd tool to include html/js/css data into binary (often in package `vim-common`)
- libmicrohttpd development headers

## Run Dependencies

- libmicrohttpd library

## Authors

The base of the JavaScript/CSS code was taken from the [MeshViewer](https://github.com/ffrgb/meshviewer) project.

## TODO

- Use web sockets or JS code, so not polling is needed.
- Use a GUI toolkit. So no webserver/JS is needed.

## License

All JavaScript/CSS code is AGPL-3 because it is the original license, everything else is MIT.
