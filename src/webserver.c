#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <ctype.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <microhttpd.h>

#include "utils.h"
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

static int send_empty_text(struct MHD_Connection *connection)
{
  return send_reply(connection, MHD_HTTP_OK, "text/plain", MHD_RESPMEM_PERSISTENT, NULL, 0);
}

static int send_empty_json(struct MHD_Connection *connection)
{
  return send_reply(connection, MHD_HTTP_OK, "application/json", MHD_RESPMEM_PERSISTENT, "{}", 2);
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

  if (query != NULL) {
    call_send(g_call, query);
  }

  free(query);

  return send_empty_text(connection);
}

static int handle_graph(struct MHD_Connection *connection)
{
  if (g_graph == NULL) {
    return send_empty_json(connection);
  }

  // get timestamp
  struct stat attr;
  if (stat(g_graph, &attr) == -1) {
    fprintf(stderr, "stat(): %s %s\n", strerror(errno), g_graph);
    return send_empty_json(connection);
  }

  if (attr.st_mtime == g_graph_mtime) {
    // no change
    return send_empty_json(connection);
  }

  // update global timestamp
  g_graph_mtime = attr.st_mtime;

  // Fetch JSON data
  if (g_graph == NULL) {
    return send_not_found(connection);
  }

  size_t size = 0;
  uint8_t *data = read_file(&size, g_graph);

  if (data == NULL || size == 0) {
    // no change
    return send_empty_json(connection);
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
  size_t content_size = 0;

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
  if (NULL == content_data) {
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
  } else if (0 == strcmp(url, "/cmd/graph")) {
    return handle_graph(connection);
  } else {
    return handle_content(connection, url);
  }
}

int webserver_start(const char path[], const struct sockaddr *addr)
{
  if (path) {
    char pathbuf[256];
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
