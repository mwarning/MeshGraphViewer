#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <libgen.h>
#include <signal.h>
#include <stdarg.h>
#include <arpa/inet.h>

#include "utils.h"


uint8_t *read_file(size_t *size, const char path[])
{
  FILE *fp = fopen(path, "r");
  if (NULL == fp) {
    return NULL;
  }

  fseek(fp, 0, SEEK_END);
  long fsize = ftell(fp);
  fseek(fp, 0, SEEK_SET);

  uint8_t *fdata = malloc(fsize);
  if (!fread(fdata, fsize, 1, fp)) {
    fprintf(stderr, "fread() %s / %s\n", strerror(errno), path);
  }
  fclose(fp);

  *size = fsize;

  return fdata;
}

bool is_suffix(const char s[], const char suffix[])
{
  size_t slen = strlen(s);
  size_t suffixlen = strlen(suffix);

  if (suffixlen >= slen) {
    return 0;
  }

  return (0 == memcmp(s + (slen - suffixlen), suffix, suffixlen));
}

#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <unistd.h>

const char *str_addr(const struct sockaddr_storage *addr)
{
  static char addrbuf[200];
  char buf[INET6_ADDRSTRLEN];
  const char *fmt;
  int port;

  switch (addr->ss_family) {
  case AF_INET6:
    port = ((struct sockaddr_in6 *)addr)->sin6_port;
    inet_ntop(AF_INET6, &((struct sockaddr_in6 *)addr)->sin6_addr, buf, sizeof(buf));
    fmt = "[%s]:%d";
    break;
  case AF_INET:
    port = ((struct sockaddr_in *)addr)->sin_port;
    inet_ntop(AF_INET, &((struct sockaddr_in *)addr)->sin_addr, buf, sizeof(buf));
    fmt = "%s:%d";
    break;
  default:
    return "<invalid address>";
  }

  sprintf(addrbuf, fmt, buf, ntohs(port));

  return addrbuf;
}

int port_set(struct sockaddr_storage *addr, uint16_t port)
{
  switch (addr->ss_family) {
  case AF_INET:
    ((struct sockaddr_in *)addr)->sin_port = htons(port);
    return EXIT_SUCCESS;
  case AF_INET6:
    ((struct sockaddr_in6 *)addr)->sin6_port = htons(port);
    return EXIT_SUCCESS;
  default:
    return EXIT_FAILURE;
  }
}

bool is_prefix(const char prefix[], const char s[])
{
    size_t prefixlen = strlen(prefix),
           slen = strlen(s);
    return slen < prefixlen ? 0 : (strncmp(prefix, s, prefixlen) == 0);
}

int addr_parse(struct sockaddr_storage *addr, const char addr_str[], const char port_str[], int af)
{
  struct addrinfo hints;
  struct addrinfo *info = NULL;
  struct addrinfo *p = NULL;

  memset(&hints, '\0', sizeof(struct addrinfo));
  hints.ai_socktype = SOCK_STREAM;
  //hints.ai_flags = AI_NUMERICHOST;
  hints.ai_family = af;

  if (getaddrinfo(addr_str, port_str, &hints, &info) != 0) {
    return -2;
  }

  p = info;
  while (p != NULL) {
    if (p->ai_family == AF_INET) {
      memcpy(addr, p->ai_addr, sizeof(struct sockaddr_in));
      freeaddrinfo(info);
      return 0;
    }
    p = p->ai_next;
  }

  p = info;
  while (p != NULL) {
    if (p->ai_family == AF_INET6) {
      memcpy(addr, p->ai_addr, sizeof(struct sockaddr_in6));
      freeaddrinfo(info);
      return 0;
    }
    p = p->ai_next;
  }

  freeaddrinfo(info);

  return -3;
}

/*
* Parse/Resolve various string representations of
* IPv4/IPv6 addresses and optional port.
* An address can also be a domain name.
* A port can also be a service  (e.g. 'www').
*
* "<address>"
* "<ipv4_address>:<port>"
* "[<address>]"
* "[<address>]:<port>"
*/
int addr_parse_full(struct sockaddr_storage *addr, const char full_addr_str[], const char default_port[], int af)
{
  char addr_buf[256];
  char *addr_beg;
  char *addr_tmp;
  char *last_colon;
  const char *addr_str = NULL;
  const char *port_str = NULL;
  size_t len;

  len = strlen(full_addr_str);
  if (len >= (sizeof(addr_buf) - 1)) {
    // address too long
    return -1;
  } else {
    addr_beg = addr_buf;
  }

  memset(addr_buf, '\0', sizeof(addr_buf));
  memcpy(addr_buf, full_addr_str, len);

  last_colon = strrchr(addr_buf, ':');

  if (addr_beg[0] == '[') {
    // [<addr>] or [<addr>]:<port>
    addr_tmp = strrchr(addr_beg, ']');

    if (addr_tmp == NULL) {
      // broken format
      return -1;
    }

    *addr_tmp = '\0';
    addr_str = addr_beg + 1;

    if (*(addr_tmp+1) == '\0') {
      port_str = default_port;
    } else if (*(addr_tmp+1) == ':') {
      port_str = addr_tmp + 2;
    } else {
      // port expected
      return -1;
    }
  } else if (last_colon && last_colon == strchr(addr_buf, ':')) {
    // <non-ipv6-addr>:<port>
    addr_tmp = last_colon;
    if (addr_tmp) {
      *addr_tmp = '\0';
      addr_str = addr_buf;
      port_str = addr_tmp+1;
    } else {
      addr_str = addr_buf;
      port_str = default_port;
    }
  } else {
    // <addr>
    addr_str = addr_buf;
    port_str = default_port;
  }

  return addr_parse(addr, addr_str, port_str, af);
}

