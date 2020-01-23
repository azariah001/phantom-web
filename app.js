#!/usr/bin/env node

const child_process = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');

let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
let debug = require('debug')('phantom-web:server');
let http = require('http');
let later = require('later');

let updateSchedule = later.parse.text('at 03:00am every day');
let updateTimer = later.setInterval(update, updateSchedule);

let os = require('os');
let ssdp = require("peer-ssdp");
let SERVER = os.type() + "/" + os.release() + " UPnP/1.1 famium/0.0.1";
let uuid = "6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988";
let peer = ssdp.createPeer();

let ifaces = os.networkInterfaces();
const ssdpHeader = {
  HOST: '239.255.255.250:1900',
  EXT: '',
  'CACHE-CONTROL': 'max-age=100',
  LOCATION: "http://{{networkInterfaceAddress}}:3000/desc.xml",
  SERVER: SERVER,
  ST: "upnp:rootdevice",
  USN: "uuid:" + uuid + "::upnp:rootdevice",
  'BOOTID.UPNP.ORG': 1
};
/**
 * handle peer ready event. This event will be emitted after `peer.start()` is called.
 */
let interval;
peer.on("ready",function(){
  // hey were over here! echo echo echo echo
  interval = setInterval(function(){
    peer.alive(ssdpHeader);
  }, 1000);
}).on("notify", function (headers, address) {
  // do nothing we don't care
}).on("search", function (headers, address) {
  // oh oh oh, yes we're hearing! we're over HERE!
  peer.reply(ssdpHeader, address);
}).on("found", function (headers, address) {
  // oh someone found us yay
}).on("close", function () {
  console.log("ssdp connection closed");
}).start();

process.on('exit', function(){
  clearInterval(interval);
  // Close peer. Afer peer is closed the `close` event will be emitted.
  peer.close();
});

let servers = [];
let config = require("./config.json").servers || [];
const currentVersion = JSON.parse( fs.readFileSync('./package.json', 'utf8') ).version;
let newVersion;
let updating = false;
console.log(`Current Version: ${currentVersion}`);

async function update() {

  console.log("Updating phantom-web to latest version.");

  child_process.exec("git pull", (error, stdout, stderr) => {
    console.log(stdout);


    newVersion = JSON.parse( fs.readFileSync('./package.json', 'utf8') ).version;
    console.log(`New Version: ${newVersion}`);

    if ( (currentVersion !== newVersion) || (stdout !== "Already up to date.\n") ) {
      updating = true;

      installUpdate().then(() => {
        console.log("Update Applied");

        writeConfig().then( () => {

          // kill all running phantoms
          if (servers.length) servers.forEach( (server, index) => {
            server.kill('SIGHUP');
            delete config[index].pid;
            console.log("Phantom's slain.");
          });
          console.log("It's day time. No phantom's to slay.");

          updateTimer.clear();
          console.log("Update scheduler leashed.");

          console.log("Stopping SSDP service.");
          clearInterval(interval);
          peer.close();

          console.log("Goodbye.");
          server.close();

          //sometimes you just need to use a sledgehammer
          process.exit();
        });

      });

    }
  });
}

async function installUpdate() {
  console.log("Run npm install after update.");
  child_process.execSync("npm install");

  console.log("Fix file permissions after update.");
  child_process.exec("sudo chown ubuntu:ubuntu ./ -R");
  child_process.exec("sudo chmod 775 ./");
  child_process.exec("sudo chmod +x app.js");

  await sleep(500);
}

update().then(() => {
  // downloads latest version of phantom
  if (process.platform === "linux") {
    if (process.arch === "arm") {
      child_process.execSync(`curl -s https://api.github.com/repos/jhead/phantom/releases | grep browser_download_url | grep 'arm${process.config.variables.arm_version}' | head -n 1 | cut -d '"' -f 4 | xargs wget -N`);

      child_process.execSync(`cp phantom-linux-arm${process.config.variables.arm_version} phantom`);
    } else {
      child_process.execSync(`curl -s https://api.github.com/repos/jhead/phantom/releases | grep browser_download_url | grep 'linux' | head -n 1 | cut -d '"' -f 4 | xargs wget -N && cp phantom-linux phantom`);

      child_process.execSync(`cp phantom-linux phantom`);
    }

    child_process.execSync("chmod u+x ./phantom");
  }
  console.log("Phantom Updated")
}).then(() => {
  if (!updating) {
    config.forEach( (server, index) => {
      if (!!server.auto && !server.pid) {
        startServer(index);
      }
    });
  }
});

