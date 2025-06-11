#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>

#include "main.h"
#include "utils.h"

#define DEFAULT_PORT "3000"


int g_com_sock = -1;
struct sockaddr_storage g_addr = {0};
char g_com_buf[10 * 1024] = { 0 };


// Set a socket non-blocking
static int net_set_nonblocking(int fd)
{
  return fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
}

/*
static void append_message(const char *msg) {
  // append error message to message buffer
  size_t buflen = strlen(g_com_buf);
  strncpy(g_com_buf + buflen, msg, sizeof(g_com_buf) - buflen);
}
*/

void call_receive()
{
  if (g_com_sock >= 0 && g_call) {
    size_t len = strlen(g_com_buf);
    // read data from socket
    if (read(g_com_sock, g_com_buf + len, sizeof(g_com_buf) - len) <= 0) {
      close(g_com_sock);
      g_com_sock = -1;
    }
  }
}

static void tcp_uninit()
{
  memset(&g_addr, 0, sizeof(g_addr));
  close(g_com_sock);
  g_com_sock = -1;
}

static bool tcp_init(const char* addr_str)
{
  const int opt_on = 1;

  tcp_uninit();

  if (addr_parse_full(&g_addr, addr_str, DEFAULT_PORT, AF_UNSPEC) != 0) {
    fprintf(stderr, "Failed to parse IP address '%s'\n", addr_str);
    return false;
  }

  if ((g_com_sock = socket(PF_INET, SOCK_STREAM, 0)) < 0) {
    return false;
  }

  if (setsockopt(g_com_sock, SOL_SOCKET, SO_REUSEADDR, &opt_on, sizeof(opt_on)) < 0) {
    return false;
  }

  if (connect(g_com_sock, (struct sockaddr*) &g_addr, sizeof(g_addr)) < 0) {
    return false;
  }

  net_set_nonblocking(g_com_sock);

  return true;
}

static void tcp_send(const char* addr_str, const char *msg)
{
  if (g_com_sock < 0) {
    if (!tcp_init(addr_str)) {
      goto error;
    }
  }

  if (send(g_com_sock, msg, strlen(msg), 0) < 0) {
    goto error;
  }

  return;

error:
  tcp_uninit();

  fprintf(stderr, "tcp: %s\n", strerror(errno));

  // append error message to message buffer
  //append_message(strerror(errno));
  //append_message("\n");

  return;
}

static void udp_uninit()
{
  memset(&g_addr, 0, sizeof(g_addr));
  close(g_com_sock);
  g_com_sock = -1;
}

static bool udp_init(const char* addr_str)
{
  const int opt_on = 1;

  udp_uninit();

  if (addr_parse_full(&g_addr, addr_str, DEFAULT_PORT, AF_UNSPEC) != 0) {
    fprintf(stderr, "Failed to parse IP address: %s\n", addr_str);
    return false;
  }

  if ((g_com_sock = socket(PF_INET, SOCK_DGRAM, IPPROTO_UDP)) < 0) {
    return false;
  }

  net_set_nonblocking(g_com_sock);

  if (setsockopt(g_com_sock, SOL_SOCKET, SO_REUSEADDR, &opt_on, sizeof(opt_on)) < 0) {
    return false;
  }

  return true;
}

static void udp_send(const char* addr_str, const char *msg)
{
  if (g_com_sock < 0) {
    if (!udp_init(addr_str)) {
      goto error;
    }
  }

  socklen_t addrlen = sizeof(struct sockaddr_in);
  if (sendto(g_com_sock, msg, strlen(msg), 0, (struct sockaddr*) &g_addr, addrlen) < 0) {
    goto error;
  }

  return;

error:
  udp_uninit();

  fprintf(stderr, "udp: %s\n", strerror(errno));

  // append error message to message buffer
  //append_message(strerror(errno));
  //append_message("\n");

  return;
}

static void unix_uninit() {
  memset(&g_addr, 0, sizeof(g_addr));
  close(g_com_sock);
  g_com_sock = -1;
}

static bool unix_init(const char* path)
{
  unix_uninit();

  struct sockaddr_un *addr = (struct sockaddr_un *) &g_addr;

  if ((g_com_sock = socket(AF_LOCAL, SOCK_STREAM, 0)) < 0) {
    return false;
  }
  net_set_nonblocking(g_com_sock);

  addr->sun_family = AF_LOCAL;
  strcpy(addr->sun_path, path);

  if (connect(g_com_sock, (struct sockaddr *) addr, sizeof(*addr)) < 0) {
    fprintf(stderr, "Failed to connect to '%s': %s\n", path, strerror(errno));
    return false;
  }

  return true;
}

static void unix_send(const char* addr_str, const char *msg)
{
  if (g_com_sock < 0) {
    if (!unix_init(addr_str)) {
      goto error;
    }
  }

  if (send(g_com_sock, msg, strlen(msg), 0) < 0) {
    goto error;
  }

  return;

error:
  unix_uninit();

  fprintf(stderr, "unix: %s\n", strerror(errno));

  // append error message to message buffer
  //append_message(strerror(errno));
  //append_message("\n");

  return;
}

static bool prog_init(const char* path)
{
  struct stat attr;
  if (stat(path, &attr) == 0 && attr.st_mode & S_IXUSR) {
    // file exists and is executable
    return true;
  } else {
    fprintf(stderr, "Not executable: %s\n", path);
    return false;
  }
}

bool call_validate(const char *call) {
  bool ok = false;

  if (is_prefix("udp://", call)) {
    ok = udp_init(g_call + 6);
  } else if (is_prefix("tcp://", call)) {
    ok = tcp_init(g_call + 6);
  } else if (is_prefix("unix://", call)) {
    ok = unix_init(g_call + 7);
  } else {
    ok = prog_init(g_call);
  }

  return ok;
}

static void shell_send(const char *path, const char *msg)
{
  size_t len = strlen(g_com_buf);
  int ret = execute_ret(g_com_buf + len, sizeof(g_com_buf) - len, "%s %s", path, msg);
  if (ret < 0) {
    fprintf(stderr, "shell: Failed to to execute %s\n", path);
    //append_message("cannot execute command\n");
  }
}

void call_send(const char *msg)
{
  if (is_prefix("udp://", g_call)) {
    udp_send(g_call + 6, msg);
  } else if (is_prefix("tcp://", g_call)) {
    tcp_send(g_call + 6, msg);
  } else if (is_prefix("unix://", g_call)) {
    unix_send(g_call + 7, msg);
  } else {
    shell_send(g_call, msg);
  }
}
