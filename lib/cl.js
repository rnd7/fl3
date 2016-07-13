'use strict';         

// native
const fs = require('fs');

// external
const _ = require('underscore');
const chalk = require('chalk');

// lib fl3
const sutil = require('./sutil.js');

const CLAIM = require('./cl/claim.json');

var _status = false;
  
function hideCursor(){   
  process.stdout.write("\x1B[?25l");
}

function showCursor(){  
  process.stdout.write("\x1B[?25h")
}

function clearLine(){
  process.stdout.write("\x1B[K")  
}

function previousLine(){
  process.stdout.write("\x1B[F")  
}

function resetCursor(){  
  process.stdout.write("\x1B[0G")
}

function newLine(){  
  process.stdout.write("\n")
}

function statusEnd(){
  if(_status){
    resetCursor()
    clearLine()
  }
  _status=false;
}

function statusBegin(){  
  if(_status){    
    resetCursor()
    clearLine()
  }
  _status=true;
}

function claim(){
  process.stdout.write(
    chalk.bold.white.bgBlue(sutil.wrap("[fl3]"))+
    chalk.inverse(" "+_.sample(CLAIM,1)+" ")  
  );
}

function logo(){
  claim();
  newLine();
}

function cmd(cmd, opts){
  statusEnd();
  process.stdout.write(
    chalk.white.bold.bgBlue(sutil.wrap(cmd))+
    chalk.grey.bgBlack(sutil.wrap(sutil.serialize(opts)))
  )
  newLine()
}  

function status(status, opts){
  statusBegin()
  process.stdout.write(
    chalk.bold.white.bgCyan(sutil.wrap(status))+
    chalk.cyan.bgBlack(sutil.wrap(sutil.serialize(opts)))
  )
}

function result(data){  
  statusEnd()
  process.stdout.write(        
    chalk.cyan(sutil.serialize(data))
  )
  newLine()
}

function message(m){  
  statusEnd()
  process.stdout.write(        
    chalk.blue(m)
  )
  newLine()
}

function error(e){  
  statusEnd()
  process.stdout.write(
    chalk.bold.white.bgRed(sutil.wrap("error"))+
    chalk.cyan.bgBlack(sutil.wrap(sutil.serialize(e)))  
  );
  newLine()
}

function done(status){  
  statusEnd()
  process.stdout.write(        
    chalk.bold.white.bgBlue(" done ")+
    chalk.cyan.bgBlack(sutil.wrap(status))
  )
  newLine()
}

function writeToFile(file, data, complete){
  status("Writing result to: "+file);
  fs.writeFile(file, JSON.stringify(data, null, 2), (e)=>{
    if(e) return console.log(e);
    status("Wrote result to: "+file);
    if(complete) complete();
  });
}

function init(){
  hideCursor();
  logo();
  process.on('SIGTERM', ()=>{
    process.exit(0);
  });
  process.on('SIGINT', ()=>{
    process.exit(0);
  });
  process.on("exit", ()=>{
    statusEnd()
    showCursor()
  })
}

module.exports = {
  init: init,
  logo: logo,
  claim: claim,
  cmd: cmd,
  status: status,
  message: message,
  error: error,
  result: result,
  done: done,
  newLine: newLine,
  clearLine: clearLine,
  previousLine: previousLine,
  showCursor: showCursor,
  hideCursor: hideCursor,
  resetCursor: resetCursor,
  writeToFile: writeToFile
};
