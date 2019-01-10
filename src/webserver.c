#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <ctype.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

#include <microhttpd.h>

#include "utils.h"
#include "main.h"
#include "files.h" // will be created by Makefile
#include "webserver.h"


static struct MHD_Daemon *g_webserver;
static const char *g_webserver_path;


// Lookup files content included by files.h
static uint8_t *get_included_file(size_t *content_size, const char url[]) {
  struct content *e = g_content;
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
static int is_valid_path(const char path[]) {
  char prev;
  int c;
  int i;

  prev = '\0';
  for (i = 0; path[i]; i++) {
    c = path[i];
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
  {NULL, NULL}
};

const char *get_mimetype(const char str[]) {
  struct mimetype *mimetype;

  mimetype = &g_mimetypes[0];
  while (mimetype->suffix) {
    if (is_suffix(str, mimetype->suffix)) {
      return mimetype->mimetype;
    }
    mimetype++;
  }

  return "application/octet-stream";
}

struct arguments {
  char *nodes;
  char *links;
};

/*
int count_commas(const char *str) {
  int c;
  int i;

  c = 0;
  i = 0;
  while (str[i]) {
    c += (str[i] == ',');
    i += 1;
  }

  if (i) {
   return c + 1;
  } else {
    return 0;
  }
}

static void parse_numbers(struct arguments *args, const char *values) {
   //parse numbers
   int n = count_commas(values);
   printf("n: %d\n", n);
   args->nodes = (uint16_t*) malloc(sizeof(uint16_t) * n);
   args->nodes_count = n;

   int i = 0;
   const char *next = values;
    while (1) {
      args->nodes[i] = atoi(next);
      next = strchr(next, ',');
      if (next) {
        next += 1;
        i += 1;
      } else {
        break;
      }
    }
}
*/
static char *sanitize_nodes(const char *value) {
  char *data = strdup(value);

  int i = 0;
  while (data[i]) {
    if (data[i] == ',') {
      data[i] = ' ';
    } else if (data[i] < '0' || data[i] > '9') {
      // invalid content
      free(data);
      return NULL;
    }
    i += 1;
  }

  return data;
}

static int get_values(void *cls, enum MHD_ValueKind kind, const char *key, const char *value) {
  struct arguments *args = (struct arguments *)cls;

  printf("key: %s, value: %s\n", key, value);

  if (strcmp(key, "nodes") == 0) {
    args->nodes = sanitize_nodes(value);
  }

  if (strcmp(key, "links") == 0) {
    args->links = sanitize_nodes(value);
  }

  return MHD_YES;
}

static int send_json(struct MHD_Connection *connection, const char* data, unsigned len) {
  struct MHD_Response *response;
  int ret;

  response = MHD_create_response_from_buffer(len, (char*) data, MHD_RESPMEM_PERSISTENT);
  MHD_add_response_header(response, "Content-Type", "application/json");
  ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
  MHD_destroy_response(response);

  return ret;
}

static int send_empty_json(struct MHD_Connection *connection) {
  return send_json(connection, "{}", 2);
}

static int send_response(void *cls, struct MHD_Connection *connection,
      const char *url, const char *method, const char *version,
      const char *upload_data, size_t *upload_data_size, void **con_cls) {
  const union MHD_ConnectionInfo *connection_info;
  enum MHD_ResponseMemoryMode mode;
  struct MHD_Response *response;
  char content_path[256];
  uint8_t *content_data;
  size_t content_size;
  int ret;

  connection_info = MHD_get_connection_info(connection, MHD_CONNECTION_INFO_CLIENT_ADDRESS);
  if (!connection_info) {
    goto error;
  }

  debug("Connection from IP address: %s\n", str_addr(connection_info->client_addr));

  content_data = NULL;
  content_size = 0;

  if (0 == strcmp(url, "/cmd/call")) {
    if (!g_call) {
      fprintf(stderr, "no command handler set\n");
      return send_empty_json(connection);
    }

    struct arguments args = {0};
    MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, get_values, &args);

    printf("execute %s\n", g_call);
    char buf[512];
    ret = execute_ret(buf, sizeof(buf), "./%s %s %s", g_call, args.nodes, args.links);
    free(args.nodes);
    free(args.links);

    printf("%s\n", buf);

    if (ret == 0) {
      if (buf[0]) {
        return send_json(connection, buf, strlen(buf));
      } else {
        return send_empty_json(connection);
      }
    } else {
      fprintf(stderr, "error from %s\n", g_call);
      return send_empty_json(connection);
    }
  } else if (0 == strcmp(url, "/cmd/graph")) {
    // Fetch JSON data
    if (g_graph == NULL) {
      goto not_found;
    } else {
      content_data = read_file(&content_size, g_graph);
      mode = MHD_RESPMEM_MUST_FREE;

      response = MHD_create_response_from_buffer(content_size, content_data, mode);
      MHD_add_response_header(response, "Content-Type", "application/json");
      ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
    }
/*

    is_localhost = is_localhost_addr(
      connection_info->client_addr
    );

    device = find_device_by_ip(
      connection_info->client_addr
    );

    fp = open_memstream((char**) &content_data, &content_size);

    if (is_localhost) {
      // get all device info for localhost access
      write_devices_json(fp);
    } else {
     // get only own device info
      write_device_json(fp, device);
    }
    fclose(fp);

    response = MHD_create_response_from_buffer(content_size, content_data, MHD_RESPMEM_MUST_FREE);
    MHD_add_response_header(response, "Content-Type", "application/json");
    ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
    */
  } else {
    if (0 == strcmp(url, "/")) {
      url = "/index.html";
    }

    if (!is_valid_path(url)) {
      goto not_found;
    }

    // Try to fetch external file first
    if (g_webserver_path) {
      snprintf(content_path, sizeof(content_path), "%s/%s", g_webserver_path, url);

      content_data = read_file(&content_size, content_path);
      mode = MHD_RESPMEM_MUST_FREE;
    }

    // Try to fetch internal files second
    if (NULL == content_data) {
      content_data = get_included_file(&content_size, url);
      mode = MHD_RESPMEM_PERSISTENT;
      // Error if no file was found
      if (NULL == content_data) {
        goto not_found;
      }
    }

    response = MHD_create_response_from_buffer(content_size, content_data, mode);
    MHD_add_response_header(response, "Content-Type", get_mimetype(url));
    ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
  }

  MHD_destroy_response(response);

  return ret;

error:
  response = MHD_create_response_from_buffer(0, NULL, MHD_RESPMEM_PERSISTENT);
  //MHD_add_response_header(response, "Content-Type", "text/html; charset=utf-8");
  ret = MHD_queue_response(connection, MHD_HTTP_INTERNAL_SERVER_ERROR, response);
  MHD_destroy_response(response);
  return ret;
not_found:
  response = MHD_create_response_from_buffer(0, NULL, MHD_RESPMEM_PERSISTENT);
  //MHD_add_response_header(response, "Content-Type", "text/html; charset=utf-8");
  ret = MHD_queue_response(connection, MHD_HTTP_NOT_FOUND, response);
  MHD_destroy_response(response);
  return ret;
/*
not_modified:
  response = MHD_create_response_from_buffer(0, NULL, MHD_RESPMEM_PERSISTENT);
  //MHD_add_response_header(response, "Content-Type", "text/html; charset=utf-8");
  ret = MHD_queue_response(connection, MHD_HTTP_NOT_MODIFIED, response);
  MHD_destroy_response(response);
  return ret;
*/
}

int webserver_start(const char path[], int port)
{
  char pathbuf[256];
  char *p;

  if (path) {
    p = realpath(path, pathbuf);
    if (NULL == p) {
      return EXIT_FAILURE;
    }

    g_webserver_path = strdup(p);
  } else {
    g_webserver_path = NULL;
  }

  g_webserver = MHD_start_daemon(0, port, NULL, NULL, &send_response, NULL, MHD_OPTION_END);

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
