'use strict';


// native
const url = require('url');
const fs = require('fs');

// external
const _ = require('underscore');
const moment = require("moment");

// lib fl3
const cl = require('./cl.js');
const localIp = require('./resolve.js').localIp;
const mac = require('./resolve.js').mac;
const publicIp = require('./resolve.js').publicIp;
const whois = require('./resolve.js').whois;
const lookup = require('./resolve.js').lookup;
const reverseLookup = require('./resolve.js').reverseLookup;
const Scanner = require('./scanner.js').Scanner;
const Crawler = require('./crawler.js').Crawler;
const Swarm = require('./swarm.js').Swarm;
const Retriever = require('./retriever.js').Retriever;

module.exports = {
  init(){
    cl.init()
  },
  mac(){
    cl.cmd("mac");
    mac((e,r)=>{
      if(e){
        cl.error(e);
      }else{
        cl.result(r);
        cl.done();
      }
    })
  },
  localIp(){
    cl.cmd("localIp");
    var ips = localIp()
    _.each(ips, (ip)=>{
      cl.result(ip);
      cl.done();
    })
  },
  publicIp(){
    cl.cmd("publicIp");
    publicIp((val)=>{
      cl.result(val);
      cl.done();
    })
  },
  resolve(domain){
    cl.cmd("resolve",{domain:domain});
    cl.status("dns lookup");
    lookup(domain, function (err, addresses) {
      if (err) cl.error(err);
      cl.message("dns lookup");
      cl.result(addresses);
      cl.message("reverse dns");
      cl.status("reverse dns lookup");
      addresses.forEach(function (a) {
        reverseLookup(a, function (err, domains) {
          if(err){
            cl.error(err);
          }else{
            cl.result(domains);
          }
          cl.done();
        });
      });
    });
  },
  whois(ipAddress){
    cl.cmd("whois",ipAddress);
    whois(ipAddress, (result)=>{
      cl.result(result);
      cl.done();
    })
  },
  crawl(url, options){
    cl.cmd("crawl",{url:url});
    var crawler = new Crawler(
      {
        maxDistance: options.distance,
        lockHost: !options.global,
        limit: options.limit,
        maxThreads: options.threads
      }
    );
    crawler.addEntryPoint(url)
    function updateStatus(){
      cl.status(
        "crawling",
        {
          queued:crawler.queue.length,
          threads:crawler.threads,
          count:crawler.count
        }
      )
    }
    crawler.on(Crawler.TASK, updateStatus);
    crawler.on(Crawler.TASK_COMPLETE, updateStatus);
    crawler.on(Crawler.ADD_TO_QUEUE, updateStatus);
    crawler.on(Crawler.COMPLETE, ()=>{
      if(options.output){
        cl.writeToFile(options.output, crawler.db, cl.done)
      }else{
        cl.result(JSON.stringify(crawler.db, null, 2));
        cl.done();
      }
    });
  },
  swarm(url, options){
    cl.cmd("Swarm",{url:url});
    var swarm = new Swarm(
      {
        maxDistance: options.distance,
        lockHost: !options.global,
        limit: options.limit,
        maxThreads: options.threads
      }
    );
    swarm.addEntryPoint(url)
  },
  retrieve(url, options){
    cl.cmd("retrieve",{url:url});
    var retriever = new Retriever(
      {
        maxDistance: options.distance,
        lockHost: !options.global,
        limit: options.limit,
        maxThreads: options.threads,
        maxDownloads: options.parallel,
        downloadDirectory: options.directory || Retriever.DEFAULT_DOWNLOAD_DIRECTORY,
        timeout: options.timeout,
        filter: options.filter
      }
    );
    retriever.addEntryPoint(url)
    function updateStatus(){
      cl.status(
        "retrieving",
        {
          crawlerQueued:retriever.crawler.queue.length,
          crawlerThreads:retriever.crawler.threads,
          retrieverQueued: retriever.queue.length,
          retrieverDownloads: retriever.downloads,
        }
      )
    }
    retriever.crawler.on(Crawler.TASK, updateStatus);
    retriever.crawler.on(Crawler.TASK_COMPLETE, updateStatus);
    retriever.crawler.on(Crawler.ADD_TO_QUEUE, updateStatus);
    retriever.on(Retriever.TASK, updateStatus);
    retriever.on(Retriever.TASK_COMPLETE, updateStatus);
    retriever.on(Retriever.ADD_TO_QUEUE, updateStatus);
    retriever.on(Retriever.COMPLETE, ()=>{
      if(options.output){
        cl.writeToFile(options.output, retriever.db, cl.done)
      }else{
        cl.message("File Database")
        cl.result(JSON.stringify(retriever.db, null, 2));
        cl.done();
      }
    });

  },
  /*
    [1fff:0:a88:85a3::ac1f]:8001
    192.168.1.1-150:80-100
    192.168.1.155
    185.152.1.25/24:1-1024,12222
    -p 80,1100-2200
  */
  scan(tasks, options){
    cl.cmd("scan");
    if(!tasks || !tasks.length){
      tasks = [_.map(
        localIp(),
        (x)=>{return x+"/24";}
      ).join(",")]
      cl.message("Using local IP Addresses")
      cl.result(tasks);
    }

    var taskArr = _.map(tasks, (x)=>{
      var portMatch = x.match(/(:[0-9-,]+)?$/i)
      var ports = []
      if(portMatch[1]){
        //console.log(portMatch);
        x = x.substring(0,portMatch.index)
        ports = portMatch[1].substring(1,portMatch[1].length).split(",")
      }
      return {
        hosts: x,
        ports: ports
      }
    })
    var scanner = new Scanner({
      maxParallel: options.threads,
      taskTimeout: options.timeout,
      brutality: options.brutality
    });
    function updateStatus(){
      cl.status(
        "scanning",
        {
          queued:scanner.queue.length,
          progress:scanner.percentComplete,
          task:scanner.task,
        }
      )
    }
    scanner.on(Scanner.TASK, updateStatus);
    scanner.on(Scanner.TASK_COMPLETE, updateStatus);
    scanner.on(Scanner.ADD_TO_QUEUE, updateStatus);
    scanner.on(Scanner.STATUS, updateStatus);
    scanner.on(Scanner.COMPLETE, ()=>{
      if(options.output){
        cl.writeToFile(options.output, scanner.db, cl.done)
      }else{
        cl.message("Scan Result")
        cl.result(JSON.stringify(scanner.db, null, 2));
        cl.done();
      }
    });
    _.each(taskArr, (task)=>{
      if(options.commonPorts){
        task.ports = _.uniq(task.ports.concat(Scanner.COMMON_PORTS))
      }
      if(options.ports) task.ports = _.uniq(task.ports.concat(options.ports))
      if(!task.ports.length) task.ports.push(0);
      scanner.addTask({range:task.hosts, ports:task.ports})
    })

  },
  claim(options){
    function repeat(){
      cl.previousLine();
      cl.resetCursor();
      cl.clearLine();
      cl.logo();
      setTimeout(repeat, options.interval || 150)
    }
    repeat()
  },
  error(){
    cl.error("Unknown Command. Hack in fl3 --help for all available super powers.");
  }
}
