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

	//console.log('done merging objCore into core');
	
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
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	//console.log('done importing ostypes_*.jsm');
	
	return true;
}

// start - OS.File.Watcher API
var _Watcher_cache = {};
function createWatcher(aWatcherID) {
	// _Watcher_cache[aWatcherID] = 

	// returns object which should  be passed to FSWPollWorker.poll
	
	switch (core.os.name) {
		//	case 'winnt':
		//	case 'winmo': // untested, im guessing it has ReadDirectoryChangesW
		//	case 'wince': // untested, im guessing it has ReadDirectoryChangesW
		// 	
		// 		// use ReadDirectoryChangesW
		// 	
		// 	break;	
		// case 'openbsd':
		// case 'freebsd':
		// 	
		// 		// uses kqueue
		// 	
		// 	break;		
		// case 'sunos':
		// 	
		// 		// from http://www.experts-exchange.com/Programming/System/Q_22735761.html
		// 			// inotify equivalent for SunOS => The best you can get is use FAM for Solaris, have a look at: http://savannah.nongnu.org/task/?2058
		// 	
		// 	break;
		// case 'darwin':
		// 	
		// 		// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7
		// 	
		//		if (core.os.version < 10.7) {
		//			// use kqueue
		//		} else {
		//			// os.version is >= 10.7
		//			// use FSEventFramework
		//		}
		//
		// 	break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested

				// uses inotify
				var fd = ostypes.API('inotify_init')(0);
				if (cutils.jscEqual(fd, -1)) {
					console.error('Failed rez_init, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to inotify_init',
						errno: ctypes.errno
					});
				}
				
				var Watcher = {};
				_Watcher_cache[aWatcherID] = Watcher;
				Watcher.fd = fd;
				Watcher.paths_watched = {}; // lower cased OS paths that are being watched (i do lower case because these are inputed by user passing as args to addPath/removePath, and devuser might do different casings as devusers can be stupid)
				// in the worker, paths_watched keyval is aOSPathLower just like in mainthread but the value is the watch_fd
				
				var argsForPoll = {
					fd: parseInt(cutils.jscGetDeepest(fd))
				};
				
				return argsForPoll;

			break;
		default:
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
}

function addPathToWatcher(aWatcherID, aOSPathLower, aOptions={}) {
	// aOSPath is a jsStr os path
	
	switch (core.os.name) {
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
		
				// uses inotify
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'jscfilewatcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				if (aOSPathLower in Watcher.paths_watched) {
					throw new Error({
						name: 'duplicate-path',
						message: 'This path is already being watched so will not be added. Path is "' + aOSPathLower + '"'
					});
				}
				
				// check if path is a directory? i dont know, maybe inotify supports watching non-directories too
				
				//masks must be integer that can get |'ed with existing masks, like if devuser wants to not watch for IN_CLOSE_WRITE they should pass in negative ostypes.CONST.IN_CLOSE_WRITE
				var masks = (ostypes.CONST.IN_CLOSE_WRITE | ostypes.CONST.IN_MOVED_FROM | ostypes.CONST.IN_MOVED_TO | ostypes.CONST.IN_CREATE | ostypes.CONST.IN_DELETE_SELF | ostypes.CONST.IN_MOVE_SELF);
				// reason for flags with respect to aEvent of callback to main thread:
					// IN_CLOSE_WRITE - aEvent of contents-modified; File opened for writing was closed.; i dont think this gurantees a change in the contents happend
					// IN_MOVED_TO - aEvent of renamed (maybe renamed-to?)
					// IN_MOVED_FROM - aEvent of renamed (maybe renamed-from?)
					// IN_CREATE - created; file/direcotry created in watched directory
					// IN_DELETE - deleted; File/directory deleted from watched directory.
					// IN_DELETE_SELF - deleted; self was deleted
					// IN_MOVED_SELF - moved; self was moved
				if ('masks' in aOptions) {
						masks |= aOptions.masks;
				}

				var watch_fd = ostypes.API('inotify_add_watch')(Watcher.fd, aOSPathLower, masks);
				//console.info('watch_fd:', watch_fd.toString(), uneval(watch_fd));
				if (!cutils.jscEqual(watch_fd, -1)) {
					console.error('Failed watch_fd, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to inotify_add_watch',
						errno: ctypes.errno
					});
				} else {
					Watcher.paths_watched[aOSPathLower] = watch_fd;
				}
				
				return true;
			break;
		default:
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// for winnt, check if aOSPath is a directory, if its not then throw error
}

function removePathFromWatcher(aWatcherID, aOSPath) {
	// aOSPath is a jsStr os path
	throw new Error('in dev1');
}

function closeWatcher(aWatcherID) {
	// _Watcher_cache[aWatcherID] = 
	throw new Error('in dev3');
}
// end - OS.File.Watcher API