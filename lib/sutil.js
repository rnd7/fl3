'use strict';

// external
const _ = require('underscore');

/**
* Create a random with a given length
* digits - number of chars in string
* charset - optional charset as string
*/
function randomString(digits, charset){
  var result = [];
  charset = charset || randomString.CHARSET;
  const charsetLen = charset.length;
  while(digits--) result.push(charset.charAt((Math.random()*charsetLen)|0));
  return result.join(""); 
}
randomString.CHARSET = 
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; 

/**
* Wrap String
*/
function wrap(str, open, close, empty){
  const o = _.isString(open);
  const c = _.isString(close);
  open = o?open:wrap.OPEN;
  close = c?close:o?open:wrap.CLOSE;
  return (empty || str)?open+str+close:"";
}
wrap.OPEN = " ";
wrap.CLOSE = wrap.OPEN;

/**
* shallow single line serializer
*/
function serialize(opts){  
  var str;
  if(!opts) return "";
  if(_.isArray(opts)){
    str = opts.join(serialize.DELIMITER);
  }else if(_.isObject(opts)){
    str = _.map(opts,function(v,k){return k+": "+v;}).join(serialize.DELIMITER);
  }else{
    str = opts.toString();
  }
  return str;
}
serialize.DELIMITER = ", ";

module.exports = {
  randomString: randomString,
  wrap: wrap,
  serialize: serialize,
}
