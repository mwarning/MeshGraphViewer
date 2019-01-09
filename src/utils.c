#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <libgen.h>

#include "utils.h"


static int create_path_element(const char *path, int len) {
  char buf[64] = {0};

  if (len+1 >= sizeof(buf)) {
    return EXIT_FAILURE;
  }

  strncpy(buf, path, len);

  int rc = mkdir(buf, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
  if (rc != 0 && errno != EEXIST) {
    fprintf( stderr, "Error creating '%s': %s\n", buf, strerror(errno));
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}

int create_path(const char* path) {
  int len;
  char *e;

  len = 0;
  while (1) {
    e = strchr(path + len, '/');
    if (e) {
      len = (int) (e - path);
      if (create_path_element(path, len) == EXIT_FAILURE) {
        return EXIT_FAILURE;
      }
      len += 1;
    } else {
      len = strlen(path);
      break;
    }
  }

  return create_path_element(path, len);
}

int create_file(const char* path, uint8_t *data, size_t len) {
  size_t written;
  FILE *file;

  file = fopen(path, "wb");
  if (file == NULL) {
    fprintf(stderr, "Error creating '%s': %s\n", path, strerror(errno));
    return EXIT_FAILURE;
  }

  written = fwrite(data, sizeof(uint8_t), len, file);
  fclose(file);

  if (written != len) {
    fprintf( stderr, "Error creating '%s': %s\n", path, strerror(errno));
    return EXIT_FAILURE;
  }

  return EXIT_SUCCESS;
}
