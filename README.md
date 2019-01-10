*Work in Progress*

# Graph Viewer

Read a graph file from disk and display a fancy graph. Interactions with the graph (selection, deletion, etc.) can be passed to external programs.

Written in C and JavaScript. Build on top of d3.js and libmicrohttpd.

Arguments:

* `--graph <json-file>`: Graph topology in JSON format.
* `--data <json-file>`: Extra node meta data in JSON format.
* `--call <program>`: Call an external program when an action on the graph view is performed.  
    `<program> [<command>] [..]`  
  Command list:  
    `get-link-prop`|`set-link-prop`  
    `get-node-prop`|`set-node-prop`  
    `add-link`|`del-link`
* `--webserver-port <port>`: Port for the build-in webserver. Set to 0 to disable webserver. Default: 8000
* `--webserver-path <path>`: Root folder for the build-in webserver. Default: internal
* `--write-out-files <path>`: Write included html/js/css files to disk.
* `--version`: Print version.
* `--help`: Display help.

## Build Dependencies

- xxd tool to include html/js/css data into binary
- libmicrohttpd development headers

## Run Dependencies

- libmicrohttpd library

## TODO

- Add geographical map (e.g. Open Street Map) with height map.
- Write with GUI toolkit. So not webserver/JS is needed.
