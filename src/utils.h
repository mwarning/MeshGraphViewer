#ifndef _UTILS_H_
#define _UTILS_H_

#include <netinet/in.h>
#include <stdbool.h>

#ifdef DEBUG
#define debug(...) printf(__VA_ARGS__)
#else
#define debug(...)
#endif

// Ignore compiler error
#define UNUSED(expr) do { (void)(expr); } while (0)

// Number of elements in an array
#define ARRAY_SIZE(x) (sizeof(x) / sizeof((x)[0]))


int addr_parse_full(struct sockaddr_storage *addr, const char full_addr_str[], const char default_port[], int af);
const char *str_addr(const struct sockaddr_storage *addr);
int addr_parse(struct sockaddr_storage *addr, const char addr_str[], const char port_str[], int af);

uint8_t *read_file(size_t *size, const char path[]);
bool is_suffix(const char str[], const char suffix[]);
bool is_prefix(const char prefix[], const char str[]);

bool is_program(const char path[]);
bool is_file(const char path[]);
bool is_directory(const char path[]);

int execute(const char fmt[], ...);
int execute_ret(char* msg, int msg_len, const char fmt[], ...);

bool create_path(const char* path);
bool create_file(const char* path, const uint8_t *data, const size_t len);

#endif // _UTILS_H_
