'use strict';

// native
const http = require('http');
const os = require('os');

// external
const whoisLookup = require('node-whois').lookup;
const dns = require('dns');
const mac = require('getmac').getMac;

/**
* Get local IP Address as returnen by os.networkInterfaces
*/
function localIp(){  
  var ifaces = os.networkInterfaces();  
  var ip = [];
  Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;
    ifaces[ifname].forEach((iface)=>{
      if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }
      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        //console.log(ifname + ':' + alias, iface.address);
      } else {
        // this interface has only one ipv4 adress
        //console.log(ifname, iface.address);
      }
      ip.push(iface.address)
      ++alias;
    });
  });
  return ip
}

/**
* Use external service to find the public (external) ip address
*/
function publicIp(callback){  
  http.request(
    {
      host: publicIp.HOST,
      path: publicIp.PATH
    }, 
    (response)=>{
      var str = '';    
      response.on('data', (chunk)=>{str += chunk});    
      response.on('end', ()=>{callback(str.replace(/[^0-9.]/g,''))});
    }
  ).end();
}
publicIp.HOST = 'myexternalip.com';
publicIp.PATH = '/raw';

/**
* Whois lookup by IP Address
*/
function whois(ipAddress, callback){
  whoisLookup(ipAddress, (err, data)=>{
    callback(data)
  }) 
}

/**
* DNS Lookup
*/
function lookup(domain, callback){
  dns.resolve4(domain, callback)
}

/**
* Reverse DNS Lookup
*/
function reverseLookup(address, callback){
  dns.reverse(address, callback)
}


module.exports = {
  whois:whois,
  localIp:localIp,
  publicIp:publicIp,
  lookup: lookup,
  reverseLookup: reverseLookup,
  mac: mac
};
