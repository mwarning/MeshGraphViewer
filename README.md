*Work in Progress*

# Graph Viewer

Read a graph file from disk and display a fancy graph. Interactions with the graph (selection, deletion, etc.) can be passed to external programs.

Written in C and JavaScript. Uses d3.js and libmicrohttpd.

Arguments:

* `--bind <address>`: Bind to this address. Default is `127.0.0.1:8000`.
* `-w <file>`: JSON file in NetJson format or a UNIX socket.
* `--ignore-external-commands`:
* `--on-delete-nodes <cmd>`:
* `--on-delete-links <cmd>`:
* `--on-disconnect-nodes <cmd>`:
* `--on-connect-nodes <cmd>`:

## TODO

- Add geographical map (e.g. Open Street Map) with height map.
- Write with GUI toolkit. So not webserver/JS is needed.
