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
			core.os.verison = 10.6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
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

	return true;
}

function poll(aArgs) {
	switch (core.os.name) {
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
			// uses kqueue for core.os.version < 10.7 and FSEventFramework for core.os.version >= 10.7

			if (core.os.version < 10.7) {
				// use kqueue
				
				var kq = aArgs.kq;				
				
				// The address in user_data will be copied into a field in the event. If you are monitoring multiple files,you could,for example,pass in different data structure for each file.For this example,the path string is used.
				var user_data = aOSPath;

				// Set the timeout to wake us every half second.
				var timeout = ostypes.TYPE.timespec();
				var useSec = 0;
				var useNsec = 500000000;
				timeout.tv_sec = useSec; // 0 seconds
				timeout.tv_nsec = useNsec; // 500 milliseconds
				
				// Handle events
				var last_num_files = -1;
				var num_files;
				
				var events_to_monitor;
				var event_data;// = ostypes.TYPE.kevent.array(ostypes.CONST.NUM_EVENT_SLOTS)();
				
				var continue_loop = Infinity; // monitor forever // 40; // Monitor for twenty seconds. // ostypes.TYPE.int
				while (--continue_loop) {
					num_files = ostypes.int.ptr(ctypes.UInt64(aArgs.num_files_ptrStr)).contents; // i think i have to read pointer every time, i dont know im not sure, maybe once i have it i can just read it and when its updated in another thread it updates here i dont know i have to test
					if (num_files.value != last_num_files) { /*link584732*/
						last_num_files = num_files.value;
						events_to_monitor = ostypes.TYPE.kevent.array(num_files.value).ptr(ctypes.UInt64(aArgs.num_files_ptrStr));
						event_data = ostypes.TYPE.kevent.array(num_files.value)();
					}
					/*
					if (num_files.value == 0) {
						// num_files is 0 so no need to make call to kevent
						continue;
					} else {
					*/ // commented out as otherwise i have to make it setTimeout for half second // i also dont want to make this an infinite poll, as after addPath i need to update kevent arguments, which i do by reading hte num_files_ptrStr
						// there is at least 1 file to watch
						var event_count = ostypes.API('kevent')(Watcher.kq, events_to_monitor.address(), num_files, event_data.address(), num_files, timeout.address());
						console.info('event_count:', event_count.toString(), uneval(event_count));
						if (ctypes.errno !== 0) {
							console.error('Failed event_count, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
							throw new Error({
								name: 'os-api-error',
								message: 'Failed to event_count due to failed kevent call',
								uniEerrno: ctypes.errno
							});
						}
						if (cutils.jscEqual(event_data.addressOfElement(0).contents.flags, ostypes.CONST.EV_ERROR)) {
							console.error('Failed event_count, due to event_data.flags == EV_ERROR, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
							throw new Error({
								name: 'os-api-error',
								message: 'Failed to event_count despite succesful kevent call due to event_data.flags == EV_ERROR',
								uniEerrno: ctypes.errno
							});
						}

						if (!cutils.jscEqual(event_count, 0)) {
							// something happend
							console.log('Event ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.ident) + ' occurred. Filter ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.filter) + ', flags ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.flags) + ', filter flags ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.fflags) + ', filter data ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.data) + ', path ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.udata /*.contents.readString()*/ ));
						} else {
							// No event
						}

						// Reset the timeout. In case of a signal interrruption, the values may change.
						timeout.tv_sec = useSec; // 0 seconds
						timeout.tv_nsec = useNsec; // 500 milliseconds
					/*
					}
					*/
				}
				ostypes.API('close')(event_fd);
				return 0;
				
			// end kqueue
			} else {
				// os.version is >= 10.7
				// use FSEventFramework
			}

		break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
			{
				// uses inotify
				console.log('ok in pollThis of nixPoll');
				let fd = aArgs.fd;
				
				var sizeUnaligned_inotify_event = 
					ostypes.TYPE.inotify_event.fields[0].wd.size + 
					ostypes.TYPE.inotify_event.fields[1].mask.size + 
					ostypes.TYPE.inotify_event.fields[2].cookie.size + 
					ostypes.TYPE.inotify_event.fields[3].len.size + 
					ostypes.TYPE.inotify_event.fields[4].name.size; // has built in length of MAX_NAME + 1 (the + 1 is for null terminator)
				var size_inotify_event = ostypes.TYPE.inotify_event.size;
				var sizeField0 = ostypes.TYPE.inotify_event.fields[0].wd.size;
				var sizeField1 = ostypes.TYPE.inotify_event.fields[1].mask.size;
				var sizeField2 = ostypes.TYPE.inotify_event.fields[2].cookie.size;
				var sizeField3 = ostypes.TYPE.inotify_event.fields[3].len.size;
				var sizeField4 = ostypes.TYPE.inotify_event.fields[4].name.size;
				
				console.info('sizeUnaligned_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('size_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('sizeField4:', sizeField4.toString());
				
				let count = size_inotify_event * 10; // a single read can return an array of multiple elements, i set max to 10 elements of name with NAME_MAX, but its possible to get more then 10 returned as name may not be NAME_MAX in length for any/all of the returned's
				let buf = ctypes.ArrayType(ostypes.TYPE.char, count)(); // docs page here http://linux.die.net/man/7/inotify says sizeof(struct inotify_event) + NAME_MAX + 1 will be sufficient to read at least one event.
				
				console.log('starting the loop, fd:', fd, 'count:', count);
				count = ostypes.TYPE.size_t(count); // for use with read
				let length = ostypes.API('read')(fd, buf, count);

				length = parseInt(cutils.jscGetDeepest(length));
				console.info('length read:', length, length.toString(), uneval(length));
				
				if (cutils.jscEqual(length, -1)) {
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to read during poll',
						uniEerrno: ctypes.errno
					});
				} else if (!cutils.jscEqual(length, 0)) {
					// then its > 0 as its not -1
					// something happend, read struct
					let changes = [];
					let i = 0;
					var numElementsRead = 0;
					console.error('starting loop');
					length = parseInt(cutils.jscGetDeepest(length));
					do {
						numElementsRead++;
						let casted = ctypes.cast(buf.addressOfElement(i), ostypes.TYPE.inotify_event.ptr).contents;
						console.log('casted:', casted.toString());
						let fileName = casted.addressOfField('name').contents.readString();
						let mask = casted.addressOfField('mask').contents; // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let len = casted.addressOfField('len').contents; // need to iterate to next item that was read in // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let cookie = casted.addressOfField('cookie').contents; // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let wd = casted.addressOfField('wd').contents; // ostypes.TYPE.int which is ctypes.int so no need to get deepest, its already a number
						
						console.info('aFileName:', fileName, 'aEvent:', convertFlagsToAEventStr(mask), 'len:', len, 'cookie:', cookie);
						let rezObj = {
							aFileName: fileName,
							aEvent: convertFlagsToAEventStr(mask),
							aExtra: {
								nixInotifyFlags: mask, // i should pass this, as if user did modify the flags, they might want to figure out what exactly changed
								nixInotifyWd: wd
							}
						}

						if (cookie !== 0) {
							rezObj.aExtra.nixInotifyCookie = cookie;
						}
						changes.push(rezObj);
						if (len == 0) {
							break;
						};
						i += sizeField0 + sizeField1 + sizeField2 + sizeField3 + parseInt(len);
						console.info('incremented i is now:', i, 'length:', length, 'incremented i by:', (sizeField0 + sizeField1 + sizeField2 + sizeField3 + parseInt(len)));
					} while (i < length);
					
					console.error('loop ended:', 'numElementsRead:', numElementsRead);
					
					return changes;
				}
			}
			break;
		default:
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}

