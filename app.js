#!/usr/bin/env node

const child_process = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');

let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
var debug = require('debug')('phantom-web:server');
var http = require('http');

let servers = [];
let config = require("./config.json").servers;

async function update() {
// downloads latest version of phantom
  if (process.platform === "linux") {
    if (process.arch === "arm") {
      child_process.exec(`curl -s https://api.github.com/repos/jhead/phantom/releases | grep browser_download_url | grep 'arm${process.config.variables.arm_version}' | head -n 1 | cut -d '"' -f 4 | xargs wget -N`)
      await sleep(10000);
      child_process.exec(`cp phantom-linux-arm${process.config.variables.arm_version} phantom`);
    } else {
      child_process.exec(`curl -s https://api.github.com/repos/jhead/phantom/releases | grep browser_download_url | grep 'linux' | head -n 1 | cut -d '"' -f 4 | xargs wget -N`);
      await sleep(10000);
      child_process.exec(`cp phantom-linux phantom`);
    }
    await sleep(500);
    child_process.exec("chmod u+x ./phantom");
  }
  console.log("Phantom Updated")
}

update().then(() => {
  config.forEach( (server, index) => {
    if (!!server.auto && !server.pid) {
      startServer(index);
    }
  });
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
  res.render('index', { title: 'Servers', servers: config });
});

app.get('/server/edit/:index', (req, res, next) => {
  let server = config[req.params.index];
  server.index = req.params.index;
  res.render('edit', { title: 'Edit External Server', server})
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
  res.render('create', { title: 'Express' });
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

function writeConfig() {
  let file = [];
  config.forEach( (server, index) => {
    file[index] = {};
    file[index].name = config[index].name;
    file[index].address = config[index].address;
    file[index].port = config[index].port;
    file[index].auto = config[index].auto;
  });

  fs.writeFile('./config.json', JSON.stringify({ "servers": file }), 'utf8', function (err) {
    if (err) {
      return console.log(err);
    }

    console.log("The file was saved!");
  });

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
  debug('Listening on ' + bind);
}

module.exports = app;
