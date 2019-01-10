# Graph Viewer

Read a graph file from disk and display a fancy graph. Interactions with the graph (selection, deletion, etc.) can be passed to external programs.

Written in C and JavaScript. Build on top of d3.js and libmicrohttpd.

Arguments:

* `--graph` *json-file*  
  Graph topology and data in JSON format.
* `--call` *program*  
  Call an external program when an action on the graph view is performed.  
    `<program> [<command>] [..]`  
  Command list:  
    `get-link-prop`|`set-link-prop`  
    `get-node-prop`|`set-node-prop`  
    `add-link`|`del-link`
* `--open`  
  Show graph in browser.
* `--webserver-port` *port*  
  Port for the build-in webserver. Default: 8000
* `--webserver-path` *path*  
  Root folder for the build-in webserver. Default: internal
* `--write-out-files` *path*  
  Write included html/js/css files to disk.
* `--version`  
  Print version.
* `--help`  
  Display help.

## Graph JSON format

Minimal graph data format example:
```
{
  "nodes": [{"mac": "a"}, {"mac": "b"}],
  "links": [{"source": "a", "target": "b", "target_tq": 1, "source_tq": 1}]
}
```

More elaborate example:
```
{
  "nodes": [
    {
      "mac": "a"
    },
    {
      "mac": "b",
      "x": 100,
      "y": 200,
      "node_label": "Node B",
      "node_name": "",
      "client_count": 5,
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
      "link_label": "Link A/B"
    }
  ]
}
```

Note:

* `mac`/`source`/`target`: Node identifier. `source` and `target` are interchangeable.
* `target_tq`/`source_tq`: link quality in the range of `[0..1]`. Madatory.
* `node_label`/`link_label`: Display a label on top of a node or link.
* `node_name`: Display a name under a node.
* `x`/`y`: Geographical position, also used for initial position in topological view.
* `client_count`: Display a number of small circles around each node.
* `ring_color`: Color of a ring around a node. CSS color format.
* `node_color`: Color of a node. CSS color format.

## Build Dependencies

- xxd tool to include html/js/css data into binary (often in package `vim-common`)
- libmicrohttpd development headers

## Run Dependencies

- libmicrohttpd library

## TODO

- Add geographical map (e.g. Open Street Map) with height map.
- Write with GUI toolkit. So no webserver/JS is needed.
