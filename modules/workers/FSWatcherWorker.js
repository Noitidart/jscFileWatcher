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
			if (core.os.version < 7) {
				importScripts(core.addon.path.content + 'modules/ostypes_bsd-mac-kq.jsm');
			} else {
				importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
			}
			break;
		case 'freebsd':
		case 'openbsd':
			importScripts(core.addon.path.content + 'modules/ostypes_bsd-mac-kq.jsm');
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
function createWatcher(aWatcherID, aOptions={}) {
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
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
			
			console.error('in createWatcher of worker, core.os.version:', core.os.version);
			// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7
			if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 7 /*is old mac*/) {
				
				// use kqueue
				var rez_kq = ostypes.API('kqueue')(); //core.os.name == 'darwin' ? ostypes.API('kqueue')(0) : /*bsd*/ ostypes.API('kqueue')();
				if (ctypes.errno != 0) {
					console.error('Failed rez_kq, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to kqueue',
						errno: ctypes.errno
					});
				}
				
				var Watcher = {};
				_Watcher_cache[aWatcherID] = Watcher;
				Watcher.kq = rez_kq;
				Watcher.paths_watched = {}; // casing is whatever devuser passed in, key is aOSPath and value is fd of the watched file
				Watcher.vnode_events_for_path = {}; //holds the fflags to monitor for the path, usually should be default, but user can modify it via using options.masks arg of Watcher.prototype.addPath which calls addPathToWatcher in PromiseWorker
				
				var vnode_events = ostypes.CONST.NOTE_DELETE | ostypes.CONST.NOTE_WRITE | ostypes.CONST.NOTE_EXTEND | ostypes.CONST.NOTE_ATTRIB | ostypes.CONST.NOTE_LINK | ostypes.CONST.NOTE_RENAME | ostypes.CONST.NOTE_REVOKE; // ostypes.TYPE.unsigned_int
				
				Watcher.num_files = ostypes.TYPE.int(); // defaults to 0 so this is same as doing `ostypes.TYPE.int(0)`
				Watcher.events_to_monitor = ostypes.TYPE.kevent.array(Watcher.num_files.value)(); // array of 0 length // now that im keeping a global c_string_of_ptrStr_to_eventsToMonitorArr i dont think i think i STILL have to keep this globally defined to prevent GC on it unsure/untested though
				
				console.log('created event_to_monitor and its address:', cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				Watcher.c_string_of_ptrStr_to_eventsToMonitorArr = ctypes.char.array(50)(); // link87354 // i dont use ostypes.TYPE.char here as this is not dependent on os, its dependent on the cutils modifyCStr function which says i should use a ctypes.char // i go to 50 to leave extra spaces in case in future new pointer address i put here is longer
				console.info('c_string_of_ptrStr_to_eventsToMonitorArr.readString():', Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.readString().toString(), Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.address().toString());
				
				cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				console.info('c_string_of_ptrStr_to_eventsToMonitorArr.readString():', Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.readString().toString(), Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.address().toString());
				
				
				// can either set num_files by doing `num_files = ostypes.TYPE.int(NUMBER_HERE)` OR after defining it by `num_files = ostypes.TYPE.int(NUMBER_HERE_OPT_ELSE_0)` then can set it by doing `num_files.contents = NUMBER_HERE`
				// to read it MUST be within same PID (as otherwise memory access is not allowed to it and firefox crashes (as tested on windows)) do this: `var readIntPtr = ctypes.int.ptr(ctypes.UInt64("0x14460454")).contents`
				var argsForPoll = {
					kq: rez_kq, // rez_kq is return of kqueue which is int, so no need for jscGetDeepest
					num_files_ptrStr: cutils.strOfPtr(Watcher.num_files.address()),
					ptStr_cStringOfPtrStrToEventsToMonitorArr: cutils.strOfPtr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.address())
				};
				
				return argsForPoll;

			} else {
				// its mac and os.version is >= 10.7
				// use FSEventFramework

				var _js_fsevents_callback = function(streamRef, clientCallBackInfo, numEvents, eventPaths, eventFlags, eventIds) {
					
					return null;
				};
				
				var path_jsStr = OS.Constants.Path.desktopDir;
				var path_cfStr = ostypes.HELPER.makeCFStr(path_jsStr);
				
				try {
					var _c_fsevents_callback = ostypes.TYPE.FSEventStreamCallback(_js_fsevents_callback);
					var cfStrArr = ostypes.TYPE.CFStringRef.array(1)([
						path_cfStr
					]);
					var cfArr = ctypes.cast(cfStrArr, ostypes.TYPE.CFArrayRef);
					
					var cId = ostypes.API('FSEventsGetCurrentEventId')(); // ostypes.TYPE.FSEventStreamEventId(ostypes.CONST.kFSEventStreamEventIdSinceNow);
					console.info('cId:', cId.toString());
					var fsstream = ostypes.API('FSEventStreamCreate')(ostypes.CONST.kCFAllocatorDefault, _c_fsevents_callback, null, cfArray, cId, 0.1, ostypes.CONST.kFSEventStreamCreateFlagWatchRoot | ostypes.CONST.kFSEventStreamCreateFlagFileEvents);
					console.info('fsstream:', fsstream, fsstream.toString(), uneval(fsstream));
					if (ctypes.errno != 0) {
						console.error('Failed fsstream, errno:', ctypes.errno);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed fsstream',
							unixErrno: ctypes.errno
						});
					}
					
					//var rez_FSEventStreamScheduleWithRunLoop = ostypes.API('FSEventStreamScheduleWithRunLoop')(fsstream, DirectoryWatch.EventThread.loop, ostypes.CONST.kCFRunLoopDefaultMode)
				} catch(ex) {
					var rez_CFRelease = ostypes.API('CFRelease')(path_cfStr); // returns void
					throw ex;
				}
				
				
			}

		break;
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
				Watcher.paths_watched = {}; // casing is whatever devuser passed in, key is aOSPath, and value is watch_fd
				
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

