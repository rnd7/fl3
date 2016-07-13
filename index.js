#!/usr/bin/env node

"use strict";

// external
const program = require('commander');

// lib fl3
const cli = require('./lib/cli.js');

program
  .version('0.0.39')
  .usage("[command] [options]");

program
  .command('mac')
  .description('Prints your MAC Address')
  .action(cli.mac);

program
  .command('localIp')
  .description('Prints your local IP Address')
  .action(cli.localIp);

program
  .command('publicIp')
  .description('Prints your public IP Address')
  .action(cli.publicIp);

program
  .command('resolve <domain>')
  .description('DNS and Reverse DNS Lookup for the given domain')
  .action(cli.resolve);

program
  .command('whois <ip>')
  .description('Whois Query')
  .action(cli.whois);

program
  .command('crawl <url>')
  .description('Multithreaded webcrawler')
  .option('-g, --global', "Crawl through foreign hosts.")
  .option(
    '-d, --distance <distance>',
    "Maximal Distance from given entry point",
    (x)=>{return Math.max(0,parseInt(x))},
    5
  )
  .option(
    '-l, --limit <limit>',
    "Limit the amount of links the crawler follows",
    (x)=>{return Math.max(1,parseInt(x))},
    1e5
  )
  .option(
    '-t, --threads <threads>',
    "Maximum parallel requests",
    (x)=>{return Math.max(1,parseInt(x))},
    10
  )
  .option(
    '-o, --output <file>',
    "Write results to file",
    (x)=>{return x},
    false
  )
  .action(cli.crawl);


program
  .command('swarm <url>')
  .description('Multithreaded bot swarm')
  .option('-g, --global', "Crawl through foreign hosts.")
  .option(
    '-d, --distance <distance>',
    "Maximal Distance from given entry point",
    (x)=>{return Math.max(0,parseInt(x))},
    5
  )
  .option(
    '-l, --limit <limit>',
    "Limit the amount of links the crawler follows",
    (x)=>{return Math.max(1,parseInt(x))},
    1e5
  )
  .option(
    '-t, --threads <threads>',
    "Maximum parallel requests",
    (x)=>{return Math.max(1,parseInt(x))},
    10
  )
  .option(
    '-o, --output <file>',
    "Write results to file",
    (x)=>{return x},
    false
  )
  .action(cli.swarm);

program
  .command('retrieve <url>')
  .description('Automated agent that crawls through a website and downloads all resources')
  .option('-g, --global', "Crawl through foreign hosts")
  .option(
    '-d, --distance <distance>',
    "Maximal Distance from given entry point",
    (x)=>{return Math.max(0,parseInt(x))},
    5
  )
  .option(
    '-l, --limit <limit>',
    "Limit the amount of links the crawler follows",
    (x)=>{return Math.max(1,parseInt(x))},
    1e5
  )
  .option(
    '-t, --threads <threads>',
    "Maximum parallel requests",
    (x)=>{return Math.max(1,parseInt(x))},
    10
  )
  .option(
    '-p, --parallel <parallel>',
    "Maximum parallel downloads",
    (x)=>{return Math.max(1,parseInt(x))},
    10
  )
  .option(
    '-d, --directory <directory>',
    "Download directory",
    (x)=>{return x},
    false
  )
  .option(
    '-to, --timeout <timeout>',
    "Download timeout",
    (x)=>{return Math.max(1,parseInt(x))},
    60000
  )
  .option(
    '-f, --filter <filter>',
    "Filename filter Regular Expression (ie: .*)",
    (x)=>{return new RegExp(x)},
    /.*/
  )
  .option(
    '-o, --output <file>',
    "Write results to file",
    (x)=>{return x},
    false
  )
  .action(cli.retrieve);

program
  .command('scan [tasks...]')
  .description('Scans a network for open ports')
  .option('-c, --commonPorts', "append common ports to each task")
  .option('-p, --ports', "append given ports to each task")
  .option(
    '-t, --threads <threads>',
    "maximum parallel nmap threads",
    (x)=>{return Math.max(1,parseInt(x))},
    10
  )
  .option(
    '-b, --brutality <brutality>',
    "aggression level",
    (x)=>{return Math.min(5,Math.max(1,parseInt(x)))},
    4
  )
  .option(
    '-to, --timeout <timeout>',
    "task timeout in milliseconds",
    (x)=>{return Math.max(1,parseInt(x)*1000)},
    120
  )
  .option(
    '-o, --output <file>',
    "write results to file",
    (x)=>{return x},
    false
  )
  .action(cli.scan);

program
  .command('claim')
  .description('Formats your hardisk and turns your computer into a fl3 zombie')
  .option(
    '-i --interval <interval>',
    "set the interval in msec",
    (x)=>{return Math.max(1,parseInt(x))},
    150
  )
  .action(cli.claim)

/* INITIALIZATION *************************************************************/


cli.init()
program.parse(process.argv);
if(!program.args.length || typeof program.args[0] === "string") cli.error()
