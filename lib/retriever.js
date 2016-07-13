'use strict';

// native
const events = require('events');
const EventEmitter = events.EventEmitter;
const http = require('http');
const https = require('https');
const fs = require('fs');
const urlUtil = require('url');
const path = require('path');
const mkdirp = require('mkdirp');
const homedir = require('homedir');

// external
const cheerio = require('cheerio');
const _ = require('underscore');

// lib fl3
const Crawler = require('./crawler.js').Crawler;

/**
* Retriever
* Automated File Download Agent
*/
var Retriever = function(opts){
  if(!(this instanceof Retriever)) return new Retriever(opts);
  var t = _.extend(
    this,
    {
      running: true,
      maxDistance: 5,
      lockHost:false,
      limit:1e5,
      maxThreads: 10,
      maxDownloads: 10,
      downloadDirectory: Retriever.DEFAULT_DOWNLOAD_DIRECTORY,
      filter: /.*/,
      timeout: 60000,
    },
    opts
  )
  t.db = {};
  t.queue = [];
  t.downloads = 0;
  t.crawlerComplete = false;

  t.crawler = new Crawler(
    _.pick(t, "running", "maxDistance","lockHost","limit","maxThreads")
  );

  function onFile(file){
    t.addFile(file)
  }
  t.crawler.on(Crawler.AUDIO, onFile)
  t.crawler.on(Crawler.VIDEO, onFile)
  t.crawler.on(Crawler.IMG, onFile)
  t.crawler.on(Crawler.COMPLETE, ()=>{
    t.crawlerComplete = true;
    manageQueue();
  })
  t.crawler.on(Crawler.TASK, ()=>{
    t.crawlerComplete = false;
  })

  function manageQueue(){
    while(
      t.running &&
      t.queue.length &&
      t.downloads < t.maxDownloads
    ){
      var url = t.queue.shift()
      t.downloads++;
      t.emit(Retriever.TASK);
      t.download(url)
    }
    if(t.downloads == 0 && t.crawlerComplete) t.emit(Retriever.COMPLETE);
  }

  t.on(Retriever.ADD_TO_QUEUE, manageQueue)

  t.on(Retriever.DOWNLOAD_COMPLETE, ()=>{
    t.downloads--
    t.emit(Retriever.TASK_COMPLETE);
    manageQueue()
  })
  return t;
}
Retriever.DEFAULT_DOWNLOAD_DIRECTORY = path.join(homedir(),"/fl3/retriever/");
// Events
Retriever.ADD_ENTRY_POINT = "addEntryPoint";
Retriever.START = "start";
Retriever.STOP = "stop";
Retriever.ADD_TO_QUEUE = "addToQueue";
Retriever.TASK = "task";
Retriever.TASK_COMPLETE = "taskComplete";
Retriever.DOWNLOAD = "download";
Retriever.DOWNLOAD_COMPLETE = "downloadComplete";
Retriever.COMPLETE = "complete";
Retriever.ERROR = "error";
_.extend(
  Retriever.prototype.__proto__,
  EventEmitter.prototype
)
_.extend(
  Retriever.prototype,
  {
    addEntryPoint(url){
      var t = this;
      t.crawler.addEntryPoint(url);
      t.emit(Retriever.ADD_ENTRY_POINT)
    },
    start(){
      var t = this;
      t.running = true;
      t.crawler.start();
      t.emit(Retriever.START);
    },
    stop(){
      var t = this;
      t.running = false;
      t.crawler.stop();
      t.emit(Retriever.STOP);
    },
    addFile(url){
      var t = this;
      if(!_.has(t.db,url) && t.filter.test(url)){
        t.db[url] = {
          url: url,
          retrieved: false,
        }
        t.queue.push(url);
        t.emit(Retriever.ADD_TO_QUEUE);
      }
    },
    makeFilename(url){
      var urlObj = urlUtil.parse(url);
      var str = (urlObj.protocol)?urlObj.protocol+"//":"";
      str += urlObj.host || urlObj.hostname || "";
      str += urlObj.pathname || urlObj.path || "";
      str = encodeURIComponent(str).replace(/'/g,"%27").replace(/"/g,"%22");
      return str;
    },
    makePath(url){
      var t = this;
      var filename = t.makeFilename(url);
      var p = path.join(t.downloadDirectory, filename)
      return p;
    },
    download(url){
      var t = this;
      t.emit(Retriever.DOWNLOAD);
      var opts = _.extend(urlUtil.parse(url))
      t.db[opts.href].startTime = Date.now();
      var getter = (opts.protocol==="http:")?http.get:https.get;
      var dest = t.makePath(url);
      mkdirp.sync(path.dirname(dest));
      var req = getter(
        opts,
        (res)=>{
          t.db[opts.href].responseTime = Date.now();
          t.db[opts.href].filepath = dest
          if(res.statusCode === 200) {
            var file = fs.createWriteStream(dest);
            file.on('finish', ()=>{
              //console.log("file finish");
            });
            file.on('error', (e)=>{
              fs.unlink(dest);
              t.emit(Retriever.ERROR, e)
              t.emit(Retriever.DOWNLOAD_COMPLETE);
            });
            res.pipe(file);
          }
          req.setTimeout(t.timeout, ()=>{
            t.emit(Retriever.ERROR, "timeout")
            req.abort();
          });
          res.on('end', ()=>{
            t.db[opts.href].endTime = Date.now();
            t.db[opts.href].retrieved = true;
            t.emit(Retriever.DOWNLOAD_COMPLETE);
          })
        }
      )
      req.on('error', (e)=>{
        fs.unlink(dest)
        t.db[opts.href].error = e.message;
        t.emit(Retriever.ERROR, e)
        t.emit(Retriever.DOWNLOAD_COMPLETE);
      });
    },
  }
)

module.exports = {
  Retriever: Retriever,
};
