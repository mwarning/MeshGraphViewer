#!/usr/bin/python

import socket
import os, os.path
import time
import sys
import json
import re
import subprocess
from collections import deque


if len(sys.argv) != 4:
  print(f"Usage: {sys.argv[0]} <unix-socket-path> <meshnet-lab-installation-path> <graph-json-file>")
  print()
  print(f"Example: {sys.argv[0]} /tmp/sim_connector.sock ../meshnet-lab ./graph.json")
  exit(1)

meshnetlab_path = sys.argv[1] 
socket_path = sys.argv[2] 
json_path = sys.argv[3]

if os.path.exists(socket_path):
  os.remove(socket_path)

server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(socket_path)

os.chmod(socket_path, 0o777)

print(f"listen on {socket_path}")

def split(s):
    return [x for x in s.split(",") if x]

def node_exists(node_id, graph):
  for node in graph["nodes"]:
    if node["id"] == node_id:
      return True
  return False

def filter_nodes(node_ids, graph):
  filtered = []
  for node_id in node_ids:
    if node_exists(node_id, graph):
      fitlered.append(node_id)
  return filtered

def get_link_id(link):
  s = link["source"]
  t = link["target"]
  if s > t:
    return f"{t}-{s}"
  else:
    return f"{s}-{t}"

def get_link_map(graph):
  links = {}
  for link in graph["links"]:
    links[get_link_id(link)] = link
  return links

def get_node_map(graph):
  nodes = {}
  for node in graph["nodes"]:
    nodes[node["id"]] = node
  return nodes

def get_graph():
  with open(json_path, "r") as file:
    return json.load(file)

def print_and_send(conn, message):
  print(message)
  conn.send((message + "\n").encode())

def update_graph(conn, graph_new):
  graph_old = get_graph()

  node_ids_old_set = set(get_node_map(graph_old).keys())
  node_ids_new_set = set(get_node_map(graph_new).keys())

  node_ids_remove = node_ids_old_set.difference(node_ids_new_set)
  node_ids_create = node_ids_new_set.difference(node_ids_old_set)

  #print(f"node_ids_create: {list(node_ids_create)}, node_ids_remove: {list(node_ids_remove)}")

  with open(json_path, "w") as file:
    json.dump(graph_new, file, indent='  ', sort_keys=True)

  if len(node_ids_remove) > 0:
    subprocess.run([f"{meshnetlab_path}/software.py", "stop", "batman-adv"] + list(node_ids_remove))

  subprocess.run([f"{meshnetlab_path}/network.py", "apply", json_path])

  if len(node_ids_create) > 0:
    subprocess.run([f"{meshnetlab_path}/software.py", "start", "batman-adv"] + list(node_ids_create))

  print_and_send(conn, "done")

def convert_link_ids(links_ids):
  # map [(source, target), ...] to list of link ids
  ret = []
  for i in range(0, len(links_ids), 2):
    if (i+1) < len(links_ids):
      source = links_ids[i]
      target = links_ids[i+1]
      ret.append(get_link_id({"source": source, "target": target}))
  return ret

def remove(conn, remove_node_ids, _remove_link_ids):
  remove_link_ids = convert_link_ids(_remove_link_ids)

  graph = get_graph()

  def delete_node(node):
    return node["id"] in remove_node_ids

  def delete_link(link):
    return (link["source"] in remove_node_ids or link["target"] in remove_node_ids) or get_link_id(link) in remove_link_ids

  # remove nodes
  graph["nodes"] = [node for node in graph["nodes"] if not delete_node(node)]

  # remove links
  graph["links"] = [link for link in graph["links"] if not delete_link(link)]

  update_graph(conn, graph)

def disconnect_nodes(conn, node_ids):
  if len(node_ids) != 2:
    print(f"Expected two links! Not {len(node_ids)}")
    return

  source_id = node_ids[0]
  target_id = node_ids[1]

  print(f"disconnect {source_id} and {target_id}")

  graph = get_graph()

  link = {"source": source_id, "target": target_id}

  link_id = get_link_id(link)

  nodes = get_node_map(graph)
  links = get_link_map(graph)

  if source_id not in nodes:
    print(f"node does not exist {source_id}")
    return

  if target_id not in nodes:
    print(f"node does not exist {target_id}")
    return

  if link_id not in links:
    print("link does not exist")
    return

  del links[link_id]
  graph["links"] = list(links.values())

  update_graph(conn, graph)

def connect_nodes(conn, node_ids):
  if len(node_ids) != 2:
    print(f"Expected two links! Not {len(node_ids)}")
    return

  source_id = node_ids[0]
  target_id = node_ids[1]

  print(f"connect {source_id} and {target_id}")

  graph = get_graph()

  link = {"source": source_id, "target": target_id}

  link_id = get_link_id(link)

  nodes = get_node_map(graph)
  links = get_link_map(graph)

  if source_id not in nodes:
    print(f"node does not exist {source_id}")
    return

  if target_id not in nodes:
    print(f"node does not exist {target_id}")
    return

  if link_id in links:
    print("link exists")
    return

  graph["links"].append(link)

  update_graph(conn, graph)

