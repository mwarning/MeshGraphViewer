CC ?= gcc
CFLAGS ?= -O2
CFLAGS += -std=gnu99 -Wall -Werror -pedantic -fno-strict-aliasing -Wwrite-strings
LDFLAGS += -lmicrohttpd
SRC = src/files.c src/utils.c src/webserver.c src/call.c src/main.c
#NUMWWW := `find www/ -type f | wc -l`

.PHONY: all clean debug src/files.c

all: $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o graph-viewer $(LDFLAGS)

# Include files in www into files.h/files.c
src/files.c: www/* Makefile
	@echo Creating src/files.h
	@rm -f src/files.h
	@echo "struct content { const char *path; const unsigned char* data; const unsigned int size; };" >> src/files.h
	@echo "extern const struct content *g_content;" >> src/files.h
	@echo Creating src/files.c
	@rm -f src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | md5sum | head -c 16); \
		(echo "static const unsigned char _$$id[] = {"; \
		xxd -i < www/$$file; \
		echo "};") >> src/files.c; \
	done
	@echo "struct content { const char *path; const unsigned char* data; const unsigned int size; };" >> src/files.c
	@echo "static const struct content _content[] = {" >> src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | md5sum | head -c 16); \
		echo "  {\"/$$file\", &_$$id[0], sizeof(_$$id)}," >> src/files.c; \
	done
	@echo "  {0, 0, 0}" >> src/files.c
	@echo "};" >> src/files.c
	@echo "const struct content *g_content = &_content[0];" >> src/files.c

debug: CFLAGS += -DDEBUG
debug: all

clean:
	rm -f graph-viewer src/files.h src/files.c
