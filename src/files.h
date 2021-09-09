#ifndef _FILES_H_
#define _FILES_H_

struct content {
	const char *path;
	const unsigned char* data;
	const unsigned int size;
};

extern const struct content *g_content;

#endif // _FILES_H_