let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


/**
 * Get port from environment and store in Express.
 */

var port = 3000;
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);


app.get('/', (req, res, next) => {
  res.render('index', { title: 'Servers', servers: config, currentVersion: currentVersion, newVersion: newVersion || currentVersion });
});

app.get('/update', (req,res,next) => {
  update();
  res.redirect('/');
});

// provide SSDP service description file with servers current IP address.
app.get('/desc.xml', (req, res, next) => {

  let ip;

  Object.keys(ifaces).forEach(function (ifname) {
    let alias = 0;

    ifaces[ifname].forEach(function (iface) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }

      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        //console.log(ifname + ':' + alias, iface.address);
      } else {
        // this interface has only one ipv4 adress
        ip = iface.address;
      }
      ++alias;
    });
  });

  res.set('Content-Type', 'text/xml');
  res.render('desc', { title: 'Servers', ip: ip });
});

app.get('/server/edit/:index', (req, res, next) => {
  let phantomServer = config[req.params.index];
  phantomServer.index = req.params.index;
  res.render('edit', { title: 'Edit External Server', server: phantomServer, currentVersion: currentVersion, newVersion: newVersion || currentVersion })
});

app.post('/server/edit', (req, res, next) => {
  config[req.body.server.index].name = req.body.server.name;
  config[req.body.server.index].address = req.body.server.address;
  config[req.body.server.index].port = req.body.server.port;
  config[req.body.server.index].auto = req.body.server.auto;

  writeConfig();

  if (!!config[req.body.server.index].pid) {

    stopServer(req.body.server.index);

    startServer(req.body.server.index);

  }

  res.redirect('/');
});

app.get('/server/create', (req,res, next) => {
  res.render('create', { title: 'Add External Server', currentVersion: currentVersion, newVersion: newVersion || currentVersion });
});

app.post('/server/create', createServer, (req, res, next) => {
  res.redirect('/');
});

app.get('/server/delete/:index', (req, res, next) => {

  if (!!config[req.params.index].pid) {
    stopServer(req.params.index);
  }
  config.splice(req.params.index, 1);

  writeConfig();

  res.redirect('/');
});

app.get('/server/start/:index', (req, res, next) => {
  if (!config[req.params.index].pid) {
    startServer(req.params.index);
  } else {
    stopServer(req.params.index);

    startServer(req.params.index);
  }

  res.redirect('/');
});

app.get('/server/stop/:index', (req, res, next) => {

  stopServer(req.params.index);

  res.redirect('/');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function startServer(index) {
  try {
    servers.push( spawn("./phantom", ["-server", `${config[index].address}:${config[index].port}`] ) );
    config[index].pid = servers[servers.length - 1].pid;
    console.log(`${config[index].name} launched`);
  } catch (e) {
    console.log(JSON.stringify(e, "", 4));
  }

  servers[servers.length - 1].on('close', (code, signal) => {
    console.log(`Server terminated due to receipt of signal ${signal}`);
  });
}

function stopServer(index) {
  servers.forEach( (server, i) => {
    if (server.pid === config[index].pid) {
      console.log(`Stopping ${server.name} server.`);
      server.kill('SIGHUP');
      servers.slice(i, 1);
      delete config[index].pid;
    }
  });
}

function createServer(req, res, next) {
  console.log(`Create: ${JSON.stringify(req.body.server, "", 4)}`);

  config.push(req.body.server);

  writeConfig();

  if (!!req.body.start) {
    startServer(config.length - 1);
  }

  next();
}

async function writeConfig() {
  let file = [];
  config.forEach( (server, index) => {
    file[index] = {};
    file[index].name = config[index].name;
    file[index].address = config[index].address;
    file[index].port = config[index].port;
    file[index].auto = config[index].auto;
  });

  fs.writeFileSync('./config.json', JSON.stringify({ "servers": file }));

  console.log("Configuration saved.");

}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
  console.log('Listening on ' + bind);
}

module.exports = app;