def add_node(conn):
  print(f"add node")

  graph = get_graph()

  nodes = get_node_map(graph)

  node_id = None
  for i in range(0, 1000):
    node_id = f'{i:04x}'
    if node_id not in nodes:
      break

  node = {"id": node_id}
  graph["nodes"].append(node)

  update_graph(conn, graph)

def get_node_info(conn, node_id):
  graph = get_graph()
  nodes = get_node_map(graph)
  if node_id in nodes:
    #print(f"get node info for {node_id}")
    command = ['ip', 'netns', 'exec', f'ns-{node_id}', 'batctl', 'o']
    result = subprocess.run(command, stderr=subprocess.STDOUT, stdout=subprocess.PIPE)
    conn.send(result.stdout)
  else:
    print_and_send(conn, f"Node does not exist: {node_id}")

def change_property(conn, node_ids, _link_ids, key, value):
  if key == "id":
    print_and_send(conn, f"Bad idea to change id field => denied")
    return

  link_ids = convert_link_ids(_link_ids)

  if len(node_ids) == 0 and len(link_ids) == 0:
    print_and_send(conn, f"Nothing selected")
    return

  graph = get_graph()
  nodes = get_node_map(graph)
  links = get_link_map(graph)

  for node_id in node_ids:
    if node_id not in nodes:
      print_and_send(conn, f"Node does not exist: {node_id}")
      return

  for link_id in link_ids:
    if link_id not in links:
      print_and_send(conn, f"Link does not exist: {link_id}")
      return

  def is_float(string):
    try:
      float(string)
      return True
    except ValueError:
      return False

  def get_typed_value(value):
    if value is None:
      return None
    elif value.startswith('"') and value.endswith('"'):
      return value[1:-1]
    elif value == "{}":
      return {}
    elif value == "[]":
      return []
    elif value.isnumeric():
      return int(value)
    elif is_float(value):
      return float(value)
    elif value == "true":
      return True
    elif value == "false":
      return False
    else:
      return value

  typed_value = get_typed_value(value)

  for node_id in node_ids:
    if typed_value is None:
      del nodes[node_id][key]
    else:
      nodes[node_id][key] = typed_value

  for link_id in link_ids:
    if typed_value is None:
      print(f"remove link_id: {link_id}, key: {key}")
      del links[link_id][key]
    else:
      links[link_id][key] = typed_value

  update_graph(conn, graph)

connect_nodes_re = re.compile("connect_nodes '(.*)'")
disconnect_nodes_re = re.compile("disconnect_nodes '(.*)'")
remove_re = re.compile("remove '(.*)' '(.*)'")
add_node_re = re.compile("add_node")
get_node_info_re = re.compile("get_node_info '(.*)'")
set_property_re = re.compile("set '(.*)' '(.*)' '(.*)' '(.*)'")
unset_property_re = re.compile("unset '(.*)' '(.*)' '(.*)'")

while True:
  server.listen(1)
  conn, addr = server.accept()
  datagram = conn.recv(1024)
  if datagram:
    try:
      text = datagram.decode("ascii")
      print(text)

      m = connect_nodes_re.fullmatch(text)
      if m:
        node_ids = split(m.group(1))
        connect_nodes(conn, node_ids)
        continue

      m = disconnect_nodes_re.fullmatch(text)
      if m:
        node_ids = split(m.group(1))
        disconnect_nodes(conn, node_ids)
        continue

      m = remove_re.fullmatch(text)
      if m:
        node_ids = split(m.group(1))
        link_ids = split(m.group(2))
        remove(conn, node_ids, link_ids)
        continue

      m = add_node_re.fullmatch(text)
      if m:
        add_node(conn)
        continue

      m = get_node_info_re.fullmatch(text)
      if m:
        node_id = m.group(1)
        get_node_info(conn, node_id)
        continue

      m = set_property_re.fullmatch(text)
      if m:
        node_ids = split(m.group(1))
        link_ids = split(m.group(2))
        key = m.group(3)
        value = m.group(4)
        change_property(conn, node_ids, link_ids, key, value)
        continue

      m = unset_property_re.fullmatch(text)
      if m:
        node_ids = split(m.group(1))
        link_ids = split(m.group(2))
        key = m.group(3)
        change_property(conn, node_ids, link_ids, key, None)
        continue

      conn.send(f"Unknown command: {text}\n".encode())
      print(f"unknown command: {text}")
    except Exception as e:
      conn.send(f"Error: {e}\n".encode())
      print(f"Error: {e}")
