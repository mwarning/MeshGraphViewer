
#include <errno.h>
#include <stdlib.h>
#include <stdint.h>
#include <assert.h>
#include <string.h>
#include <stdio.h>

#include "cJSON.h"
#include "utils.h"
#include "json.h"

/*
 * Methods to modify the graph file.
*/

static cJSON *findNodeObject(cJSON *array, const char* lookup_id)
{
  char idstr[64];
  const char *id;
  if (cJSON_IsArray(array)) {
    cJSON *node = array->child;
    while (node) {
      if (cJSON_IsObject(node)) {
        cJSON *item = node->child;
        id = NULL;
        while (item) {
          if (0 == strcmp(item->string, "id")) {
            if (cJSON_IsString(item)) {
              id = item->valuestring;
              break;
            } else if (cJSON_IsNumber(item)) {
              sprintf(idstr, "%d", item->valueint);
              id = idstr;
              break;
            }
          }
          item = item->next;
        }

        if (id && 0 == strcmp(id, lookup_id)) {
          return node;
        }
      }
      node = node->next;
    }
  }

  return NULL;
}

static cJSON *findLinkObject(cJSON *array, const char* lookup_source, const char* lookup_target)
{
  char sourcestr[64];
  char targetstr[64];
  const char *source;
  const char *target;

  if (cJSON_IsArray(array)) {
    cJSON *link = array->child;
    while (link) {
      if (cJSON_IsObject(link)) {
        cJSON *item = link->child;
        source = NULL;
        target = NULL;

        while (item) {
          if (0 == strcmp(item->string, "source")) {
            if (cJSON_IsString(item)) {
              source = item->valuestring;
            } else if (cJSON_IsNumber(item)) {
              sprintf(sourcestr, "%d", item->valueint);
              source = sourcestr;
            }
            if (source && target) {
              break;
            }
          } else if (0 == strcmp(item->string, "target")) {
            if (cJSON_IsString(item)) {
              target = item->valuestring;
            } else if (cJSON_IsNumber(item)) {
              sprintf(targetstr, "%d", item->valueint);
              target = targetstr;
            }
            if (source && target) {
              break;
            }
          }
          item = item->next;
        }

        if (source && target) {
          if (0 == strcmp(source, lookup_source) && 0 == strcmp(target, lookup_target)) {
            return link;
          } else if (0 == strcmp(source, lookup_target) && 0 == strcmp(target, lookup_source)) {
            return link;
          }
        }

        source = NULL;
        target = NULL;
      }
      link = link->next;
    }
  }

  return NULL;
}

static void setObjectKeyValue(cJSON *obj, const char* key, cJSON *value)
{
  assert(obj != NULL);
  assert(key != NULL);
  // value may be null!

  if (cJSON_IsObject(obj)) {
    cJSON_DeleteItemFromObjectCaseSensitive(obj, key);
    if (value) {
      cJSON_AddItemToObject(obj, key, value);
    }
  } else {
    fprintf(stderr, "json: Item is not an object.\n");
  }
}

static void json_write(const char* path, cJSON *obj)
{
  char *str = cJSON_Print(obj);
  FILE *fp = fopen(path, "w");
  if (fp) {
    fprintf(fp, "%s", str);
    fclose(fp);
    // print to terminal
    //printf("%s\n", str);
    free(str);
  } else {
    fprintf(stderr, "json: Failed to write graph file: %s", strerror(errno));
  }
}

bool json_replace(const char *path, char *node_ids, char *link_ids, const char *key, const char *value)
{
  assert(path != NULL);
  assert(node_ids != NULL);
  assert(link_ids != NULL);
  assert(key != NULL);
  assert(value != NULL);

  //printf("json: path: %s, node_ids: %s, link_ids: %s, key: %s, value: %s\n",
  //  path, node_ids, link_ids, key, value);

  if (!path || !node_ids || !link_ids || !key) {
    fprintf(stderr, "json: Invalid query arguments\n");
    return false;
  }

  cJSON *json_value = NULL;
  if (strlen(value) > 0) {
    json_value = cJSON_Parse(value);
    if (!json_value) {
      // parsing error
      const char *error_ptr = cJSON_GetErrorPtr();
      if (error_ptr) {
        fprintf(stderr, "json: Failed to parse value: %s\n", error_ptr);
      } else {
        fprintf(stderr, "json: Failed to parse value.\n");
      }
      return false;
    }
  }

  size_t data_size = 0;
  uint8_t *data = read_file(&data_size, path);
  if (!data) {
    fprintf(stderr, "Failed to read graph file: %s\n", strerror(errno));
    return false;
  }

  cJSON *obj = cJSON_ParseWithLength((char*) data, data_size);
  if (!obj) {
    const char *error_ptr = cJSON_GetErrorPtr();
    if (error_ptr) {
      fprintf(stderr, "json: Failed to parse graph file: %s\n", error_ptr);
    } else {
      fprintf(stderr, "json: Failed to parse graph file.\n");
    }
    return false;
  }

  cJSON *nodes = NULL;
  cJSON *links = NULL;

  // find "nodes" / "links" objects
  if (cJSON_IsObject(obj)) {
    struct cJSON *cur = obj->child;
    while (cur) {
      if (cJSON_IsArray(cur) && 0 == strcmp(cur->string, "nodes")) {
        nodes = cur;
      }
      if (cJSON_IsArray(cur) && 0 == strcmp(cur->string, "links")) {
        links = cur;
      }
      cur = cur->next;
    }
  } else {
    fprintf(stderr, "json: Graph file contains no JSON object.\n");
    return false;
  }

  const char *delimiters = ",";

  if (nodes) {
    // iterate over node_ids and set key/value
    char *node_id = strtok(node_ids, delimiters);
    while (node_id) {
      cJSON *found = findNodeObject(nodes, node_id);
      if (found) {
        setObjectKeyValue(found, key, json_value);
      } else {
        fprintf(stderr, "json: Warning, node %s not found.\n", node_id);
      }
      node_id = strtok(NULL, delimiters);
    }
  } else {
    fprintf(stderr, "json: Warning, graph file does not contain a \"nodes\" array element.\n");
  }

  if (links) {
    // iterate of link_ids in pairs and set key/value
    char *link_source = strtok(link_ids, delimiters);
    char *link_target = strtok(NULL, delimiters);
    while (link_source && link_target) {
      cJSON *found = findLinkObject(links, link_source, link_target);
      if (found) {
        setObjectKeyValue(found, key, json_value);
      } else {
        fprintf(stderr, "json: Warning, link %s-%s not found.\n", link_source, link_target);
      }

      //printf("link_id: %s %s\n", link_source, link_target);
      link_source = strtok(NULL, delimiters);
      link_target = strtok(NULL, delimiters);
    }
  } else {
    fprintf(stderr, "json: Warning, graph file does not contain a \"links\" array element.\n");
  }

  json_write(path, obj);

  cJSON_Delete(obj);

  return true;
}
