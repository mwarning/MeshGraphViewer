#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <ctype.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <linux/limits.h>

#include <microhttpd.h>

#include "utils.h"
#include "json.h"
#include "call.h"
#include "main.h"
#include "files.h" // will be created by Makefile
#include "webserver.h"


static struct MHD_Daemon *g_webserver;
static const char *g_webserver_path;
static time_t g_graph_mtime = 0;


// Lookup files content included by files.h
static const uint8_t *get_included_file(size_t *content_size, const char url[])
{
  const struct content *e = g_content;
  while (e->path) {
    if (0 == strcmp(e->path, url)) {
      *content_size = e->size;
      return e->data;
    }
    e++;
  }

  return NULL;
}

/*
 * Check if the path consist of "[a-zA-Z0-9.\_-]*".
 * But does not contain "..".
 */
static int is_valid_path(const char path[])
{
  char prev = '\0';
  for (size_t i = 0; path[i]; i++) {
    int c = path[i];
    if (!isalnum(c)
        && c != '/' && c != '.'
        && c != '-' && c != '_') {
      return 0;
    }
    if (prev == '.' && c == '.') {
      return 0;
    }
    prev = c;
  }

  return 1;
}

struct mimetype {
  const char *suffix;
  const char *mimetype;
};

struct mimetype g_mimetypes[] = {
  {".html", "text/html; charset=utf-8"},
  {".json", "application/json"},
  {".js", "text/javascript"},
  {".css", "text/css"},
  {".png", "image/png"},
  {".jpg", "image/jpeg"},
  {".jpeg", "image/jpeg"},
  {".txt", "text/plain"},
  {NULL, NULL}
};

const char *get_mimetype(const char str[])
{
  struct mimetype *mimetype = &g_mimetypes[0];
  while (mimetype->suffix) {
    if (is_suffix(str, mimetype->suffix)) {
      return mimetype->mimetype;
    }
    mimetype++;
  }

  return "application/octet-stream";
}

static int send_reply(struct MHD_Connection *connection, int status_code, const char* content_type,
                      enum MHD_ResponseMemoryMode mode, const char* data, unsigned len)
{
  struct MHD_Response *response = MHD_create_response_from_buffer(len, (char*) data, mode);
  if (content_type) {
    MHD_add_response_header(response, "Content-Type", content_type);
  }
  int ret = MHD_queue_response(connection, status_code, response);
  MHD_destroy_response(response);

  return ret;
}

static int send_empty_json(struct MHD_Connection *connection)
{
  return send_reply(connection, MHD_HTTP_OK, "application/json", MHD_RESPMEM_PERSISTENT, "{}", 2);
}

static int send_text(struct MHD_Connection *connection, const char *text)
{
  size_t length = text ? strlen(text) : 0;
  return send_reply(connection, MHD_HTTP_OK, "application/plain", MHD_RESPMEM_PERSISTENT, text, length);
}

static int send_empty_text(struct MHD_Connection *connection)
{
  return send_text(connection, NULL);
}

static int send_error(struct MHD_Connection *connection)
{
  return send_reply(connection, MHD_HTTP_INTERNAL_SERVER_ERROR, NULL, MHD_RESPMEM_PERSISTENT, NULL, 0);
}

static int send_not_found(struct MHD_Connection *connection)
{
  return send_reply(connection, MHD_HTTP_NOT_FOUND, NULL, MHD_RESPMEM_PERSISTENT, NULL, 0);
}

static int get_query(void *cls, enum MHD_ValueKind kind, const char *key, const char *value)
{
  char **args = (char**)cls;

  if (*args == NULL && strcmp(key, "query") == 0) {
    *args = strdup(value);
  }

  return MHD_YES;
}

static int handle_call_receive(struct MHD_Connection *connection)
{
  // send new buffer content and clear
  int ret = send_reply(connection, MHD_HTTP_OK, "text/plain", MHD_RESPMEM_MUST_COPY, g_com_buf, strlen(g_com_buf));
  memset(g_com_buf, 0, sizeof(g_com_buf));

  return ret;
}

static int handle_call_execute(struct MHD_Connection *connection)
{
  if (!g_call) {
    fprintf(stderr, "No command handler set\n");
    return send_empty_text(connection);
  }

  char *query = NULL;
  MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, (MHD_KeyValueIterator)get_query, &query);
  if (query == NULL) {
    fprintf(stderr, "No query argument set\n");
    return send_empty_text(connection);
  }

  call_send(query);
  free(query);

  return send_empty_text(connection);
}

