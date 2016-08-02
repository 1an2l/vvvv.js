
if (typeof define !== 'function') { var define = require(VVVVContext.Root+'/node_modules/amdefine')(module, VVVVContext.getRelativeRequire(require)) }

define(function(require,exports) {


  var _ = require('underscore');
  var $ = require('jquery');
  var VVVV = require('./vvvv.core.defines');

  var Cluster = function(patch) {
    this.clusterEdgeNodes = {};
    this.inputEdgePins = {};
    this.outputEdgePins = {};
    this.hasNodes = false;

    this.detect = function() {
      function findCluster(node, clusterActive) {
        if (node.inCluster)
          return;
        node.inCluster = false;
        if (node.environments && node.environments[0]=='nodejs')
          node.inCluster = true;
        for (var pinname in node.inputPins) {
          if (node.inputPins[pinname].links.length>0) {
            var fromPin = node.inputPins[pinname].links[0].fromPin;
            findCluster(fromPin.node, (clusterActive || node.inCluster) && (!node.environments || node.environments[0]!='browser') && !node.isSubpatch);
            if ((!node.environments || node.environments[0]!='browser') && !node.isSubpatch)
              node.inCluster |= fromPin.node.inCluster && clusterActive;
          }
        }
        for (var pinname in node.inputPins) {
          if (node.inputPins[pinname].links.length>0) {
            var fromPin = node.inputPins[pinname].links[0].fromPin;
            if (node.inCluster)
              fromPin.edgeLinkCount--;
            if (fromPin.edgeLinkCount<=0)
              fromPin.inClusterEdge = false;
          }
        }

        if (node.inCluster==true) {
          // set input cluster edges
          for (var pinname in node.inputPins) {
            if (node.inputPins[pinname].links.length==0 || !node.inputPins[pinname].links[0].fromPin.node.inCluster)
              node.inputPins[pinname].clusterEdge = true;
            else
              node.inputPins[pinname].clusterEdge = false;
          }
          // initially assume all output pins of a cluster node are edge pins. might be reset in higher-stack invocation
          for (var pinname in node.outputPins) {
              node.outputPins[pinname].clusterEdge = true;
              node.outputPins[pinname].edgeLinkCount = node.outputPins[pinname].links.length;
          }
        }
      }
      for (var i=0; i<patch.nodeList.length; i++) {
        patch.nodeList[i].inCluster = false;
      }
      for (var i=0; i<patch.nodeList.length; i++) {
        if (patch.nodeList[i].environments && patch.nodeList[i].environments[0]=="nodejs") {
          if (!patch.nodeList[i].inCluster) // the node would have been marked as cluster node if it had already been visited
            findCluster(patch.nodeList[i], true);
        }
      }
      this.clear();
      for (var i=0; i<patch.nodeList.length; i++) {
        if (patch.nodeList[i].inCluster) {
          this.addNode(patch.nodeList[i]);
        }
      }
    }

    this.clear = function() {
      this.clusterEdgeNodes = {};
      this.inputEdgePins = {};
      this.outputEdgePins = {};
      this.hasNodes = false;
    }

    this.addNode = function(node) {
      this.hasNodes = true;
      var edgeNode = false;
      this.inputEdgePins[node.id] = [];
      for (var pinname in node.inputPins) {
        if (node.inputPins[pinname].clusterEdge) {
          this.inputEdgePins[node.id].push(node.inputPins[pinname]);
          edgeNode = true;
        }
      }
      this.outputEdgePins[node.id] = [];
      for (var pinname in node.outputPins) {
        if (node.outputPins[pinname].clusterEdge) {
          this.outputEdgePins[node.id].push(node.outputPins[pinname]);
          edgeNode = true;
        }
      }
      if (edgeNode)
        this.clusterEdgeNodes[node.id] = node;
    }

    this.syncPinValues = function(socket, direction) {
      var nodes = [];
      var edgePins = null;
      if (VVVVContext.name=='browser')
        edgePins = this.inputEdgePins;
      else
        edgePins = this.outputEdgePins;
      for (var node_id in edgePins) {
        var pinValues = {};
        var i=edgePins[node_id].length;
        var changedPins = 0;
        while (i--) {
          if (edgePins[node_id][i].pinIsChanged()) {
            pinValues[edgePins[node_id][i].pinname] = edgePins[node_id][i].values;
            changedPins++;
          }
        }
        if (changedPins>0)
          nodes.push({node_id: node_id, pinValues: pinValues});
      }
      if (nodes.length==0)
        return;
      var msg = {patch: patch.getPatchIdentifier(), nodes: nodes};
      console.log(JSON.stringify(msg));
      if (socket.readyState==socket.OPEN)
        socket.send(JSON.stringify(msg));
    }


  }

  return Cluster;
});