bool is_program(const char path[])
{
  struct stat sb;
  return (stat(path, &sb) == 0) && (sb.st_mode & S_IXUSR) && S_ISREG(sb.st_mode);
}

bool is_directory(const char path[])
{
  struct stat sb;
  return (stat(path, &sb) == 0) && S_ISDIR(sb.st_mode);
}

bool is_file(const char path[])
{
  struct stat sb;
  return (stat(path, &sb) == 0) && S_ISREG(sb.st_mode);
}

static int _execute_ret(char* msg, int msg_len, const char *cmd)
{
  //debug("Executing command: %s\n", cmd);
  int rc = 0;

  /* Temporarily get rid of SIGCHLD handler (see main.c), until child exits. */
  struct sigaction sa, oldsa;
  sa.sa_handler = SIG_DFL;
  sigemptyset(&sa.sa_mask);
  sa.sa_flags = SA_NOCLDSTOP | SA_RESTART;
  if (sigaction(SIGCHLD, &sa, &oldsa) == -1) {
    fprintf(stderr, "sigaction() failed to set default SIGCHLD handler: %s", strerror(errno));
    return EXIT_FAILURE;
  }

  FILE *fp = popen(cmd, "r");
  if (fp == NULL) {
    fprintf(stderr, "popen(): %s", strerror(errno));
    rc = -1;
    goto abort;
  }

  if (msg && msg_len > 0) {
    fread(msg, msg_len - 1, 1, fp);
  }

  rc = pclose(fp);

  if (WIFSIGNALED(rc) != 0) {
    fprintf(stderr, "Command process exited due to signal %d", WTERMSIG(rc));
  }

  rc = WEXITSTATUS(rc);

abort:

  /* Restore signal handler */
  if (sigaction(SIGCHLD, &oldsa, NULL) == -1) {
    fprintf(stderr, "sigaction() failed to restore SIGCHLD handler! Error %s", strerror(errno));
  }

  return rc;
}

int execute(const char fmt[], ...)
{
  char cmd[1024];
  va_list vlist;

  va_start(vlist, fmt);
  int rc = vsnprintf(cmd, sizeof(cmd), fmt, vlist);
  va_end(vlist);

  if (rc < 0 || rc >= sizeof(cmd)) {
    fprintf(stderr, "Format string too small or encoding error.");
    return -1;
  }

  return _execute_ret(NULL, 0, cmd);
}

int execute_ret(char* msg, int msg_len, const char fmt[], ...)
{
  char cmd[1024];
  va_list vlist;

  va_start(vlist, fmt);
  int rc = vsnprintf(cmd, sizeof(cmd), fmt, vlist);
  va_end(vlist);

  if (rc < 0 || rc >= sizeof(cmd)) {
    fprintf(stderr, "Format string too small or encoding error.");
    return -1;
  }

  return _execute_ret(msg, msg_len, cmd);
}

static bool create_path_element(const char *path, int len)
{
  char buf[64] = {0};

  if ((len+1) >= sizeof(buf)) {
    return false;
  }

  strncpy(buf, path, len);

  int rc = mkdir(buf, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
  if (rc != 0 && errno != EEXIST) {
    fprintf(stderr, "Error creating directory '%s': %s\n", buf, strerror(errno));
    return false;
  }

  return true;
}

bool create_path(const char* path)
{
  if (path[0] == '/') {
    path += 1;
  }

  size_t len = 0;
  while (true) {
    char *e = strchr(path + len, '/');
    if (e) {
      len = (int) (e - path);
      if (len && !create_path_element(path, len)) {
        return false;
      }
      len += 1;
    } else {
      len = strlen(path);
      break;
    }
  }

  return true;
}

bool create_file(const char* path, const uint8_t *data, const size_t len)
{
  FILE *file = fopen(path, "wb");
  if (file == NULL) {
    fprintf(stderr, "fopen() %s %s\n", strerror(errno), path);
    return false;
  }

  size_t written = fwrite(data, sizeof(uint8_t), len, file);

  if (written != len) {
    fprintf(stderr, "fwrite() %s %s\n", strerror(errno), path);
    fclose(file);
    return false;
  }

  fclose(file);
  return true;
}
