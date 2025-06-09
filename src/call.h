#ifndef _PARSE_CALL_H_
#define _PARSE_CALL_H_

#include <stdbool.h>

extern int g_com_sock;
extern char g_com_buf[2048];

void call_receive();
void call_send(const char *buf);
bool call_validate(const char *call);

#endif // _PARSE_CALL_H_
