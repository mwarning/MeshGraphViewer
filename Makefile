CFLAGS ?= -O2
CFLAGS += -std=gnu99 -Wall -Werror -pedantic -fno-strict-aliasing -Wwrite-strings
LDFLAGS += -lmicrohttpd
SRC = src/files.c src/utils.c src/webserver.c src/call.c src/json.c src/cJSON.c src/main.c

.PHONY: all clean debug src/files.c

all: $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o graph-viewer $(LDFLAGS)

# Include files from www/ into src/files.c
src/files.c: www/*
	@echo Creating src/files.c
	@echo "#include \"files.h\"" > src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | md5sum | head -c 16); \
		(echo "static const unsigned char _$$id[] = {"; \
		xxd -i < www/$$file; \
		echo "};") >> src/files.c; \
	done
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
	rm -f graph-viewer src/files.c
