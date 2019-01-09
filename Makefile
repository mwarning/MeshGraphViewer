CC ?= gcc
CFLAGS ?= -O2
CFLAGS += -std=gnu99 -Wall -pedantic -Werror -fno-strict-aliasing -Wwrite-strings
LFLAGS += -lpcap
SRC = src/main.c

# Add webserver and include web ui files
CFLAGS +=
LFLAGS += -lmicrohttpd
SRC += src/webserver.c src/files.h

.PHONY: all clean debug


#all: CFLAGS += -DDEBUG
all: $(SRC)
	$(CC) $(CFLAGS) $(LFLAGS) $(SRC) -o graph-viewer

# Include files in www into files.h
src/files.h: $(wildcard www/*)
	@rm -f src/files.h
	@for file in www/*; do \
		xxd -i $$file >> src/files.h; \
	done
	@echo "struct content { const char *path; unsigned char* data; unsigned int size; };" >> src/files.h
	@echo "struct content g_content[] = {" >> src/files.h
	@for file in www/*; do \
		echo "{\"/$$(basename $$file)\", &$$(echo $$file | tr '/.' '_')[0], sizeof($$(echo $$file | tr '/.' '_'))}," >> src/files.h; \
	done
	@echo "{0, 0, 0}" >> src/files.h
	@echo "};" >> src/files.h

debug: CFLAGS += -DDEBUG
debug: all

clean:
	rm -f graph-viewer
