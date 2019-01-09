
function createFile(graph) {
  var self = {};

  function offerDownload(filename, text) {
    var a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    a.setAttribute('download', filename);

    a.style.display = 'none';
    document.body.appendChild(a);

    a.click();
    document.body.removeChild(a);
  }

  function readFileContent(file, callback) {
    if (file) {
      var r = new FileReader();
      r.onload = function(e) {
        callback(e.target.result);
      };
      r.onerror = function(e) {
        alert('Failed to load file: ' + file.name + ' (' + e.target.error.name + ')');
      };
      r.readAsText(file);
    } else {
      alert('No file selected.');
    }
  }

  function readUrlContent(url, callback) {
    if (url.length) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState == 4) {
          if (request.status == 200) {
            callback(request.responseText, url);
          } else {
            var msg = request.statusText;
            alert('Failed to load URL: ' + url + ' (' + (msg.length ? msg : 'unknown') + ')');
          }
        }
      };
      request.open('GET', url, true);
      request.send();
    } else {
      alert('No URL selected.');
    }
  }

  function toJSON(obj, indent = -1) {
    if (indent === -1) {
      return JSON.stringify(obj);
    } else if (indent === -2) {
      return JSON.stringify(obj, undefined, '\t');
    } else {
      return JSON.stringify(obj, undefined, indent);
    }
  }
/*
  self.loadGraphData = function() {
    send('/cmd/graph', {}, function(data) {
      var json = JSON.parse(data);
      graph.addElements(json.nodes, json.links);
    });
  }

  self.loadRoutingData = function() {
    alert("TODO: add stateid");
    send('/cmd/nodes', {stateid: 0}, function(data) {
      var json = JSON.parse(data);
      graph.addElements(json.nodes, json.links);
    });
  }
  */

  return self;
}
