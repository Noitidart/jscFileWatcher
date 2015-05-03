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

var winStuff = {
	maxLen_cStrOfHandlePtrStrsWaitingAdd: 100 // if update this here, update it in FSWPollWorker too
}

var macStuff = {
	maxLenCfArrRefPtrStr: 20 // if update this update in FSWPollWorker
};
var gioStuff = {};

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

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
	
	if (core.os.toolkit == 'gtk2') {
		core.os.name = 'gio';
	}
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
		case 'gio':
			importScripts(core.addon.path.content + 'modules/ostypes_gio.jsm');
			break;
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
				name: 'watcher-api-error',
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
		case 'gio':
				
				var aOSPath = OS.Constants.Path.desktopDir;
				//var cStr_path = ostypes.TYPE.char.array()(aOSPath);
				
				var file = ostypes.API('g_file_new_for_path')(aOSPath);
				console.info('file:', file.toString());
				
				console.log('gio createWatcher');
				var monitor = ostypes.API('g_file_monitor_directory')(file, ostypes.CONST.G_FILE_MONITOR_NONE, null, null);
				console.info('monitor:', monitor.toString());
				
				if (monitor.isNull()) {
				  console.error('Failed g_file_monitor_directory, monitor:', monitor.toString(), 'FOR path of:', aOSPath);
				  throw new Error({
					name: 'os-api-error',
					message: 'Failed g_file_monitor_directory - monitor: ' + monitor.toString() + ' FOR path of: ' + aOSPath
				  });
				}
				
				var cb = function(aMonitor, aFile, aOtherFile, aEventType) {
					console.error('CB TRIGGERED: aMonitor:', aMonitor, 'aFile:', aFile, 'aOtherFile:', aOtherFile, 'aEventType:', aEventType);
				}
				
				var handler_id = ostypes.API('g_signal_connect_data')(monitor, 'changed', cb, null, null, null);
				console.info('handler_id:', handler_id.toString());
			break;
			case 'winnt':
			case 'winmo': // untested, im guessing it has ReadDirectoryChangesW
			case 'wince': // untested, im guessing it has ReadDirectoryChangesW
		
				// use ReadDirectoryChangesW
				
				var Watcher = {};
				_Watcher_cache[aWatcherID] = Watcher;
				
				Watcher.numHandlesWaitingAdd = ctypes.int(0);
				Watcher.cStrOfHandlePtrStrsWaitingAdd = ctypes.char.array(winStuff.maxLen_cStrOfHandlePtrStrsWaitingAdd)(); // join the hDirectory with a comma, FSWPollWorker will split it and add them into its cache // :note:important:warning: this can fill up, which is bad, i hope it doesnt

				Watcher.paths_watched = {};
				
				var argsForPoll = {
					numHandlesWaitingAdd_ptrStr: cutils.strOfPtr(Watcher.numHandlesWaitingAdd.address()),
					strOfHandlePtrStrsWaitingAdd_ptrStr: cutils.strOfPtr(Watcher.cStrOfHandlePtrStrsWaitingAdd.address())
				};
				
				return argsForPoll;

			break;
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
				
				Watcher.cStr_OSPath_obj = {}; // obj holding cstrs so i can read it in the callback, holding it here so it doesnt get gc'ed
				
				Watcher.num_files = ostypes.TYPE.int(); // defaults to 0 so this is same as doing `ostypes.TYPE.int(0)`
				Watcher.events_to_monitor = ostypes.TYPE.kevent.array(Watcher.num_files.value)(); // array of 0 length // now that im keeping a global c_string_of_ptrStr_to_eventsToMonitorArr i dont think i think i STILL have to keep this globally defined to prevent GC on it unsure/untested though
				
				console.log('created event_to_monitor and its address:', cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				var evtMtrPtrStr_len = 50; // change in FSWPollWorker too
				Watcher.c_string_of_ptrStr_to_eventsToMonitorArr = ctypes.char.array(evtMtrPtrStr_len)(); // link87354 // i dont use ostypes.TYPE.char here as this is not dependent on os, its dependent on the cutils modifyCStr function which says i should use a ctypes.char // i go to 50 to leave extra spaces in case in future new pointer address i put here is longer
				//console.info('c_string_of_ptrStr_to_eventsToMonitorArr.readString():', Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.readString().toString(), Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.address().toString());
				
				cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				//console.info('c_string_of_ptrStr_to_eventsToMonitorArr.readString():', Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.readString().toString(), Watcher.c_string_of_ptrStr_to_eventsToMonitorArr.address().toString());
				
				
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

				var Watcher = {};
				_Watcher_cache[aWatcherID] = Watcher;
				
				Watcher.paths_watched_props = {}; // key is aOSPath, val is obj {path_id: jsInt, cfStr: cfStr}
				Watcher.nextPathId = 0;
				
				Watcher.cStr_ptrOf_cfArrRef = ctypes.char.array(macStuff.maxLenCfArrRefPtrStr)(); // putting into Watcher obj as i think i need to keep it alive like htat (i didnt test but i think if i do var cfArrRefPtrStr = might get GC'ed)
				//Watcher.cInt_numPaths = ctypes.int(0);
				
				var argsForPoll = {
					ptrStrOf__cStr_ptrOf_cfArrRef: cutils.strOfPtr(Watcher.cStr_ptrOf_cfArrRef.address()),
					//ptrStrOf__cInt_numPaths: cutils.strOfPtr(Watcher.cInt_numPaths.address())
				};
				
				return argsForPoll;
				
				
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
				Watcher.cInt_numPaths = ctypes.int();
				
				var argsForPoll = {
					fd: parseInt(cutils.jscGetDeepest(fd)),
					ptrStrOf__cInt_numPaths: cutils.strOfPtr(Watcher.cInt_numPaths.address())
				};
				
				return argsForPoll;

			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
}

