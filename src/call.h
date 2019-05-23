#ifndef _PARSE_CALL_H_
#define _PARSE_CALL_H_

extern int g_com_sock;
extern char g_com_buf[512];

void call_receive();
int call_send(const char *addr_str, const char *buf, size_t buflen);

#endif // _PARSE_CALL_H_