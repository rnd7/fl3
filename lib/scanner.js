'use strict';

// native
const events = require('events');
const spawn = require('child_process').spawn;
const EventEmitter = events.EventEmitter;

// external
const ipUtil = require('ip');
const cheerio = require('cheerio');
const _ = require('underscore');

// lib fl3
const LiveXML = require('./livexml.js').LiveXML

/**
* Port Scanner utilizing NMAP
*/
var Scanner = function(opts){
  if(!(this instanceof Scanner)) return new Scanner(opts);
  var t = _.extend(
    this,
    {
      running: true,
      maxParallel: 0xFF, // --max-parallelism
      statInterval: 10, // --stats-every in ms
      verbosity: 4, // -v
      brutality: 4, // -T
      taskTimeout: 120,
      binary: 'nmap'
    },
    opts
  )
  t.processing = false;
  t.queue = []
  t.db = {};
  t.task = "idle";
  t.percentComplete = "0.00";
  function manageTasks(){
    if(
      t.running &&
      t.queue.length &&
      !t.processing
    ){
      var opts = t.queue.shift()
      t.processing = true;
      t.emit(Scanner.TASK);
      t._scan(opts)
    }else if(t.queue.length == 0){
      t.emit(Scanner.COMPLETE);
    }
  }

  t.on(Scanner.START, manageTasks);
  t.on(Scanner.ADD_ENTRY_POINT, manageTasks)
  t.on(Scanner.ADD_TO_QUEUE, manageTasks);
  t.on(Scanner.SCAN_COMPLETE, ()=>{
    t.processing = false;
    t.emit(Scanner.TASK_COMPLETE);
    manageTasks()
  })

  manageTasks();

  return t;
}
// Ports
Scanner.COMMON_PORTS = [
  1,4,5,7,18,20,21,22,23,25,29,37,42,43,49,53,69,70,79,80,81,103,108,109,110,
  111,113,115,118,119,135,137,138,139,143,150,156,161,179,190,194,197,389,396,
  443,444,445,458,546,547,563,569,587,902,1002,1024,1025,1026,1027,1028,1029,
  1050,1080,1158,1433,1434,1503,1512,1521,1583,1630,1723,1801,1812,1813,1821,
  1863,2375,2376,3050,3306,3351,3389,3938,4444,4567,5000,5060,5353,5355,5432,
  5520,5540,5560,5580,5600,5620,5640,5660,5678,5984,5985,7676,8000,8080,8081,
  8082,10000,11000,18067,20370,27017,27018,27019,27374,28017,28960,29900,29901,
  30005,30722,32768,49152,49153,49154,49155,49895,49896,49897,56789,61000
];
// Events
Scanner.ADD_TASK = "addTask";
Scanner.START = "start";
Scanner.STOP = "stop";
Scanner.ADD_TO_QUEUE = "addToQueue";
Scanner.SCAN = "scan";
Scanner.SCAN_COMPLETE = "scanComplete";
Scanner.TASK = "task";
Scanner.TASK_COMPLETE = "taskComplete";
Scanner.COMPLETE = "complete";
Scanner.STATUS = "status";
Scanner.ERROR = "error";
_.extend(
  Scanner.prototype.__proto__,
  EventEmitter.prototype
)
_.extend(
  Scanner.prototype,
  {
    addTask(opts){
      var t = this;
      t._addToQueue(opts);
      t.emit(Scanner.ADD_TASK)
    },
    start(){
      var t = this;
      t.running = true;
      t.emit(Scanner.START);
    },
    stop(){
      var t = this;
      t.running = false;
      t.emit(Scanner.STOP);
    },
    _addToQueue(opts){
      var t = this;
      t.queue.push(opts)
      t.emit(Scanner.ADD_TO_QUEUE)
    },
    _scan(opts){
      var t = this
      var lxml = new LiveXML();
      var currentHost;
      var currentPort
      lxml.on(LiveXML.ELEMENT, (elem)=>{
        if(
          elem.type === LiveXML.OPEN &&
          elem.path === "nmaprun/host"
        ){
          currentHost = {port:{}};
        }
        if(
          elem.type === LiveXML.EMPTY &&
          elem.path === "nmaprun/host/status"
        ){
          var $elem = cheerio.load(elem.raw)
          var el = $elem.root().children().first();
          currentHost.up = el.attr("state") === "up";
        }
        if(
          elem.type === LiveXML.EMPTY &&
          elem.path === "nmaprun/host/address"
        ){
          var $elem = cheerio.load(elem.raw)
          currentHost.ip = $elem.root().children().first().attr("addr");
        }
        if(
          elem.type === LiveXML.CLOSE &&
          elem.path === "nmaprun/host"
        ){
          t.db[currentHost.ip] = currentHost;
        }

        if(
          elem.type === LiveXML.OPEN &&
          elem.path === "nmaprun/host/ports/port"
        ){
          currentPort = {}
          var $elem = cheerio.load(elem.raw);
          var el = $elem.root().children().first();
          currentPort.id = parseInt(el.attr("portid"))
        }
        if(
          elem.type === LiveXML.EMPTY &&
          elem.path === "nmaprun/host/ports/port/state"
        ){
          var $elem = cheerio.load(elem.raw);
          var el = $elem.root().children().first()
          currentPort.open = el.attr("state") === "open";
        }
        if(
          elem.type === LiveXML.EMPTY &&
          elem.path === "nmaprun/host/ports/port/service"
        ){
          var $elem = cheerio.load(elem.raw)
          currentPort.name = $elem.root().children().first().attr("name");
        }
        if(
          elem.type === LiveXML.CLOSE &&
          elem.path === "nmaprun/host/ports/port"
        ){
          currentHost.port[currentPort.id.toString()] = currentPort;
        }

        if(elem.type === LiveXML.EMPTY || elem.type === LiveXML.OPEN){
          if(elem.path === "nmaprun/taskbegin"){
            var $elem = cheerio.load(elem.raw)
            t.task = $elem.root().children().first().attr("task");
            t.percentComplete = "0.00";
            t.emit(Scanner.STATUS)
          }
          if(elem.path === "nmaprun/taskprogress"){
            var $elem = cheerio.load(elem.raw)
            var el = $elem.root().children().first()
            t.task = el.attr("task");
            t.percentComplete =  el.attr("percent");
            t.emit(Scanner.STATUS)
          }
          if(elem.path === "nmaprun/taskend"){
            var $elem = cheerio.load(elem.raw)
            t.task = $elem.root().children().first().attr("task");
            t.percentComplete = "100.00";
            t.emit(Scanner.STATUS)
          }
        }
      })

      var nmap = spawn(
        t.binary,
        [
          opts.range,
          "-p"+opts.ports,
          "-v"+t.verbosity,
          "-T"+t.brutality,
          "--max-parallelism",
          t.maxParallel.toString(),
          "--stats-every",
          t.statInterval+"ms",
          "-oX",
          "-"
        ]
      )

      nmap.stdout.on('data', (data) => {
        lxml.append(data.toString())
      });

      nmap.stdout.on('end', (data) => {
       // console.log("stdout end");
      });

      nmap.stderr.on('data', (data) => {
        t.emit(Scanner.ERROR, data);
      });

      nmap.on('close', (code)=>{
        t.emit(Scanner.SCAN_COMPLETE);
        if (code !== 0) t.emit(Scanner.ERROR, code);
      });

      t.emit(Scanner.SCAN);
    },
  }
)

module.exports = {
  Scanner: Scanner,
};
