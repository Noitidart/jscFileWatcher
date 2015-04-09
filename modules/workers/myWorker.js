/*jshint node:true, esnext: true, moz: true, -W117*/
// Imports
'use strict';
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

const core = {
  name: 'jscFileWatcher',
  id: 'jscFileWatcher@jetpack',
  path: {
    chrome: 'chrome://jscfilewatcher/content/',
    locale: 'chrome://jscfilewatcher/locale/'
  },
  aData: 0
};

importScripts(core.path.chrome + 'modules/cutils.jsm');

// Globals
const cOS = OS.Constants.Sys.Name.toLowerCase();

// Some more imports
switch (cOS) {
  case 'winnt':
  case 'winmo':
  case 'wince':
		importScripts(core.path.chrome + 'modules/ostypes_win.jsm');
		break;
	case 'linux':
	case 'freebsd':
	case 'openbsd':
	case 'sunos':
	case 'webos': // Palm Pre
	case 'android': //profilist doesnt support android (android doesnt have profiles)
		importScripts(core.path.chrome + 'modules/ostypes_nix.jsm');
		break;
	case 'darwin':
		importScripts(core.path.chrome + 'modules/ostypes_mac.jsm');
		break;
	default:
		throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
}

// PromiseWorker
var PromiseWorker = require(core.path.chrome + 'modules/workers/PromiseWorker.js');
var worker = new PromiseWorker.AbstractWorker();
worker.dispatch = function(method, args = []) {
	return self[method](...args);
};
worker.postMessage = function(result, ...transfers) {
	self.postMessage(result, ...transfers);
};
worker.close = function() {
	self.close();
};
self.addEventListener('message', msg => worker.handleMessage(msg));

// Init
var objInfo; //populated by init
function init(objOfInitVars) {
  switch (cOS) {
    case 'winnt':
    //case 'winmo':
    //case 'wince':
      for (let i=0, requiredKeys = ['OSVersion']; i<requiredKeys.length; i++) {
        if (!(requiredKeys[i] in objOfInitVars)) {
          throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
        }
      }
      break;
    default:
      // do nothing
      for (let i=0, requiredKeys = ['FFVersion', 'FFVersionLessThan30']; i<requiredKeys.length; i++) {
        if (!(requiredKeys[i] in objOfInitVars)) {
          throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
        }
      }
  }

  objInfo = objOfInitVars;
}

// start - main defintions
function initWatch(path, /*callback,*/ options = {}) {
  switch (cOS) {
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'sunos':
    case 'webos': // Palm Pre
    case 'android':
			//new ostypes.API.;
      if (!('masks' in options)) {
          throw new Error('Missing required `masks` key in options objection');
      }
      //masks must be an array of strings
      if (Object.prototype.toString.call(options.masks) !== '[object Array]') {
          throw new Error('options.masks must be array of strings');
      }
      var masks = 0;
      for (let i=0; i<options.masks.length; i++) {
          if (typeof options.masks[i] !== 'string') {
              throw new Error('element at position ' + i + ' in options.masks is not a string');
          } else if (!(options.masks[i] in ostypes.CONST)) {
              throw new Error('"' + options.masks[i] + '" was found at position ' + i + ' in options.masks. It was not found in ostypes.CONST obj, it is likely an invalid constant');
          }
          masks |= ostypes.CONST[options.masks[i]];
      }
      var rez_notify = new Notify(path, masks/*, callback*/);
      rez_notify.addWatch();
      return true;
    default:
      throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
  }
}

// start - nix file watching
function inotifyCallbackTemp() {
	console.error('inotifyCallbackTemp triggered!!! this is good!');
}

function Notify(path, masks, callback = inotifyCallbackTemp, callbackError = Function){
  this.fd = ostypes.API('inotify_init')(0);
  if (this.fd === -1) {
    throw new Error('Failed to inotify init, error code is ' + ctypes.errno);
  }
  this.path = path;
  this.masks = masks;
  this.callbackSuccess = callback;
  this.callbackError = callbackError;
  return true;
}
Notify.prototype.addWatch = function(){
  this.watch = ostypes.API('inotify_add_watch')(this.fd, this.path, this.masks); // return an instance of iNotify (sorry for calling it like this, its actually something like ID for the watch).
  if (this.watch === -1) {
    throw new Error('failed to add watch, error is: ' + ctypes.errno);
  }

  // based on https://github.com/Noitidart/ChromeWorker
  var pollWorker = new ChromeWorker(core.path.chrome + 'modules/workers/nixPoll.js');
  var handleMessageFromWorker = (type, msg) => {
    if (type === 'error') {
      this.callbackError(msg);
    } else {
      this.callbackSuccess(msg);
    }
  };
  pollWorker.addEventListener('message', handleMessageFromWorker);
  pollWorker.addEventListener('error', handleMessageFromWorker);
  console.log('ok added pollWorker');
  pollWorker.postMessage(this.fd);
  console.log('ok send msg to pollWorker');

  return true;
};
Notify.prototype.removeWatch = function(path, callback){
  var rez_rm = ostypes.API('inotify_rm_watch')(this.fd, this.watch);
  if (rez_rm !== -1) {
    console.log('succesfully removed watch');
    return true;
  } else {
    // it is -1
    throw new Error('failed to remove watch, error is: ' + ctypes.errno);
  }
};
Notify.prototype.close = function() {
  var rez_c  = ostypes.API('close')(this.fd);
  if (rez_c !== -1) {
    console.log('succesfully closed');
    return true;
  } else {
   // it is -1
    throw new Error('failed to close, error is: ' + ctypes.errno);
  }
};
// end - nix file watching
// end - main defintions
