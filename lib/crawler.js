'use strict';

// native
const http = require('http');
const https = require('https');
const urlUtil = require('url');
const events = require('events');
const EventEmitter = events.EventEmitter;

// external
const cheerio = require('cheerio');
const _ = require('underscore');

/**
* HTTP/S Webcrawler
*/
var Crawler = function(opts){
  if(!(this instanceof Crawler)) return new Crawler(opts);
  var t = _.extend(
    this,
    {
      running: true,
      maxDistance: 5,
      lockHost:false,
      limit:1e5,
      maxThreads: 10,
    },
    opts
  )
  t.count = 0;
  t.entry = [];
  t.db = {};
  t.queue = [];
  t.threads = 0;
  function manageTasks(){
    while(
      t.running &&
      t.queue.length &&
      t.threads < t.maxThreads &&
      t.count<t.limit
    ){
      var url = t.queue.shift()
      t.threads++;
      t.count++;
      t._upsert(url, {picked:true});
      t.emit(Crawler.TASK);
      t._fetch(url)
    }
    if(t.threads == 0) t.emit(Crawler.COMPLETE);
  }

  t.on(Crawler.START, manageTasks);
  t.on(Crawler.ADD_ENTRY_POINT, manageTasks)
  t.on(Crawler.ADD_TO_QUEUE, manageTasks);
  t.on(Crawler.FETCH_COMPLETE, ()=>{
    t.threads--
    t.emit(Crawler.TASK_COMPLETE);
    manageTasks()
  })

  manageTasks();

  return t;
}
// Events
Crawler.ADD_ENTRY_POINT = "addEntryPoint";
Crawler.ADD_TO_QUEUE = "addToQueue";
Crawler.START = "start";
Crawler.STOP = "stop";
Crawler.TASK = "task";
Crawler.TASK_COMPLETE = "taskComplete";
Crawler.FETCH = "fetch";
Crawler.FETCH_COMPLETE = "fetchComplete";
Crawler.COMPLETE = "complete";
Crawler.ERROR = "error";
Crawler.AUDIO = "audio";
Crawler.VIDEO = "video";
Crawler.IMG = "img";
_.extend(
  Crawler.prototype.__proto__,
  EventEmitter.prototype
)
_.extend(
  Crawler.prototype,
  {
    addEntryPoint(url){
      var t = this;
      if(!url.match(/^https?:\/\//i)) url = "http://"+url
      url = urlUtil.format(urlUtil.parse(url))
      t._upsert(url, {distance:0, entryPoint:true});
      t._addEntry(url);
      t._addToQueue(url);
      t.emit(Crawler.ADD_ENTRY_POINT)
    },
    start(){
      var t = this;
      t.running = true;
      t.emit(Crawler.START);
    },
    stop(){
      var t = this;
      t.running = false;
      t.emit(Crawler.STOP);
    },
    fetched(url){
      var t = this
      return (_.has(t.db,url) && t.db[url].fetched)
    },
    exists(url){
      var t = this;
      return _.has(t.db, url)
    },
    removeFragment(url){
      var purl = urlUtil.parse(url)
      purl.hash = "";
      return urlUtil.format(purl);
    },
    sameHost(a, b){
      return urlUtil.parse(a).host === urlUtil.parse(b).host;
    },
    _makeItem(url){
      return {
        url:url,
        fetched:false,
        picked:false,
        mailto:[],
        script:[],
        img:[],
        audio:[],
        video:[],
        link:[],
        origin:[],
        target:[],
        createdTime:Date.now()
      }
    },
    _upsert(url, data){
      var t = this;
      if(!t.exists(url)) t.db[url] = t._makeItem(url)
      if(data) t.db[url] = _.extend(t.db[url], data)
    },
    _addEntry(url){
      var t = this;
      if(t.entry.indexOf(url) == -1) t.entry.push(url)
    },
    _addPage(origin, target){
      var t = this;
      t._upsert(origin);
      t._upsert(target);
      if(t.db[origin].target.indexOf(target)==-1){
        t.db[origin].target.push(target);
      }
      if(t.db[target].origin.indexOf(origin)==-1){
        t.db[target].origin.push(origin);
      }
      t.db[origin].distance = t.db[origin].distance || 0;
      if(_.has(t.db[target], "distance")){
        t.db[target].distance = Math.min(
          t.db[target].distance,
          t.db[origin].distance+1
        );
      }else{
        t.db[target].distance = t.db[origin].distance+1;
      }
    },
    _addToQueue(url){
      var t = this;
      if(t.queue.indexOf(url) === -1 && (!t.exists(url) || !t.db[url].picked)){
        t.queue.push(url);
        t.emit(Crawler.ADD_TO_QUEUE);
      }
    },
    _addAnchor(url, a){
      if(!url || !a) return;
      var t = this;
      if(a.match(/^mailto:/i)){
        if(t.db[url].mailto.indexOf(a) == -1) t.db[url].mailto.push(a)
      }else{
        var link = urlUtil.resolve(url, a)
        link = t.removeFragment(link);
        if(link.match(/^https?:/i)){
          t._addPage(url, link)
          if(
            (!t.lockHost || t.sameHost(url, link)) &&
            t.db[link].distance <= t.maxDistance
          ) t._addToQueue(link);
        }
      }
    },
    _addScript(url, script){
      if(!url || !script) return;
      var t = this;
      var surl = t.removeFragment(urlUtil.resolve(url, script));
      if(t.db[url].script.indexOf(surl) == -1) t.db[url].script.push(surl);
    },
    _addLink(url, link){
      if(!url || !link) return;
      var t = this;
      var lurl = t.removeFragment(urlUtil.resolve(url, link));
      if(t.db[url].link.indexOf(lurl) == -1) t.db[url].link.push(lurl);
    },
    _addImg(url, img){
      if(!url || !img) return;
      var t = this;
      var iurl = t.removeFragment(urlUtil.resolve(url, img));
      if(t.db[url].img.indexOf(iurl) == -1) t.db[url].img.push(iurl);
      t.emit(Crawler.IMG, iurl);
    },
    _addVideo(url, video){
      if(!url || !video) return;
      var t = this;
      var vurl = t.removeFragment(urlUtil.resolve(url, video));
      if(t.db[url].video.indexOf(vurl) == -1) t.db[url].video.push(vurl);
      t.emit(Crawler.VIDEO, vurl);
    },
    _addAudio(url, audio){
      if(!url || !audio) return;
      var t = this;
      var aurl = t.removeFragment(urlUtil.resolve(url, audio));
      if(t.db[url].audio.indexOf(aurl) == -1) t.db[url].audio.push(aurl);
      t.emit(Crawler.AUDIO, aurl);
    },
    _extract(url, body){
      var t = this;
      t._upsert(url);
      var resources = [];
      try{
        var content = cheerio.load(body);
        content('a').each((idx,a)=>{
          t._addAnchor(url, a.attribs.href);
        });
        content("script").each((idx, script)=>{
          if(_.has(script.attribs, "src")){
            t._addScript(url, script.attribs.src);
          }else{
            //console.log("script", content(script).text())
          }
        });
        content("link").each((idx, link)=>{
          t._addLink(url, link.attribs.href);
        });
        content("img").each((idx, image)=>{
          t._addImg(url, image.attribs.src);
        });
        content("video > source").each((idx, video)=>{
          t._addVideo(url, video.attribs.src);
        });
        content("audio > source").each((idx, audio)=>{
          t._addAudio(url, audio.attribs.src);
        });
      }catch(e){
        t.emit(Crawler.ERROR, e)
      }
    },
    _fetch(url){
      console.log("fetch", url)
      var t = this;
      t.emit(Crawler.FETCH);
      var opts = _.extend(
        urlUtil.parse(url),
        {
          agent:false
        }
      )
      t._upsert(opts.href, {startTime: Date.now()});
      var getter = (opts.protocol==="http:")?http.get:https.get
      var req = getter(
        opts,
        (res)=>{
          t.db[opts.href].responseTime = Date.now();
          t.db[opts.href].statusCode = res.statusCode;
          if(_.has(res.headers,"server")){
            t.db[opts.href].server = res.headers.server;
          }
          if(_.has(res.headers,"date")) t.db[opts.href].date = res.headers.date;
          if(_.has(res.headers,"location") && res.headers.location !== opts.href){
            var loc = urlUtil.resolve(opts.href, res.headers.location)
              console.log("loc header",opts.href, res.headers.location, loc)
          //  console.log("loc", loc, t.db[loc])
            _.each(t.db[opts.href].origin, (o)=>{
              console.log("origin",o)
              t.db[o].target = _.without(t.db[o].target, opts.href)
              t._addPage(o, loc)
            })
            t._addPage(opts.href, loc)
            //t.db[opts.href] = null
            //delete t.db[opts.href]
            //console.log(t.db)
            if(!t.lockHost || t.sameHost(opts.href, loc)){
              t._fetch(loc);
            }
          }else{
            var body = "";
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', ()=>{
              t.db[opts.href].endTime = Date.now();
              t.db[opts.href].fetched = true;
              t._extract(opts.href, body);
              t.emit(Crawler.FETCH_COMPLETE);
            })
          }
        }
      )
      req.on('error', (e) => {
        t.db[opts.href].error = e.message;
        t.db[opts.href].errorTime = Date.now();
        t.emit(Crawler.ERROR, e)
        t.emit(Crawler.FETCH_COMPLETE);
      });
    },
  }
)

module.exports = {
  Crawler: Crawler
};
