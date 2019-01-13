#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <arpa/inet.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <linux/if.h>
#include <inttypes.h>
#include <sys/select.h>
#include <signal.h>
#include <getopt.h>
#include <sys/time.h>

#include "webserver.h"
#include "files.h" // will be created by Makefile
#include "utils.h"
#include "main.h"


static const char *g_help_text =
  "Display a graph via a web server. Pass back events to interact with the graph.\n"
  "\n"
  "  Usage: graph-tool <graph-file> [<call-program>]\n"
  "\n"
  " --graph <json-file>      Graph topology in JSON format. May be first unnamed argument.\n"
  " --call <program>         Call an external program when an action on the graph\n"
  "                          view is performed. May be second unnamed argument\n"
  "                            <program> [<command>] [..]\n"
  "                          Command list:\n"
  "                            get-link-prop|set-link-prop\n"
  "                            get-node-prop|set-node-prop\n"
  "                            add-link|del-link\n"
  " --webserver-address <address> Address for the build-in webserver. Default: 127.0.0.1\n"
  " --webserver-port <port>  Port for the build-in webserver. Set to 0 to disable webserver. Default: 8000\n"
  " --webserver-path <path>  Root folder for the build-in webserver. Default: internal\n"
  " --write-out-files <path> Write included html/js/css files to disk.\n"
  " --open                   Show graph in browser.\n"
  " --version                Print version.\n"
  " --help                   Display this help.\n";

// Run state
static int g_is_running;

static const char *g_version = "0.0.1";

// Current time
time_t g_now = 0;

const char* g_graph = NULL;
const char* g_call = NULL;


static void unix_signal_handler(int signo) {
  // exit on second stop request
  if (g_is_running == 0) {
    exit(1);
  }

  g_is_running = 0;

  printf("Shutting down...\n");
}

static void setup_signal_handlers() {
  struct sigaction sig_stop;
  struct sigaction sig_term;

  // STRG+C aka SIGINT => Stop the program
  sig_stop.sa_handler = unix_signal_handler;
  sig_stop.sa_flags = 0;
  if ((sigemptyset(&sig_stop.sa_mask) == -1) || (sigaction(SIGINT, &sig_stop, NULL) != 0)) {
    fprintf(stderr, "Failed to set SIGINT handler: %s", strerror(errno));
    exit(1);
  }

  // SIGTERM => Stop the program gracefully
  sig_term.sa_handler = unix_signal_handler;
  sig_term.sa_flags = 0;
  if ((sigemptyset(&sig_term.sa_mask) == -1) || (sigaction(SIGTERM, &sig_term, NULL) != 0)) {
    fprintf(stderr, "Failed to set SIGTERM handler: %s", strerror(errno));
    exit(1);
  }
}

enum {
  oGraph,
  oCall,
  oWriteOutFiles,
  oWebserverAddress,
  oWebserverPort,
  oWebserverPath,
  oOpen,
  oVersion,
  oHelp
};

static struct option options[] = {
  {"graph", required_argument, 0, oGraph},
  {"call", required_argument, 0, oCall},
  {"write-out-files", required_argument, 0, oWriteOutFiles},
  {"webserver-address", required_argument, 0, oWebserverAddress},
  {"webserver-port", required_argument, 0, oWebserverPort},
  {"webserver-path", required_argument, 0, oWebserverPath},
  {"open", no_argument, 0, oOpen},
  {"version", no_argument, 0, oVersion},
  {"help", no_argument, 0, oHelp},
  {0, 0, 0, 0}
};

int write_out_files(const char *target) {
  struct content *c;
  int rc;

  if (target && chdir(target) == -1) {
    printf("Failed to change directory to %s: %s\n", target, strerror(errno));
    return EXIT_FAILURE;
  }

  c = g_content;
  while (c->path) {
    printf("create %s\n", c->path + 1);

    // create dirname part
    rc = create_path(c->path + 1);
    if (rc == EXIT_FAILURE) {
      return EXIT_FAILURE;
    }

    // create basename file
    rc = create_file(c->path + 1, c->data, c->size);
    if (rc == EXIT_FAILURE) {
      return EXIT_FAILURE;
    }

    c += 1;
  }

  printf("done\n");

  return EXIT_SUCCESS;
}