struct graph_set_args {
  char *node_ids;
  char *link_ids;
  char *key;
  char *value;
};

static int get_graph_set_args(void *cls, enum MHD_ValueKind kind, const char *key, const char *value)
{
  struct graph_set_args *args = (struct graph_set_args*)cls;

  if (!args->node_ids && strcmp(key, "node_ids") == 0) {
    args->node_ids = strdup(value);
  }

  if (!args->link_ids && strcmp(key, "link_ids") == 0) {
    args->link_ids = strdup(value);
  }

  if (!args->key && strcmp(key, "key") == 0) {
    args->key = strdup(value);
  }

  if (!args->value && strcmp(key, "value") == 0) {
    args->value = strdup(value);
  }

  return MHD_YES;
}

static int handle_graph_set(struct MHD_Connection *connection)
{
  struct graph_set_args args = {0};

  MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, (MHD_KeyValueIterator)get_graph_set_args, &args);
  if (!args.node_ids || !args.link_ids || !args.key || !args.value) {
    fprintf(stderr, "Missing query arguments for /cmd/graph_modify\n");
    return send_empty_text(connection);
  }

  //printf("node_ids: %s, link_ids: %s, key: %s, value: %s\n",
  //  args.node_ids, args.link_ids, args.key, args.value);

  if (g_graph) {
    json_set(g_graph, args.node_ids, args.link_ids, args.key, args.value);
  }

  free(args.node_ids);
  free(args.link_ids);
  free(args.key);
  free(args.value);

  return send_empty_text(connection);
}

/*
struct graph_connect_args {
  char *node_ids;
};

static int get_graph_connect_args(void *cls, enum MHD_ValueKind kind, const char *key, const char *value)
{
  struct graph_connect_args *args = (struct graph_connect_args*)cls;

  if (!args->node_ids && strcmp(key, "node_ids") == 0) {
    args->node_ids = strdup(value);
  }

  return MHD_YES;
}

static int handle_graph_connect(struct MHD_Connection *connection)
{
  struct graph_connect_args args = {0};

  MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, (MHD_KeyValueIterator)get_graph_connect_args, &args);
  if (!args.node_ids) {
    fprintf(stderr, "Missing query arguments for /cmd/graph_modify\n");
    return send_empty_text(connection);
  }

  //printf("node_ids: %s, link_ids: %s, key: %s, value: %s\n",
  //  args.node_ids, args.link_ids, args.key, args.value);

  if (g_graph) {
    json_connect(g_graph, args.node_ids);
  }

  free(args.node_ids);

  return send_empty_text(connection);
}

struct graph_disconnect_args {
  char *node_ids;
};

static int get_graph_disconnect_args(void *cls, enum MHD_ValueKind kind, const char *key, const char *value)
{
  struct graph_disconnect_args *args = (struct graph_disconnect_args*)cls;

  if (!args->node_ids && strcmp(key, "node_ids") == 0) {
    args->node_ids = strdup(value);
  }

  return MHD_YES;
}

static int handle_graph_disconnect(struct MHD_Connection *connection)
{
  struct graph_connect_args args = {0};

  MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, (MHD_KeyValueIterator)get_graph_disconnect_args, &args);
  if (!args.node_ids) {
    fprintf(stderr, "Missing query arguments for /cmd/graph_modify\n");
    return send_empty_text(connection);
  }

  //printf("node_ids: %s, link_ids: %s, key: %s, value: %s\n",
  //  args.node_ids, args.link_ids, args.key, args.value);

  if (g_graph) {
    json_disconnect(g_graph, args.node_ids);
  }

  free(args.node_ids);

  return send_empty_text(connection);
}
*/