function addPathToWatcher(aWatcherID, aOSPath, aOptions={}) {
	// aOSPath is a jsStr os path
	
	switch (core.os.name) {
		case 'gio':
				
				console.log('gio addPath');
				
			break;
		case 'winnt':

				var Watcher = _Watcher_cache[aWatcherID];
				console.info('Watcher:', JSON.stringify(Watcher));
				if (Object.keys(Watcher.paths_watched).length == ostypes.CONST.MAXIMUM_WAIT_OBJECTS) {
					throw new Error({
						name: 'devuser-error',
						message: 'Already watching maximum number of paths, the Windows API (WaitForMultipleObjectsEx) does not support waiting for more than ' + ostypes.CONST.MAXIMUM_WAIT_OBJECTS + ' paths'
					});
				}
				
				/* // verify aOSPath is a directory
				// this is extra overhead, i dont want to do this, just let the os-api throw once it receives a non-directory
				try {
					var stat = OS.File.stat(aOSPath);
				} catch(ex) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Failed to OS.File.stat aOSPath to ensure it is a directory',
						OSFileError: ex
					});
				}
				*/
				
				// :todo: test if CreateFile throws when we pass it a non-directory path, as we are asking it to FILE_LIST_DIRECTORY and FILE_FLAG_BACKUP_SEMANTICS which are directory specific flags im pretty sure
				var hDirectory = ostypes.API('CreateFile')(aOSPath, ostypes.CONST.FILE_LIST_DIRECTORY, ostypes.CONST.FILE_SHARE_READ | ostypes.CONST.FILE_SHARE_WRITE | ostypes.CONST.FILE_SHARE_DELETE, null, ostypes.CONST.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_BACKUP_SEMANTICS | ostypes.CONST.FILE_FLAG_OVERLAPPED, null);
				console.info('hDirectory:', hDirectory.toString(), uneval(hDirectory));
				if (ctypes.winLastError != 0) { //cutils.jscEqual(hDirectory, ostypes.CONST.INVALID_HANDLE_VALUE)) { // commented this out cuz hDirectory is returned as `ctypes.voidptr_t(ctypes.UInt64("0xb18"))` and i dont know what it will be when it returns -1 but the returend when put through jscEqual gives `"breaking as no targetType.size on obj level:" "ctypes.voidptr_t(ctypes.UInt64("0xb18"))"`
					console.error('Failed hDirectory, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to CreateFile',
						winLastError: ctypes.winLastError
					});
				}
				Watcher.paths_watched[aOSPath] = hDirectory; // close this with CancelIo on watcher.close()
				
				/* test to modify from other threads to see if it affects in here, in my test i modified from mainthread browser console
				setInterval(function() {
					Watcher.numHandlesWaitingAdd.value = Watcher.numHandlesWaitingAdd.value + 1;
					//console.error('val from FSWatcherWorker of numHandlesWaitingAdd:', Watcher.numHandlesWaitingAdd.value);
					console.error('val from FSWatcherWorker of cStrOfHandlePtrStrsWaitingAdd:', Watcher.cStrOfHandlePtrStrsWaitingAdd.readString());
				}, 5000);
				*/
				
				if (Watcher.numHandlesWaitingAdd.value == 0) {
					var jsArrOfHandlePtrStrsWaitingAdd = [];
				} else {
					var jsArrOfHandlePtrStrsWaitingAdd = Watcher.cStrOfHandlePtrStrsWaitingAdd.readString().split(',');
				}
				
				jsArrOfHandlePtrStrsWaitingAdd.push(cutils.strOfPtr(hDirectory.address()));
				var new_jsStr_cStrOfHandlePtrStrsWaitingAdd = jsArrOfHandlePtrStrsWaitingAdd.join(',');
				try {
					cutils.modifyCStr(Watcher.cStrOfHandlePtrStrsWaitingAdd, new_jsStr_cStrOfHandlePtrStrsWaitingAdd);
				} catch (ex if ex.message == 'not enough room in ctypesCharArr for the newStr_js and its null terminator') {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Not enough room in pending to add handles c str to add another handle, I should modify the API to like wait until room is available, or something, the hDirectory is also not closed, so this is a big error, i dont expect to happen but it might, if devuser has a lot of added paths waiting to get added'
					});
				}
				
				Watcher.numHandlesWaitingAdd.value = Watcher.numHandlesWaitingAdd.value + 1; // i dont change this till after i added into str because otherwise FSWPollWorker will react before i modded the string
				
				/*
				try {
					
				} catch (ex) {
					if (hDirectory && !hDirectory.isNull()) {
						console.log('need to closeHandle on hDirectory');
						var rez_CloseHandle = ostypes.API('CloseHandle')(hDirectory);
						if (rez_CloseHandle == false) {
							console.error('encountered error earlier and also encoutnering error when trying to finally close')
							console.error('Failed to CloseHandle on hDirectory, winLastError:', ctypes.winLastError);			
						} else {
							delete Watcher.paths_watched[aOSPath];
							console.log('succesfully closed handle on hDirectory');
						}
					} else {
						console.log('no need to close handle on hDirectory');
					}
					throw new Error({
						name: 'watcher-api-error',
						message: 'An error occured when trying to add path "' + aOSPath +'" so was not added',
						details: ex
					});
				}
				*/
		
				return jsArrOfHandlePtrStrsWaitingAdd[jsArrOfHandlePtrStrsWaitingAdd.length-1];
				
			break;
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
			// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7

			if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 7 /*is old mac*/) {
				// use kqueue
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				// Open a file descriptor for the file/directory that you want to monitor.
				var event_fd = ostypes.API('open')(aOSPath, core.os.name == 'darwin' ? /*mac*/ OS.Constants.libc.O_EVTONLY : /*bsd*/ OS.Constants.libc.O_RDONLY);
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
				
				// start - block link68432130 - copied below
				var newNumFilesVal = Object.keys(Watcher.paths_watched).length; // can alternatively do Watcher.num_files.value + 1
				
				// i dont change num_files.value until after the new events_to_monitor is created and pointer is set, because if i change this first, then my loop in FSWPollWorker /*link584732*/ might be at a time such that it takes the new num_files and the new events_to_monitor wasnt created and strPtr not set yet, so it will use old events_to_monitor with new num_files number which will probably make kevents throw error in this linked loop
				Watcher.events_to_monitor = ostypes.TYPE.kevent.array(newNumFilesVal)();
				var i = -1;
				for (var cOSPath in Watcher.paths_watched) {
					i++;
					// i have to make udata intptr_t as in bsd the field is inptr_t while in mac it is void*
					
					if (!(cOSPath in Watcher.cStr_OSPath_obj)) {
						Watcher.cStr_OSPath_obj[cOSPath] = ctypes.char.array()(cOSPath); // link321354 in FSWPollWorker
					}

					var udata = ctypes.cast(Watcher.cStr_OSPath_obj[cOSPath].address(), ostypes.TYPE.void.ptr);
					console.info('fsww', 'udata:', udata.toString(), 'Watcher.cStr_OSPath_obj[cOSPath].address():', Watcher.cStr_OSPath_obj[cOSPath].address().toString());
					
					ostypes.HELPER.EV_SET(Watcher.events_to_monitor.addressOfElement(i), Watcher.paths_watched[cOSPath], ostypes.CONST.EVFILT_VNODE, ostypes.CONST.EV_ADD | ostypes.CONST.EV_CLEAR, Watcher.vnode_events_for_path[cOSPath], 0, udata);
				}
				
				console.log('created NEW after ADD event_to_monitor and its address:', cutils.strOfPtr(Watcher.events_to_monitor.address()));
				
				cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, cutils.strOfPtr(Watcher.events_to_monitor.address()));
				Watcher.num_files.value = newNumFilesVal; // now after setting this, the next poll loop will find it is different from before
				// end - block link68432130 - copied below
				
				// what if user does removePath of x addPath of x2, num_files.value stays same and loop wont trigger, so am changing it to check the pointer string to events_to_monitor
				return event_fd;
				// end kqueue
			} else {
				// its mac and os.version is >= 10.7
				// use FSEventFramework
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				if (aOSPath in Watcher.paths_watched_props) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'aOSPath of "' + aOSPath + '" already found in watched paths list so will not add this'					
					});
				}
				
				Watcher.nextPathId++;
				var thisPObj = {
					path_id: Watcher.nextPathId-1,
					cfStr: ostypes.HELPER.makeCFStr(aOSPath) // make sure to release these on watcher1.close()
				};
				
				var jsStrArr = [];
				// add in old watched paths
				for (var cOSPath in Watcher.paths_watched_props) {
					jsStrArr.push(Watcher.paths_watched_props[cOSPath].cfStr);
				}
				// add in the new path to be watched
				jsStrArr.push(thisPObj.cfStr);
				
				var cfStrArr = ostypes.TYPE.void.ptr.array()(jsStrArr);

				Watcher.cfArrRef = ostypes.API('CFArrayCreate')(null, cfStrArr, cfStrArr.length, ostypes.CONST.kCFTypeArrayCallBacks.address()); // putting into Watcher. because otherwise it might GC im not sure i didnt test
				console.info('cfArrRef:', Watcher.cfArrRef.toString());
				if (Watcher.cfArrRef.isNull()) {
					console.error('Failed cfArrRef');
					throw new Error({
						name: 'os-api-error',
						message: 'Failed CFArrayCreate'
					});
				}
				
				Watcher.paths_watched_props[aOSPath] = thisPObj;
				
				cutils.modifyCStr(Watcher.cStr_ptrOf_cfArrRef, cutils.strOfPtr(Watcher.cfArrRef.address()));
				
				return thisPObj.path_id;

				
			}

		break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
		
				// uses inotify
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
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
					Watcher.cInt_numPaths.value = Watcher.cInt_numPaths.value + 1;
				}
				
				return watch_fd;
				
			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// for winnt, check if aOSPath is a directory, if its not then throw error
}

