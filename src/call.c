#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>

#include "main.h"
#include "utils.h"

#define DEFAULT_PORT "3000"


int g_com_sock = -1;
char g_com_buf[512] = { 0 };


// Set a socket non-blocking
static int net_set_nonblocking(int fd)
{
  return fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
}

void call_receive()
{
  if (g_com_sock >= 0) {
    int len = strlen(g_com_buf);
    int n = 0;

    if (is_prefix("udp://", g_call)) {
      n = read(g_com_sock, g_com_buf + len, sizeof(g_com_buf) - len);
    } else if (is_prefix("tcp://", g_call)) {
      n = recv(g_com_sock, g_com_buf + len, sizeof(g_com_buf) - len, 0);
    } else if (is_prefix("unix://", g_call)) {
      n = recv(g_com_sock, g_com_buf + len, sizeof(g_com_buf) - len, 0);
    }

    if (n <= 0) {
      close(g_com_sock);
      g_com_sock = -1;
    }
  }
}

static void tcp_send(const char* addr_str, const char *msg)
{
  const int opt_on = 1;
  struct sockaddr_storage addr = {0};

  if (g_com_sock < 0) {
    if (addr_parse_full(&addr, addr_str, DEFAULT_PORT, AF_UNSPEC) != 0) {
      fprintf(stderr, "Failed to parse IP address '%s'\n", addr_str);
      goto error;
    }

    if ((g_com_sock = socket(PF_INET, SOCK_STREAM, 0)) < 0) {
      goto error;
    }

    if (setsockopt(g_com_sock, SOL_SOCKET, SO_REUSEADDR, &opt_on, sizeof(opt_on)) < 0) {
      goto error;
    }

    if (connect(g_com_sock, (struct sockaddr*) &addr, sizeof(addr)) < 0) {
      fprintf(stderr, "TCP connect error\n");
      goto error;
    }

    net_set_nonblocking(g_com_sock);
  }

  if (send(g_com_sock, msg, strlen(msg), 0) < 0) {
    goto error;
  }

  return;

error:
  close(g_com_sock);
  g_com_sock = -1;

  fprintf(stderr, "%s\n", strerror(errno));

  return;
}

static void udp_send(const char* addr_str, const char *msg)
{
  const int opt_on = 1;
  struct sockaddr_storage addr = {0};
  socklen_t addrlen;

  if (g_com_sock < 0) {
    if (addr_parse_full(&addr, addr_str, DEFAULT_PORT, AF_UNSPEC) != 0) {
      fprintf(stderr, "Failed to parse IP address '%s'\n", addr_str);
      goto error;
    }

    if ((g_com_sock = socket(PF_INET, SOCK_DGRAM, IPPROTO_UDP)) < 0) {
      goto error;
    }
    net_set_nonblocking(g_com_sock);

    if (setsockopt(g_com_sock, SOL_SOCKET, SO_REUSEADDR, &opt_on, sizeof(opt_on)) < 0) {
      goto error;
    }
  }

  addrlen = sizeof(struct sockaddr_in);
  if (sendto(g_com_sock, msg, strlen(msg), 0, (struct sockaddr*) &addr, addrlen) < 0) {
    fprintf(stderr, "UDP send error\n");
    goto error;
  }

  return;

error:
  close(g_com_sock);
  g_com_sock = -1;

  fprintf(stderr, "%s\n", strerror(errno));

  return;
}

static void unix_send(const char* addr_str, const char *msg)
{
  struct sockaddr_un addr = {0};

  if (g_com_sock < 0) {
    if ((g_com_sock = socket(AF_LOCAL, SOCK_STREAM, 0)) < 0) {
      goto error;
    }
    net_set_nonblocking(g_com_sock);

    addr.sun_family = AF_LOCAL;
    strcpy(addr.sun_path, addr_str);
  }

  if (connect(g_com_sock, (struct sockaddr *) &addr, sizeof(addr)) < 0) {
    fprintf(stderr, "Failed to connect to '%s': %s\n", addr_str, strerror(errno));
    goto error;
  }

  if (send(g_com_sock, msg, strlen(msg), 0) < 0) {
    goto error;
  }

  return;

error:
  close(g_com_sock);
  g_com_sock = -1;

  fprintf(stderr, "%s\n", strerror(errno));

  return;
}

void call_send(const char *addr_str, const char *msg)
{
  if (is_prefix("udp://", g_call)) {
    udp_send(g_call + 6, msg);
  } else if (is_prefix("tcp://", g_call)) {
    tcp_send(g_call + 6, msg);
  } else if (is_prefix("unix://", g_call)) {
    unix_send(g_call + 7, msg);
  } else {
    int len = strlen(g_com_buf);
    execute_ret(g_com_buf + len, sizeof(g_com_buf) - len, "%s %s", g_call, msg);
  }
}