static int handle_graph(struct MHD_Connection *connection, bool force_full_file)
{
  if (g_graph == NULL) {
    return send_empty_json(connection);
  }

  // get timestamp
  struct stat attr;
  if (stat(g_graph, &attr) == -1) {
    // graph file not found
    fprintf(stderr, "stat(): %s %s\n", strerror(errno), g_graph);
    return send_empty_text(connection);
  }

  if (!force_full_file) {
    if (attr.st_mtime == g_graph_mtime) {
      // no change
      return send_empty_json(connection);
    }
  }

  // update global timestamp
  g_graph_mtime = attr.st_mtime;

  if (g_graph == NULL) {
    // no graph file set
    return send_empty_text(connection);
  }

  size_t size = -1;
  uint8_t *data = read_file(&size, g_graph);

  if (data == NULL || size < 0) {
    // failed to read file (or file is empty)
    return send_empty_text(connection);
  }

  struct MHD_Response *response = MHD_create_response_from_buffer(size, data, MHD_RESPMEM_MUST_FREE);
  MHD_add_response_header(response, "Content-Type", "application/json");
  int ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
  MHD_destroy_response(response);

  return ret;
}

static int handle_content(struct MHD_Connection *connection, const char *url)
{
  enum MHD_ResponseMemoryMode mode;
  const uint8_t *content_data = NULL;
  size_t content_size = -1;

  if (!is_valid_path(url)) {
    return send_error(connection);
  }

  if (0 == strcmp(url, "/")) {
    url = "/index.html";
  }

  // Serve entire graph when site was reloaded
  if (0 == strcmp(url, "/index.html")) {
    g_graph_mtime = 0;
  }

  if (0 == strcmp(url, "/config.json")) {
    if (g_config) {
      content_data = read_file(&content_size, g_config);
      mode = MHD_RESPMEM_MUST_FREE;
    } else {
      return send_empty_json(connection);
    }
  } else {
    // Try to fetch external file first
    if (g_webserver_path) {
      char content_path[256];
      snprintf(content_path, sizeof(content_path), "%s/%s", g_webserver_path, url);

      content_data = read_file(&content_size, content_path);
      mode = MHD_RESPMEM_MUST_FREE;
    } else {
      // Try to fetch internal files second
      content_data = get_included_file(&content_size, url);
      mode = MHD_RESPMEM_PERSISTENT;
    }
  }

  // Error if no file was found
  if (NULL == content_data || content_size < 0) {
    return send_not_found(connection);
  }

  struct MHD_Response *response = MHD_create_response_from_buffer(content_size, (void*)content_data, mode);
  MHD_add_response_header(response, "Content-Type", get_mimetype(url));
  int ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
  MHD_destroy_response(response);

  return ret;
}

static int send_response(void *cls, struct MHD_Connection *connection,
      const char *url, const char *method, const char *version,
      const char *upload_data, size_t *upload_data_size, void **con_cls)
{
  if (0 == strcmp(url, "/cmd/call_execute")) {
    return handle_call_execute(connection);
  } else if (0 == strcmp(url, "/cmd/call_receive")) {
    return handle_call_receive(connection);
  } else if (0 == strcmp(url, "/cmd/graph_full")) {
    return handle_graph(connection, true);
  } else if (0 == strcmp(url, "/cmd/graph_update")) {
    return handle_graph(connection, false);
  } else if (0 == strcmp(url, "/cmd/graph_modify")) {
    return handle_graph_set(connection);
  } else {
    return handle_content(connection, url);
  }
}

int webserver_start(const char path[], const struct sockaddr *addr)
{
  if (path) {
    char pathbuf[PATH_MAX];
    char *p = realpath(path, pathbuf);
    if (NULL == p) {
      return EXIT_FAILURE;
    }

    g_webserver_path = strdup(p);
  } else {
    g_webserver_path = NULL;
  }

  int flags = (addr->sa_family == AF_INET6) ? MHD_USE_IPv6 : 0;
  g_webserver = MHD_start_daemon(flags, 0, NULL, NULL, (MHD_AccessHandlerCallback)&send_response, NULL,
    MHD_OPTION_SOCK_ADDR, addr,
    MHD_OPTION_END
  );

  if (g_webserver) {
    return EXIT_SUCCESS;
  } else {
    fprintf(stderr, "Failed to create webserver: %s\n", strerror(errno));
    return EXIT_FAILURE;
  }
}

void webserver_before_select(fd_set *rs, fd_set *ws, fd_set *es, int *max_fd)
{
  if (MHD_YES != MHD_get_fdset(g_webserver, rs, ws, es, max_fd)) {
    fprintf(stderr, "MHD_get_fdset(): %s", strerror(errno));
    exit(1);
  }
}

void webserver_after_select()
{
  MHD_run(g_webserver);
}