function removePathFromWatcher(aWatcherID, aOSPath, removeAll) {
	// aOSPath is a jsStr os path
	
	switch (core.os.name) {
		case 'gio':
				
				console.log('gio removePath');
				
			break;
		case 'winnt':

				var Watcher = _Watcher_cache[aWatcherID];
				console.info('Watcher:', JSON.stringify(Watcher));
				if (Object.keys(Watcher.paths_watched).length == ostypes.CONST.MAXIMUM_WAIT_OBJECTS) {
					throw new Error({
						name: 'devuser-error',
						message: 'Already watching maximum number of paths, the Windows API (WaitForMultipleObjectsEx) does not support waiting for more than ' + ostypes.CONST.MAXIMUM_WAIT_OBJECTS + ' paths'
					});
				}
				
				if (!(aOSPath in Watcher.paths_watched)) {
					throw new Error({
						name: 'dev-user-error',
						message: 'Path of "' + aOSPath + '" was never added/watched by this watcher instance'
					});
				}
				
				var targetHandleToRem = Watcher.paths_watched[aOSPath];
				delete Watcher.paths_watched[aOSPath];
				
				var rez_cancel = ostypes.API('CancelIoEx')(targetHandleToRem, null); // use CancelIoEx and not CancelIo because the Ex version cancels in all threads in this process. the non Ex version only works in per thread
				console.info('rez_cancel:', rez_cancel.toString(), uneval(rez_cancel));
				
				if (!rez_cancel) {
					console.error('Failed rez_cancel, winLastError:', ctypes.winLastError);
					var rezCancelWinLastErr = ctypes.winLastError;
					// i should release the handle myself then, as if it was succesful then the PollWorker will release the hDirectory
					
					var rez_CloseHandle = ostypes.API('CloseHandle')(targetHandleToRem);
					if (rez_CloseHandle == false) {
						console.error('Failed to CloseHandle on targetHandleToRem, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed to CancelIoEx on ' + targetHandleToRem.toString() + ' AND it also failed in attempts to close this handle',
							winLastError: rezCancelWinLastErr, // this is the winLastError_CancelIoEx
							winLastError_CloseHandle: ctypes.winLastError
						});
					}
					
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to CancelIoEx on ' + targetHandleToRem.toString(),
						winLastError: rezCancelWinLastErr
					});
				} else {					
					// just release it
					var rez_CloseHandle = ostypes.API('CloseHandle')(targetHandleToRem);
					if (rez_CloseHandle == false) {
						console.error('Failed to CloseHandle on targetHandleToRem, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed to CloseHandle on ' + targetHandleToRem.toString(),
							winLastError: ctypes.winLastError
						});
					}
				}
				// a race condition exists with mainthread watcher-api, in that i ideally dont want to return until the callback triggers in PollWorker thread that remove has completed. however that requires using GetOverlappedResult blocking, and i cant use that here as i dont have access to that overlapped structure, and passing it from there to here is something i dont want to setup right now, i feel the race condition is very very rare. it happens if user removes path then adds it back back to back and IF the callback does not immediately free up in the poll worker (by free up i mean remove from the jsArr the hDir) <<< THIS IS ALL THEORIZING
		
				return cutils.strOfPtr(targetHandleToRem.address());
				
			break;
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
			// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7

			if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 7 /*is old mac*/) {
				// use kqueue
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				if (!(aOSPath in Watcher.paths_watched)) {
					throw new Error({
						name: 'dev-user-error',
						message: 'Path of "' + aOSPath + '" was never added/watched by this watcher instance'
					});
				}
				
				var targetFdToRem = Watcher.paths_watched[aOSPath];
				
				
				// Remove event_fd from list
				delete Watcher.paths_watched[aOSPath];
				delete Watcher.cStr_OSPath_obj[cOSPath];
				
				// start - mod of block link68432130
				var newNumFilesVal = Object.keys(Watcher.paths_watched).length; // can alternatively do Watcher.num_files.value + 1
				
				if (newNumFilesVal == 0 || removeAll) {
					cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, '0'); // causes poll to abort
					Watcher.events_to_monitor = 0; // frees memory? not sure but propbably
				} else {
					
					// i dont change num_files.value until after the new events_to_monitor is created and pointer is set, because if i change this first, then my loop in FSWPollWorker /*link584732*/ might be at a time such that it takes the new num_files and the new events_to_monitor wasnt created and strPtr not set yet, so it will use old events_to_monitor with new num_files number which will probably make kevents throw error in this linked loop
					Watcher.events_to_monitor = ostypes.TYPE.kevent.array(newNumFilesVal)();
					var i = -1;
					for (var cOSPath in Watcher.paths_watched) {
						i++;
						// i have to make udata intptr_t as in bsd the field is inptr_t while in mac it is void*
						
						if (!(cOSPath in Watcher.cStr_OSPath_obj)) {
							Watcher.cStr_OSPath_obj[cOSPath] = ctypes.jschar.array()(cOSPath); // link321354 in FSWPollWorker
						}
						var ptrStr = cutils.strOfPtr(Watcher.cStr_OSPath_obj[cOSPath].address()); //strptr to the c string holding the path
						
						console.error('INFO ptrStr:', ptrStr.toString());
						if (core.os.name == 'darwin') {
							var udata = ctypes.cast(ostypes.TYPE.intptr_t(ptrStr), ostypes.TYPE.void.ptr);
						} else {
							var udata = ostypes.TYPE.intptr_t(ptrStr);
						}
						ostypes.HELPER.EV_SET(Watcher.events_to_monitor.addressOfElement(i), Watcher.paths_watched[cOSPath], ostypes.CONST.EVFILT_VNODE, ostypes.CONST.EV_ADD | ostypes.CONST.EV_CLEAR, Watcher.vnode_events_for_path[cOSPath], 0, udata);
					}
					
					console.log('created NEW after REMOVE event_to_monitor and its address:', cutils.strOfPtr(Watcher.events_to_monitor.address()));
					
					cutils.modifyCStr(Watcher.c_string_of_ptrStr_to_eventsToMonitorArr, cutils.strOfPtr(Watcher.events_to_monitor.address()));
					Watcher.num_files.value = newNumFilesVal; // now after setting this, the next poll loop will find it is different from before
					// end - mod of block link68432130
				}
					
				// Close the file descriptor for the target file/directory - i dont close before removing from list in case the loop happens before i removed it from the event_list. which will likely cause it to crash. so i first remove it from array, then update num_files so on the next loop whenever it happens (even if before close) it will not take the closed fd
				var close_fd = ostypes.API('close')(targetFdToRem);
				console.info('close_fd:', close_fd.toString(), uneval(close_fd));
				if (ctypes.errno != 0) {
					console.error('Failed close_fd, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to close path of "' + aOSPath + '", however it was removed from the watch, so no more events will trigger for this path',
						errno: ctypes.errno
					});
				}
				
				return targetFdToRem; // main-thread currently doesnt need this, it doesnt need aVal at all but doing it to be consisten with addPath
				// end kqueue
			} else {
				// its mac and os.version is >= 10.7
				// use FSEventFramework
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Watcher not found in cache'
					});
				}
				
				if (!(aOSPath in Watcher.paths_watched_props)) {
					throw new Error({
						name: 'dev-user-error',
						message: 'Path of "' + aOSPath + '" was never added/watched by this watcher instance'
					});
				}
				
				var thisPObj = Watcher.paths_watched_props[aOSPath];
				
				delete Watcher.paths_watched_props[aOSPath];			

				// recreate events list without the path we just removed
				
				// start - mod of block link3210255
				var jsStrArr = [];
				// add in old watched paths
				for (var cOSPath in Watcher.paths_watched_props) {
					jsStrArr.push(Watcher.paths_watched_props[cOSPath].cfStr);
				}
				
				if (jsStrArr.length == 0 || removeAll) {
					cutils.modifyCStr(Watcher.cStr_ptrOf_cfArrRef, '0'); // causes poll to abort
					Watcher.cfArrRef = 0; // free memory? probably but not sure
				} else {
				
					var cfStrArr = ostypes.TYPE.void.ptr.array()(jsStrArr);

					Watcher.cfArrRef = ostypes.API('CFArrayCreate')(null, cfStrArr, cfStrArr.length, ostypes.CONST.kCFTypeArrayCallBacks.address()); // putting into Watcher. because otherwise it might GC im not sure i didnt test
					console.info('cfArrRef:', Watcher.cfArrRef.toString());
					if (Watcher.cfArrRef.isNull()) {
						console.error('Failed cfArrRef');
						throw new Error({
							name: 'os-api-error',
							message: 'Failed CFArrayCreate'
						});
					}
					
					cutils.modifyCStr(Watcher.cStr_ptrOf_cfArrRef, cutils.strOfPtr(Watcher.cfArrRef.address()));
				}
				// end - mod of block link3210255
				
				// can now release cfstr, as now if loop happens in PollWorker it takes the new array, so releasing of this cfstr is safe as it wont be called upon
				ostypes.API('CFRelease')(thisPObj.cfStr); // returns void
			
				return thisPObj.path_id; // main-thread currently doesnt need this, it doesnt need aVal at all but doing it to be consisten with addPath
			}

		break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
		
				// uses inotify
				
				var Watcher = _Watcher_cache[aWatcherID];
				if (!Watcher) {
					throw new Error({
						name: 'watcher-api-error',
						message: 'Watcher not found in cache'
					});
				}

				if (!(aOSPath in Watcher.paths_watched)) {
					throw new Error({
						name: 'dev-user-error',
						message: 'Path of "' + aOSPath + '" was never added/watched by this watcher instance'
					});
				}
				
				var targetFdToRem = Watcher.paths_watched[aOSPath];
				
				delete Watcher.paths_watched[aOSPath];
				
				if (removeAll) {
					Watcher.cInt_numPaths.value = 0; // causes poll to abort
				} else {
					Watcher.cInt_numPaths.value = Watcher.cInt_numPaths.value - 1;
				}
				
				var rem_watch_fd = ostypes.API('inotify_rm_watch')(Watcher.fd, targetFdToRem);
				//console.info('rem_watch_fd:', rem_watch_fd.toString(), uneval(rem_watch_fd));
				if (cutils.jscEqual(rem_watch_fd, -1)) {
					console.error('Failed rem_watch_fd, errno:', ctypes.errno);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to inotify_rm_watch',
						errno: ctypes.errno
					});
				}
				
				return targetFdToRem; // main-thread currently doesnt need this, it doesnt need aVal at all but doing it to be consisten with addPath
				
			break;
		default:
			throw new Error({
				name: 'watcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
}

function closeWatcher(aWatcherID) {
	// _Watcher_cache[aWatcherID] = 
	throw new Error('in dev3');
}
// end - OS.File.Watcher API