int main(int argc, char **argv) {
  const char *webserver_address = "127.0.0.1";
  int webserver_port = 8000;
  const char *webserver_path = NULL;
  struct sockaddr_storage addr;
  struct timeval tv;
  int open_browser = 0;
  fd_set rset;
  fd_set wset;
  fd_set xset;
  int maxfd;
  int index;
  int rc;
  int i;

  i = 1;
  while (i) {
    index = 0;
    int c = getopt_long(argc, argv, "", options, &index);

    switch (c) {
    case oGraph:
      g_graph = strdup(optarg);
      break;
    case oCall:
      g_call = strdup(optarg);
      break;
    case oWriteOutFiles:
      return write_out_files(optarg);
    case oWebserverAddress:
      webserver_address = strdup(optarg);
      break;
    case oWebserverPort:
      webserver_port = atoi(optarg);
      break;
    case oWebserverPath:
      webserver_path = strdup(optarg);
      break;
    case oOpen:
      open_browser = 1;
      break;
    case oVersion:
      printf("%s\n", g_version);
      return EXIT_SUCCESS;
    case oHelp:
      printf("%s\n", g_help_text);
      return EXIT_SUCCESS;
    case -1:
      i = 0;
      break;
    default:
      return EXIT_FAILURE;
    }
  }

  // handle remaining arguments
  for (i = optind; i < argc; i++) {
    if (!g_graph) {
      g_graph = strdup(argv[i]);
    } else if (!g_call) {
      g_call = strdup(argv[i]);
    } else {
      fprintf(stderr, "Unknown option: %s\n", argv[i]);
      return EXIT_FAILURE;
    }
  }

  if (g_graph == NULL) {
    fprintf(stderr, "Missing input file\n");
    return EXIT_FAILURE;
  }

  if (g_call && !is_program(g_call)) {
    fprintf(stderr, "Program is not executable: %s\n", g_call);
    return EXIT_FAILURE;
  }

  if (g_graph && !is_file(g_graph)) {
    fprintf(stderr, "Graph file does not exist: %s\n", g_graph);
    return EXIT_FAILURE;
  }

  if (inet_pton(AF_INET, webserver_address, &addr) == 1) {
    addr.ss_family = AF_INET;
  } else if (inet_pton(AF_INET6, webserver_address, &addr) == 1) {
    addr.ss_family = AF_INET6;
  } else {
    fprintf(stderr, "Invalid address %s\n", webserver_address);
    return EXIT_FAILURE;
  }

  if (set_port(&addr, webserver_port) == EXIT_FAILURE) {
    fprintf(stderr, "Invalid webserver port\n");
    return EXIT_FAILURE;
  }

  if (webserver_path && !is_directory(webserver_path)) {
    fprintf(stderr, "Invalid webserver path: %s\n", webserver_path);
    return EXIT_FAILURE;
  }

  setup_signal_handlers();

  rc = webserver_start(webserver_path, (const struct sockaddr *) &addr);
  if (rc == EXIT_FAILURE) {
    return EXIT_FAILURE;
  }

  if (addr.ss_family == AF_INET6) {
    printf("Listen on http://[%s]:%d\n", webserver_address, webserver_port);
  } else {
    printf("Listen on http://%s:%d\n", webserver_address, webserver_port);
  }
  
  if (open_browser) {
    if (addr.ss_family == AF_INET6) {
      execute("xdg-open http://[%s]:%d", webserver_address, webserver_port);
    } else {
      execute("xdg-open http://%s:%d", webserver_address, webserver_port);
    }
  }

  g_is_running = 1;
  while (g_is_running) {
    g_now = time(NULL);

    // Make select block for at most 1 second
    tv.tv_sec = 1;
    tv.tv_usec = 0;

    FD_ZERO(&rset);
    FD_ZERO(&wset);
    FD_ZERO(&xset);

    maxfd = 0;

    webserver_before_select(&rset, &wset, &xset, &maxfd);

    if (select(maxfd + 1, &rset, &wset, &xset, &tv) < 0) {
      if (errno == EINTR) {
        continue;
      }

      //fprintf(stderr, "select() %s\n", strerror(errno));
      return EXIT_FAILURE;
    }

    webserver_after_select();
  }

  return EXIT_SUCCESS;
}
