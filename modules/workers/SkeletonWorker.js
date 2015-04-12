'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
const core = { // have to set up the main keys
	addon: {
		name: 'jscFileWatcher',
		id: 'jscFileWatcher@jetpack',
		path: {
			content: 'chrome://jscfilewatcher/content/',
			locale: 'chrome://jscfilewatcher/locale/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	},
	firefox: {}
};

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
importScripts(core.addon.path.content + 'modules/cutils.jsm');


// Setup PromiseWorker
var PromiseWorker = require(core.addon.path.content + 'modules/workers/PromiseWorker.js');
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

////// end of imports and definitions

function init(objCore) {
	console.log('in worker init');
	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	for (var p in objCore) {
		/* // cant set things on core as its const
		if (!(p in core)) {
			core[p] = {};
		}
		*/
		
		for (var pp in objCore[p]) {
			core[p][pp] = objCore[p][pp];
		}
	}

	console.log('done merging objCore into core');
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
	  case 'winnt':
	  case 'winmo':
	  case 'wince':
		importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
		break;
	  case 'linux':
	  case 'sunos':
	  case 'webos': // Palm Pre
	  case 'android':
		importScripts(core.addon.path.content + 'modules/ostypes_nix.jsm');
		break;
	  case 'darwin':
		importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
		break;
	  case 'freebsd':
	  case 'openbsd':
		importScripts(core.addon.path.content + 'modules/ostypes_bsd.jsm');
		break;
	  default:
		throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
	}
	console.log('done importing ostypes_*.jsm');
	
	return true;
}