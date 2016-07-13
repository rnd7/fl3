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
var botid = 0;
var Bot = function(opts){
  if(!(this instanceof Bot)) return new Bot(opts);
  console.log("new bot")
  var t = _.extend(
    this,
    {
      running: true,
      userAgent: "obotobot",
      language: "en",
      currentUrl: null,
      crawler: null,
      crawlerComplete: false,
      history: [],
      backPropability: 0.2,
      minDelay: 500,
      maxDelay: 5000,
      timeout: 60000,
      historyLimit: 64,
    },
    opts
  )
  t.id = botid++;
  t.loading = false
  t.waiting = false
  t.bytesDownloaded = 0;

  t.crawler.on(Crawler.COMPLETE, ()=>{
    console.log("crawler complete")
    t.crawlerComplete = true;
    next();
  })
  t.crawler.on(Crawler.TASK, ()=>{
    t.crawlerComplete = false;
    //next();
  })
  t.crawler.on(Crawler.TASK_COMPLETE, ()=>{
    console.log("crawler task complete")

  })

  t.on(Bot.LOAD, ()=>{
    t.loading = true;
  })

  t.on(Bot.LOAD_COMPLETE, ()=>{
    t.loading = false;
    next();
  })

  var next = function(){
    if(t.loading || t.waiting) return
    console.log("next", t.id)
    if(t.history.length > 1 && Math.random() <= t.backPropability){
      t.history.pop();
      t.currentUrl = t.history.pop();
    }else{
      if(!t.currentUrl){
        var entryPoint = _.sample(_.where(t.crawler.db, {entryPoint:true}))
        if(entryPoint) t.currentUrl = entryPoint.url
      }else if(t.crawler.db[t.currentUrl].target.length){
        t.currentUrl = _.sample(t.crawler.db[t.currentUrl].target)
      }else if(t.history.length > 1){
        t.history.pop();
        t.currentUrl = t.history.pop();
      }
    }
    if(t.currentUrl){
      var d = t.minDelay + Math.floor(Math.random()*(t.maxDelay - t.minDelay));
      if(_.last(t.history) !== t.currentUrl) t.history.push(t.currentUrl)
      t.history = _.last(t.history, t.historyLimit)
      t.waiting = true;
      setTimeout(()=>{t.waiting = false;t.load()}, d)
    }
  }
  next();
  return t;
}
// Events
Bot.START = "start";
Bot.STOP = "stop";
Bot.ERROR = "error";
Bot.LOAD = "load";
Bot.LOAD_COMPLETE = "loadComplete"
_.extend(
  Bot.prototype.__proto__,
  EventEmitter.prototype,
  {
    start(){
      var t = this;
      t.running = true;
      t.emit(Bot.START);
    },
    stop(){
      t.running = false;
      t.emit(Bot.STOP);
    },
    _dumpLoad(url, complete){
      var t = this;
      var urlObj = urlUtil.parse(url)
      urlObj.agent = false
      var getter = (urlObj.protocol==="http:")?http.get:https.get;
      var response;
      /*var agent = new http.Agent();
      agent.maxSockets = 1;*/
      var req = getter(
        urlObj,
        (res)=>{
          response = res
          req.setTimeout(t.timeout, ()=>{
            t.emit(Bot.ERROR, "timeout")
            req.abort();
          });
          res.on('data', (chunk)=>{
            t.bytesDownloaded += chunk.length
            //console.log("bytes",t.bytesDownloaded,t.id)
            //console.log("response data")
          })
          res.on('end', ()=>{
            //console.log("response end")
            complete();
          })
          res.on('finish', ()=>{
            //console.log("response finish")
            complete();
          })
          res.on('error', (e)=>{
            //console.log("response error",e)
            complete();
          })
        }
      )
      req.on("socket", function (socket) {
        //console.log("new socket created");
        socket.on("close", function() {
            //console.log("socket has been closed");
        });
      })
      req.on('error', (e)=>{
        //console.log("req error",e)
        req.abort();
        if(response) response.end()
        t.emit(Bot.ERROR, e)
        complete();
      });
      req.end();
    },
    load(){
      var t = this;
      //console.log("load", t.currentUrl)
      t.emit(Bot.LOAD);
      var complete = function(){
        t.emit(Bot.LOAD_COMPLETE)
      }
      t._dumpLoad(t.currentUrl+"?id="+t.id, ()=>{
        var ds = t.crawler.db[t.currentUrl];
        var urls = [].concat(ds.script, ds.img, ds.audio, ds.video, ds.link);
        if(urls.length){
          var cb = _.after(urls.length, ()=>{complete()})
          _.each(urls, (url)=>{
            t._dumpLoad(url, cb)
          })
        }else{
          complete()
        }
      })
    }
  }
)
/**
* Swarm
*/
var Swarm = function(opts){
  if(!(this instanceof Swarm)) return new Swarm(opts);
  var t = _.extend(
    this,
    {
      running: true,
      maxDistance: 5,
      lockHost:false,
      limit:1e5,
      maxThreads: 10,
      maxBots: 128,
    },
    opts
  )
  t.db = {};
  t.crawlerComplete = false;

  t.crawler = new Crawler(
    _.pick(t, "running", "maxDistance","lockHost","limit","maxThreads")
  );

  t.bots = [];
  function manageBots(){
    while(t.bots.length > t.maxBots) t.bots.pop().stop();
    while(t.bots.length < t.maxBots) t.bots.push(new Bot({crawler:t.crawler}));
    _.each(t.bots, (b)=>{
      b.running = t.running
    
    })
  }
  https.globalAgent.maxSockets = 64;
  http.globalAgent.maxSockets = 64;
  t.on(Swarm.START, manageBots)
  t.on(Swarm.STOP, manageBots)
  if(t.running) manageBots()

  return t;
}
// Events
Swarm.START = "start";
Swarm.STOP = "stop";
Swarm.ERROR = "error";
_.extend(
  Swarm.prototype.__proto__,
  EventEmitter.prototype
)
_.extend(
  Swarm.prototype,
  {
    start(){
      var t = this;
      t.running = true;
      t.crawler.start();
      t.emit(Swarm.START);
    },
    stop(){
      var t = this;
      t.running = false;
      t.crawler.stop();
      t.emit(Swarm.STOP);
    },
    addEntryPoint(url){
      var t = this;
      t.crawler.addEntryPoint(url);
    }
  }
)

module.exports = {
  Swarm: Swarm,
};
