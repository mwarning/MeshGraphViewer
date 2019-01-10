#ifndef _UTILS_H_
#define _UTILS_H_


#ifdef DEBUG
#define debug(...) printf( __VA_ARGS__)
#else
#define debug(...)
#endif

// Ignore compiler error
#define UNUSED(expr) do { (void)(expr); } while (0)

// Number of elements in an array
#define ARRAY_SIZE(x) (sizeof(x) / sizeof((x)[0]))

int is_executable(const char path[]);

int execute(const char fmt[], ...);
int execute_ret(char* msg, int msg_len, const char fmt[], ...);

int create_path(const char* path);
int create_file(const char* path, uint8_t *data, size_t len);

#endif // _UTILS_H_