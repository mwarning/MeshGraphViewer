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
#include "call.h"
#include "main.h"


static const char *g_help_text =
  "Display a graph via a web server. Pass back events to interact with the graph.\n"
  "\n"
  "  Usage: graph-tool <graph-file> [<call-program>]\n"
  "\n"
  " --graph <json-file>      Graph topology in JSON format. May be first unnamed argument.\n"
  " --call <path|address>    Commands triggered via the web interface are send to an external program,\n"
  "                          unix socket file or given IP address via TCP/UDP.\n"
  "                          E.g. '/usr/bin/send_program', 'unix:///var/com.sock', 'tcp://localhost:3000'.\n"
  " --config <path>          Use a JavaScript file with configuration settings.\n"
  " --webserver-address <address> Address for the build-in webserver. Default: 127.0.0.1:8000\n"
  " --webserver-path <path>  Root folder for the build-in webserver. Default: internal\n"
  " --write-out-files <path> Write included html/js/css files to disk.\n"
  " --open                   Show graph in browser.\n"
  " --version                Print version.\n"
  " --help                   Display this help.\n";

// Run state
static bool g_is_running = true;

static const char *g_version = "1.4.3";

const char* g_graph = NULL;
const char* g_call = NULL;
const char* g_config = NULL;

static void unix_signal_handler(int signo)
{
  // exit on second stop request
  if (!g_is_running) {
    exit(1);
  }

  g_is_running = false;

  printf("Shutting down...\n");
}

static void setup_signal_handlers()
{
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
  oConfig,
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
  {"config", required_argument, 0, oConfig},
  {"write-out-files", required_argument, 0, oWriteOutFiles},
  {"webserver-address", required_argument, 0, oWebserverAddress},
  {"webserver-path", required_argument, 0, oWebserverPath},
  {"open", no_argument, 0, oOpen},
  {"version", no_argument, 0, oVersion},
  {"help", no_argument, 0, oHelp},
  {0, 0, 0, 0}
};

bool write_out_files(const char *target)
{
  if (target && chdir(target) == -1) {
    printf("Failed to change directory to %s: %s\n", target, strerror(errno));
    return false;
  }

  struct content *c = (struct content *)g_content;
  while (c->path) {
    printf("create %s\n", c->path + 1);

    // create dirname part
    if (!create_path(c->path + 1)) {
      return false;
    }

    // create basename file
    if (!create_file(c->path + 1, c->data, c->size)) {
      return false;
    }

    c += 1;
  }

  printf("done\n");

  return true;
}

int main(int argc, char **argv)
{
  const char *webserver_address = "127.0.0.1";
  int webserver_port = 8000;
  const char *webserver_path = NULL;
  struct sockaddr_storage addr;
  struct timeval tv;
  bool open_browser = false;
  fd_set rset;
  fd_set wset;
  fd_set xset;

  bool iter = true;
  while (iter) {
    int index = 0;
    int c = getopt_long(argc, argv, "h", options, &index);

    switch (c) {
    case oGraph:
      g_graph = strdup(optarg);
      break;
    case oCall:
      g_call = strdup(optarg);
      break;
    case oConfig:
      g_config = strdup(optarg);
      break;
    case oWriteOutFiles:
      return write_out_files(optarg) ? EXIT_SUCCESS : EXIT_FAILURE;
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
      open_browser = true;
      break;
    case oVersion:
      printf("%s\n", g_version);
      return EXIT_SUCCESS;
    case oHelp:
    case 'h':
      printf("%s\n", g_help_text);
      return EXIT_SUCCESS;
    case -1:
      iter = false;
      break;
    default:
      return EXIT_FAILURE;
    }
  }

  // handle remaining arguments
  for (size_t i = optind; i < argc; ++i) {
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

  if (g_graph && !is_file(g_graph)) {
    fprintf(stderr, "File does not exist: %s\n", g_graph);
    return EXIT_FAILURE;
  }

  if (addr_parse_full(&addr, webserver_address, "8000", AF_UNSPEC) != 0) {
    fprintf(stderr, "Invalid webserver address.\n");
    return EXIT_FAILURE;
  }

  if (webserver_path && !is_directory(webserver_path)) {
    fprintf(stderr, "Invalid webserver path: %s\n", webserver_path);
    return EXIT_FAILURE;
  }

  setup_signal_handlers();

  int rc = webserver_start(webserver_path, (const struct sockaddr *) &addr);
  if (rc == EXIT_FAILURE) {
    return EXIT_FAILURE;
  }

  printf("Listen on http://%s\n", str_addr(&addr));

  if (open_browser) {
    if (addr.ss_family == AF_INET6) {
      execute("xdg-open http://[%s]:%d", webserver_address, webserver_port);
    } else {
      execute("xdg-open http://%s:%d", webserver_address, webserver_port);
    }
  }

  while (g_is_running) {
    // Make select block for at most 1 second
    tv.tv_sec = 1;
    tv.tv_usec = 0;

    FD_ZERO(&rset);
    FD_ZERO(&wset);
    FD_ZERO(&xset);

    int maxfd = 0;

    webserver_before_select(&rset, &wset, &xset, &maxfd);

    if (g_com_sock >= 0) {
      FD_SET(g_com_sock, &rset);
      if (g_com_sock > maxfd) {
        maxfd = g_com_sock;
      }
    }

    if (select(maxfd + 1, &rset, &wset, &xset, &tv) < 0) {
      if (errno == EINTR) {
        continue;
      }

      fprintf(stderr, "select() %s\n", strerror(errno));
      return EXIT_FAILURE;
    }

    if (g_com_sock >= 0) {
      if (FD_ISSET(g_com_sock, &rset)) {
        call_receive();
      }
    }

    webserver_after_select();
  }

  return EXIT_SUCCESS;
}