function convertFlagsToAEventStr(flags) {
	switch (core.os.name) {
		case 'darwin':
		case 'freebsd':
		case 'openbsd':
		
				if (core.os.name != 'darwin' /*is bsd*/ || core.os.version < 10.7 /*is old mac*/) {
			
					// kqueue
					
					var default_flags = { // shoud be whatever is passed in FSWatcherWorker.js addPathToWatcher function
						NOTE_WRITE: 'contents-modified',
						IN_MOVED_TO: 'renamed-to',
						NOTE_DELETE: 'deleted',
						IN_MOVED_FROM: 'renamed-from',
						IN_CREATE: 'created',
						NOTE_EXTEND: 'note extended - i dont know what this action entails'.
						NOTE_LINK: 'note link - i dont know what this action entails',
						NOTE_UNLINK: 'note unlink - i dont know what this action entails',
						NOTE_REVOKE: 'note revoke - i dont know what this action entails',
					};
					for (var f in default_flags) {
						if (flags & ostypes.CONST[f]) {
							return default_flags[f];
						}
					}
					return 'UNKNOWN FLAG';
				} else {
					// its mac and os.version is >= 10.7
					// use FSEventFramework
				}
				
			break;
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
		
				var default_flags = { // shoud be whatever is passed in FSWatcherWorker.js addPathToWatcher function
					IN_CLOSE_WRITE: 'contents-modified',
					IN_MOVED_TO: 'renamed-to',
					IN_DELETE: 'deleted',
					IN_MOVED_FROM: 'renamed-from',
					IN_CREATE: 'created'
				};
				for (var f in default_flags) {
					if (flags & ostypes.CONST[f]) {
						return default_flags[f];
					}
				}
				return 'UNKNOWN FLAG';

			break;
		default:
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}