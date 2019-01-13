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


uint8_t *read_file(size_t *size, const char path[]) {
  uint8_t *fdata;
  long fsize;
  FILE *fp;

  fp = fopen(path, "rb");
  if (NULL == fp) {
    return NULL;
  }

  fseek(fp, 0, SEEK_END);
  fsize = ftell(fp);
  fseek(fp, 0, SEEK_SET);

  fdata = malloc(fsize);
  fread(fdata, fsize, 1, fp);
  fclose(fp);

  *size = fsize;

  return fdata;
}

int is_suffix(const char path[], const char prefix[]) {
  int pathlen = strlen(path);
  int prefixlen = strlen(prefix);

  if (prefixlen >= pathlen) {
    return 0;
  }

  return (0 == memcmp(path + (pathlen - prefixlen), prefix, prefixlen));
}

int is_program(const char path[]) {
  struct stat sb;
  return (stat(path, &sb) == 0) && (sb.st_mode & S_IXUSR) && S_ISREG(sb.st_mode);
}

int is_directory(const char path[]) {
  struct stat sb;
  return (stat(path, &sb) == 0) && S_ISDIR(sb.st_mode);
}

int is_file(const char path[]) {
  struct stat sb;
  return (stat(path, &sb) == 0) && S_ISREG(sb.st_mode);
}

static int _execute_ret(char* msg, int msg_len, const char *cmd) {
  struct sigaction sa, oldsa;
  FILE *fp;
  int rc;

  debug(LOG_DEBUG, "Executing command: %s", cmd);

  /* Temporarily get rid of SIGCHLD handler (see main.c), until child exits. */
  debug(LOG_DEBUG,"Setting default SIGCHLD handler SIG_DFL");
  sa.sa_handler = SIG_DFL;
  sigemptyset(&sa.sa_mask);
  sa.sa_flags = SA_NOCLDSTOP | SA_RESTART;
  if (sigaction(SIGCHLD, &sa, &oldsa) == -1) {
    debug(LOG_ERR, "sigaction() failed to set default SIGCHLD handler: %s", strerror(errno));
  }

  fp = popen(cmd, "r");
  if (fp == NULL) {
    debug(LOG_ERR, "popen(): %s", strerror(errno));
    rc = -1;
    goto abort;
  }

  if (msg && msg_len > 0) {
    fread(msg, msg_len - 1, 1, fp);
  }

  rc = pclose(fp);

  if (WIFSIGNALED(rc) != 0) {
    debug(LOG_WARNING, "Command process exited due to signal %d", WTERMSIG(rc));
  }

  rc = WEXITSTATUS(rc);

abort:

  /* Restore signal handler */
  if (sigaction(SIGCHLD, &oldsa, NULL) == -1) {
    debug(LOG_ERR, "sigaction() failed to restore SIGCHLD handler! Error %s", strerror(errno));
  }

  return rc;
}

int execute(const char fmt[], ...) {
  char cmd[512];
  va_list vlist;
  int rc;

  va_start(vlist, fmt);
  rc = vsnprintf(cmd, sizeof(cmd), fmt, vlist);
  va_end(vlist);

  if (rc < 0 || rc >= sizeof(cmd)) {
    debug(LOG_ERR, "Format string too small or encoding error.");
    return -1;
  }

  return _execute_ret(NULL, 0, cmd);
}

int execute_ret(char* msg, int msg_len, const char fmt[], ...) {
  char cmd[512];
  va_list vlist;
  int rc;

  va_start(vlist, fmt);
  rc = vsnprintf(cmd, sizeof(cmd), fmt, vlist);
  va_end(vlist);

  if (rc < 0 || rc >= sizeof(cmd)) {
    debug(LOG_ERR, "Format string too small or encoding error.");
    return -1;
  }

  return _execute_ret(msg, msg_len, cmd);
}

int parse_addr(struct sockaddr_storage *addr, const char* src, int port) {
  if (port < 1 || port > 65535) {
    return EXIT_FAILURE;
  }

  memset(addr, 0, sizeof(struct sockaddr_storage));

  if (inet_pton(AF_INET, src, &((struct sockaddr_in*) addr)->sin_addr) == 1) {
    ((struct sockaddr_in *)addr)->sin_family = AF_INET;
    ((struct sockaddr_in *)addr)->sin_port = htons(port);
    return EXIT_SUCCESS;
  } else if (inet_pton(AF_INET6, src, &((struct sockaddr_in6*) addr)->sin6_addr) == 1) {
    ((struct sockaddr_in6 *)addr)->sin6_family = AF_INET6;
    ((struct sockaddr_in6 *)addr)->sin6_port = htons(port);
    return EXIT_SUCCESS;
  } else {
    return EXIT_FAILURE;
  }
}

static int create_path_element(const char *path, int len) {
  char buf[64] = {0};

  if (len+1 >= sizeof(buf)) {
    return EXIT_FAILURE;
  }

  strncpy(buf, path, len);

  int rc = mkdir(buf, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
  if (rc != 0 && errno != EEXIST) {
    fprintf( stderr, "Error creating directory '%s': %s\n", buf, strerror(errno));
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}

int create_path(const char* path) {
  int len;
  char *e;

  if (path[0] == '/') {
    path += 1;
  }

  len = 0;
  while (1) {
    e = strchr(path + len, '/');
    if (e) {
      len = (int) (e - path);
      if (len && create_path_element(path, len) == EXIT_FAILURE) {
        return EXIT_FAILURE;
      }
      len += 1;
    } else {
      len = strlen(path);
      break;
    }
  }

  return EXIT_SUCCESS;
}

int create_file(const char* path, uint8_t *data, size_t len) {
  size_t written;
  FILE *file;

  file = fopen(path, "wb");
  if (file == NULL) {
    fprintf(stderr, "Error creating file '%s': %s\n", path, strerror(errno));
    return EXIT_FAILURE;
  }

  written = fwrite(data, sizeof(uint8_t), len, file);
  fclose(file);

  if (written != len) {
    fprintf(stderr, "Error creating file '%s': %s\n", path, strerror(errno));
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}
