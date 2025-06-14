#ifndef _JSON_H_
#define _JSON_H_

#include <stdbool.h>

/*
* Load JSON graph file from path and set the property of
* node/link objects by key and json_value.
* When value is NULL, then the key will be removed.
*/
bool json_set(const char *path, char *node_ids, char *link_ids, const char *key, const char *value);

bool json_connect(const char *path, char *node_ids);
bool json_disconnect(const char *path, char *node_ids);

#endif // _JSON_H_