function addPathToWatcher(aWatcherID, aOSPath, aOptions={}) {
	// aOSPath is a jsStr os path
	
	switch (core.os.name) {
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
			// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7

			if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 7 /*is old mac*/) {
				// use kqueue
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'jscfilewatcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				// Open a file descriptor for the file/directory that you want to monitor.
				var event_fd = core.os.name == 'darwin' ? ostypes.API('open')(aOSPath, OS.Constants.libc.O_EVTONLY) : /*bsd*/ ostypes.API('open')(aOSPath, OS.Constants.libc.O_RDONLY);
				console.info('event_fd:', event_fd.toString(), uneval(event_fd));
				if (ctypes.errno != 0) {
					console.error('Failed event_fd, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to open path of "' + aOSPath + '"',
						errno: ctypes.errno
					});
				}

				Watcher.paths_watched[aOSPath] = event_fd; // safe as is ostypes.TYPE.int which is ctypes.int
				
				// Set up a list of events to monitor.
				Watcher.vnode_events_for_path[aOSPath] = ostypes.CONST.NOTE_DELETE | ostypes.CONST.NOTE_WRITE | ostypes.CONST.NOTE_EXTEND | ostypes.CONST.NOTE_ATTRIB | ostypes.CONST.NOTE_LINK | ostypes.CONST.NOTE_RENAME | ostypes.CONST.NOTE_REVOKE; // ostypes.TYPE.unsigned_int
				// reason for flags with respect to aEvent of callback to main thread:
					// NOTE_WRITE - aEvent of contents-modified; File opened for writing was closed.; i dont think this gurantees a change in the contents happend
					// NOTE_RENAME - aEvent of renamed
					// IN_MOVED_FROM - aEvent of renamed (maybe renamed-from?)
					// IN_CREATE - created; file/direcotry created in watched directory
					// NOTE_DELETE - deleted; File/directory deleted from watched directory.
				if (aOptions.masks) {
					Watcher.vnode_events_for_path[aOSPath] |= aOptions.masks;
				}

				var newNumFilesVal = Object.keys(Watcher.paths_watched).length; // can alternatively do Watcher.num_files.value + 1
				
				// i dont change num_files.value until after the new events_to_monitor is created and pointer is set, because if i change this first, then my loop in FSWPollWorker /*link584732*/ might be at a time such that it takes the new num_files and the new events_to_monitor wasnt created and strPtr not set yet, so it will use old events_to_monitor with new num_files number which will probably make kevents throw error in this linked loop
				Watcher.events_to_monitor = ostypes.TYPE.kevent.array(newNumFilesVal)();
				var i = -1;
				for (var cOSPath in Watcher.paths_watched) {
					i++;
					ostypes.HELPER.EV_SET(Watcher.events_to_monitor.addressOfElement(i), Watcher.paths_watched[cOSPath], ostypes.CONST.EVFILT_VNODE, ostypes.CONST.EV_ADD | ostypes.CONST.EV_CLEAR, Watcher.vnode_events_for_path[cOSPath], 0, cOSPath);
				}
				
				console.log('created NEW after ADD event_to_monitor and its address:', cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, cutils.strOfPtr(Watcher.events_to_monitor.address()));
				Watcher.num_files.value = newNumFilesVal; // now after setting this, the next poll loop will find it is different from before
				
				// what if user does removePath of x addPath of x2, num_files.value stays same and loop wont trigger, so am changing it to check the pointer string to events_to_monitor

				// end kqueue
			} else {
				// its mac and os.version is >= 10.7
				// use FSEventFramework
			}

		break;
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
				
				// check if path is a directory? i dont know, maybe inotify supports watching non-directories too
				
				//masks must be integer that can get |'ed with existing masks, like if devuser wants to not watch for IN_CLOSE_WRITE they should pass in negative ostypes.CONST.IN_CLOSE_WRITE
				var default_flags = ostypes.CONST.IN_CLOSE_WRITE | ostypes.CONST.IN_MOVED_FROM | ostypes.CONST.IN_MOVED_TO | ostypes.CONST.IN_CREATE; // note: whatever goes here should go in FSWPollWorker.js convertFlagsToAEventStr function
				// reason for flags with respect to aEvent of callback to main thread:
					// IN_CLOSE_WRITE - aEvent of contents-modified; File opened for writing was closed.; i dont think this gurantees a change in the contents happend
					// IN_MOVED_TO - aEvent of renamed (maybe renamed-to?)
					// IN_MOVED_FROM - aEvent of renamed (maybe renamed-from?)
					// IN_CREATE - created; file/direcotry created in watched directory
					// IN_DELETE - deleted; File/directory deleted from watched directory.
				if ('masks' in aOptions) {
						default_flags |= aOptions.masks;
				}

				var watch_fd = ostypes.API('inotify_add_watch')(Watcher.fd, aOSPath, default_flags);
				//console.info('watch_fd:', watch_fd.toString(), uneval(watch_fd));
				if (cutils.jscEqual(watch_fd, -1)) {
					console.error('Failed watch_fd, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to inotify_add_watch',
						errno: ctypes.errno
					});
				} else {
					Watcher.paths_watched[aOSPath] = watch_fd; // is ostypes.TYPE.int which is ctypes.int so no need to jscGetDeepest
				}
				
				return watch_fd;
				
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
