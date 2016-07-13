'use strict';

const _ = require('underscore');
const events = require('events');
const EventEmitter = events.EventEmitter;

/* Tag names cannot contain any of the characters !"#$%&'()*+,/;<=>?@[\]^`{|}~, 
nor a space character, and cannot start with -, ., or a numeric digit */
const NAME_PATTERN = /^<[\/\?]?([^0-9.\-!"#$%&'()*+,/;<=>?@[\\\]\^`{|}~\s]+[^!"#$%&'()*+,/;<=>?@[\\\]\^`{|}~\s]*)/

/**
* Live XML Stream Parser 
*/
var LiveXML = function(opts){
  if(!(this instanceof LiveXML)) return new LiveXML(opts);
  var t = _.extend(
    this, 
    {
      accumulate:false
    },
    opts
  )
  t.input = "";
  t.buffer = [];  
  t.path = [];
  t.xml = "";
  function lexer(){
    var idx = 0;
    var inputLen = t.input.length;
    var scndLvlBuffer = "";
    var quot = false;
    var comment = false;
    var tag = false;
    while(idx<inputLen){
      var chr = t.input.charAt(idx);
      if(tag && !comment && chr === '"'){
        // while not wihtin comment block interprete quotes as escape seq
        scndLvlBuffer += chr
        quot = !quot // toggle quot
      }else if(!tag && !quot && !comment && chr === "<"){
        // open tag
        tag = true;
        if(scndLvlBuffer.length) t.buffer.push(scndLvlBuffer)
        scndLvlBuffer = chr
      }else if(tag && !quot && !comment && chr === ">"){     
        // close tag
        tag = false;
        scndLvlBuffer += chr
        t.buffer.push(scndLvlBuffer)
        scndLvlBuffer = ""          
      }else if(!quot && !comment && /^<!--/.test(scndLvlBuffer+chr)){
        // begin comment escape seq 
        comment=true
        scndLvlBuffer += chr
      }else if(comment && /-->$/.test(scndLvlBuffer+chr)){
        // end comment escape seq
        comment=false
        tag = false;
        t.buffer.push(scndLvlBuffer+chr)
        scndLvlBuffer = "";
      }else{                
        // just add chr to buffer
        scndLvlBuffer += chr 
      }
      idx++
    }
    if(t.accumulate) t.xml += t.input;
    t.input = "";
  }
  function parser(){
    while(t.buffer.length){        
      var lexeme = t.buffer.shift();
      var pathString = t.path.join("/")
      var elem = {raw: lexeme};
      if(/^<\?[\s\S]+\?>$/.test(lexeme)){
        elem.type = LiveXML.META
        var nameMatch = lexeme.match(NAME_PATTERN)        
        if(nameMatch) elem.name = nameMatch[1] 
        elem.path = t.path.join("/");
      }else if(/^<\!--[\s\S]+-->$/.test(lexeme)){
        elem.type = LiveXML.COMMENT
        elem.path = t.path.join("/");
      }else if(/^<[\s\S]+\/>$/.test(lexeme)){
        elem.type = LiveXML.EMPTY
        var nameMatch = lexeme.match(NAME_PATTERN)            
        if(nameMatch) elem.name = nameMatch[1] 
        elem.path = t.path.concat([elem.name]).join("/");
      }else if(/^<\/[\s\S]+>$/.test(lexeme)){
        elem.type = LiveXML.CLOSE
        var nameMatch = lexeme.match(NAME_PATTERN)            
        if(nameMatch) elem.name = nameMatch[1] 
        //if(nameMatch[1] !== _.last(path)) console.log("error: got "+nameMatch[1]+" expected "+ _.last(path))
        elem.path = t.path.join("/");
        t.path.pop()
      }else if(/^<[\s\S]+>$/.test(lexeme)){
        elem.type = LiveXML.OPEN;
        var nameMatch = lexeme.match(NAME_PATTERN)   
        if(nameMatch){
          elem.name = nameMatch[1] 
          t.path.push(nameMatch[1])
          elem.path = t.path.join("/");
        }
      }else{          
        elem.type = LiveXML.TEXT;
      }
      if(elem.name) elem.path 
      //console.log("elem\n", elem,"\n\n")
      t.emit(LiveXML.ELEMENT, elem)
    }        
  }
  t.on(LiveXML.APPEND,()=>{
    lexer();
    parser();
  })
  return t;
}
// Events
LiveXML.APPEND = "append";
LiveXML.RESET = "reset";
LiveXML.ELEMENT = "element";
// Element Types
LiveXML.META = "meta";
LiveXML.COMMENT = "comment";
LiveXML.EMPTY = "empty";
LiveXML.CLOSE = "close";
LiveXML.OPEN = "open";
LiveXML.TEXT = "text";
_.extend(
  LiveXML.prototype,
  new EventEmitter,
  {
    append(chunk){
      var t = this;
      t.input += chunk;
      t.emit(LiveXML.APPEND);
    },
    reset(){       
      var t = this;
      t.input = "";
      t.buffer = [];
      t.path = [];
      t.xml = "";
      t.emit(LiveXML.INPUT);
    }
  }
)
 
/**
* Check for valid tag closure
*/
function tagCloseTest(str){
  var idx = 0;
  var strLen = str.length
  var buffer = ""
  var count = 0;
  while(idx < strLen){
    buffer += str[idx];
    if(
      /^<[^<>\/]+\/>$/.test(buffer) ||  // selfclose  
      /^[^<>\/]+$/.test(buffer) || // text    
      /^<\?.+\?>$/.test(buffer) ||  // meta
      /^<\!--.+-->/.test(buffer)  // comment
    ){    
      buffer = "";
    }else if(/^(<[^<>\/]+>)/.test(buffer)){ // open
      count++
      buffer = "";
    }else if(/^(<\/[^<>\/]+>)$/.test(buffer)){ //close
      count--
      buffer = "";
    }
    idx++
  }
  return count == 0 && !buffer.length;      
}

module.exports = {
  LiveXML: LiveXML,
  tagCloseTest: tagCloseTest,
};
