CC ?= gcc
CFLAGS ?= -O2
CFLAGS += -std=gnu99 -Wall -pedantic -Werror -fno-strict-aliasing -Wwrite-strings
LFLAGS += -lmicrohttpd
SRC = src/main.c src/webserver.c src/utils.c src/files.c

.PHONY: all clean debug src/files.c


all: $(SRC)
	$(CC) $(CFLAGS) $(LFLAGS) $(SRC) -o graph-viewer

# Include files in www into files.h/files.c
src/files.c:
	# write src/files.h
	@rm -f src/files.h
	@echo "struct content { const char *path; unsigned char* data; unsigned int size; };" >> src/files.h
	@echo "struct content g_content[`find www/ -type f | wc -l`+1];" >> src/files.h
	
	# write src/files.c
	@rm -f src/files.c
	@echo "#include \"files.h\"" >> src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | md5sum | head -c 16); \
		(echo "unsigned char _$$id[] = {"; \
		xxd -i < www/$$file; \
		echo "};") >> src/files.c; \
	done
	@echo "struct content g_content[`find www/ -type f | wc -l`+1] = {" >> src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | md5sum | head -c 16); \
		echo "  {\"/$$file\", &_$$id[0], sizeof(_$$id)}," >> src/files.c; \
	done
	@echo "  {0, 0, 0}" >> src/files.c
	@echo "};" >> src/files.c

debug: CFLAGS += -DDEBUG
debug: all

clean:
	rm -f graph-viewer src/files.h src/files.c
