CC ?= gcc
CFLAGS ?= -O2
CFLAGS += -std=gnu99 -Wall -pedantic -Werror -fno-strict-aliasing -Wwrite-strings
LFLAGS += -lmicrohttpd
SRC = src/main.c src/webserver.c src/utils.c src/files.c

.PHONY: all clean debug files


#all: CFLAGS += -DDEBUG
all: $(SRC)
	$(CC) $(CFLAGS) $(LFLAGS) $(SRC) -o graph-viewer

# Include files in www into files.h
src/files.c: $(wildcard www/*)
	num=`find www/ -type f | wc -l`

	# write src/files.h
	@rm -f src/files.h
	@echo "struct content { const char *path; unsigned char* data; unsigned int size; };" >> src/files.h
	@echo "struct content g_content[$$num+1];" >> src/files.h

	# write src/files.c
	@rm -f src/files.c
	@echo "#include \"files.h\"" >> src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | tr '/.' '_'); \
		(echo "unsigned char $$id[$$num+1] = {"; \
		xxd -i < www/$$file; \
		echo "};") >> src/files.c; \
	done
	@echo "g_content = {" >> src/files.c
	@for file in `find www/ -type f -printf "%P "`; do \
		id=$$(echo $$file | tr '/.' '_'); \
		echo "  {\"/$$file\", &$$id[0], sizeof($$id)}," >> src/files.c; \
	done
	@echo "  {0, 0, 0}" >> src/files.c
	@echo "};" >> src/files.c

debug: CFLAGS += -DDEBUG
debug: all

clean:
	rm -f graph-viewer src/files.h src/files.c
