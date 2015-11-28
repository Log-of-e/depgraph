// Filename: depgraph_node.js  
// Timestamp: 2015.11.27-23:54:27 (last modified)
// Author(s): bumblehead <chris@bumblehead.com>

var fs = require('fs'),
    path = require('path'),
    fnguard = require('fnguard'),
    detective = require('detective'),    
    immutable = require('immutable'),
    resolveuid = require('resolveuid'),
    resolvewith = require('resolvewith'),
    
    depgraph_edge = require('./depgraph_edge');

var depgraph_node = module.exports = (function (o) {

  // 'in'  are dependents
  // 'out' are dependencies
  //
  // nodes with 'in' degree of 0 are tree root nodes
  o.get = function (filepath, filecontent) {
    return immutable.Map({
      content   : filecontent,
      filepath  : filepath,
      uid       : resolveuid(filepath),
      inarr     : immutable.List(),
      outarr    : immutable.List()
    });
  };

  o.get_fromfilepath = function (filepath, fn) {
    fnguard.isstr(filepath).isfn(fn);

    filepath = path.resolve(filepath);
    fs.readFile(filepath, 'utf-8', function (err, filestr) {
      err ? fn(err) : fn(null, o.get(filepath, filestr));
    });      
  };

  o.setedge = function (node, uid, refname, edgename) {
    var edge = depgraph_edge.get(refname, uid);

    return node.set(edgename, node.get(edgename).filter(function (inedge) {
      return depgraph_edge.issamenot(edge, inedge);
    }).push(edge));
  };
  
  o.setedgein = function (node, uid, refname) {
    return o.setedge(node, uid, refname, 'inarr');
  };

  o.setedgeout = function (node, uid, refname) {
    return o.setedge(node, uid, refname, 'outarr');
  };

  // walks node childs
  o.walk = function (node, accumstart, onnodefn, oncompletefn, deparr) {
    deparr = deparr || detective(node.get("content"));

    if (deparr.length && // coremodule ignored
        !resolvewith.iscoremodule(deparr[0])) {

      o.get_fromfilepath(resolvewith(deparr[0], node.get("filepath")), function (err, depnode) {
        if (err) return oncompletefn(err);

        onnodefn(depnode, accumstart,  node, deparr[0], function (err, accum) {
          o.walk(node, accum, onnodefn, oncompletefn, deparr.slice(1));
        });
      });
    } else {
      oncompletefn(null, accumstart);
    }
  };
  
  // walks node childs, recursive
  o.walkrecursive = function (node, accumstart, iswalkcontinuefn, accumfn, accumcompletefn) {
    o.walk(node, accumstart, function onnodefn (node, accumstart, pnode, refname, nextfn) {    
      var accum = accumfn(accumstart, node, pnode, refname);

      if (iswalkcontinuefn(accumstart, node, pnode, refname)) {
        o.walkrecursive(node, accum, iswalkcontinuefn, accumfn, nextfn);
      } else {
        nextfn(null, accum);
      }
    }, accumcompletefn);
  };

  o.walkbegin = function (node, accumstart, iswalkcontinuefn, accumfn, accumcompletefn) {
    var accum = accumfn(accumstart, node, null);
    
    o.walkrecursive(node, accum, iswalkcontinuefn, accumfn, accumcompletefn);
  };

  o.walkbeginfile = function (filepath, accum, iswalkcontinuefn, accumfn, accumcompletefn) {
    o.get_fromfilepath(filepath, function (err, node) {
      if (err) return accumcompletefn(err);

      return o.walkbegin(node, accum, iswalkcontinuefn, accumfn, accumcompletefn);
    });
  };
  
  return o;
  
}({}));