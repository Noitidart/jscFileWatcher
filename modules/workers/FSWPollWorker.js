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
				var sizeField4 = ostypes.TYPE.inotify_event.fields[4].name.size;
				
				console.info('sizeUnaligned_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('size_inotify_event:', sizeUnaligned_inotify_event.toString());
				console.info('sizeField4:', sizeField4.toString());
				
				let count = size_inotify_event * 10; // a single read can return an array of multiple elements, i set max to 10 elements of name with NAME_MAX, but its possible to get more then 10 returned as name may not be NAME_MAX in length for any/all of the returned's
				let buf = ctypes.ArrayType(ostypes.TYPE.char, count)(); // docs page here http://linux.die.net/man/7/inotify says sizeof(struct inotify_event) + NAME_MAX + 1 will be sufficient to read at least one event.
				
				console.log('starting the loop, fd:', fd, 'count:', count);
				count = ostypes.TYPE.size_t(count); // for use with read
				let length = ostypes.API('read')(fd, buf, count);

				console.info('length read:', length.toString());
				
				if (cutils.jscEqual(length, -1)) {
					throw new Error({
						name: 'os-api-error',
						message: 'Failed to read during poll',
						errno: ctypes.errno
					});
				} else if (!cutils.jscEqual(length, 0)) {
					// then its > 0 as its not -1
					// something happend, read struct
					let changes = [];
					let i = 0;
					var numElementsRead = 0;
					console.error('starting loop');
					do {
						numElementsRead++;
						let casted = ctypes.cast(buf.addressOfElement(i), ostypes.TYPE.inotify_event.ptr).contents;
						console.log('casted:', casted.toString());
						let fileName = casted.addressOfField('name').contents.readString();
						let mask = casted.addressOfField('mask').contents; // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let len = casted.addressOfField('len').contents; // need to iterate to next item that was read in // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let cookie = casted.addressOfField('cookie').contents; // ostypes.TYPE.uint32_t which is ctypes.uint32_t so no need to get deepest, its already a number
						let wd = casted.addressOfField('cookie').contents; // ostypes.TYPE.int which is ctypes.int so no need to get deepest, its already a number
						
						console.info('aFileName:', fileName, 'aEvent:', convertFlagsToAEventStr(mask), 'len:', len, 'cookie:', cookie);
						let rezObj = {
							aFileName: fileName,
							aEvent: convertFlagsToAEventStr(mask),
							aExtra: {
								aEvent_inotifyFlags: mask, // i should pass this, as if user did modify the flags, they might want to figure out what exactly changed
								aEvent_inotifyWd: wd
							}
						}

						if (cookie !== 0) {
							rezObj.aExtra.aEvent_inotifyCookie = cookie;
						}
						changes.push(rezObj);
						i += ostypes.TYPE.inotify_event.size + (+casted.addressOfField('len').contents);
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
		case 'linux':
		case 'webos': // Palm Pre // im guessng this has inotify, untested
		case 'android': // im guessng this has inotify, untested
			var default_flags = { // shoud be whatever is passed in FSWatcherWorker.js addPathToWatcher function
				'IN_CLOSE_WRITE': 'contents-modified',
				'IN_MOVED_TO': 'renamed-to',
				'IN_MOVED_FROM': 'renamed-from',
				'IN_CREATE': 'created',
				'IN_DELETE': 'deleted'
			};
			for (var f in default_flags) {
				if (flags & ostypes.CONST[f]) {
					return default_flags[f];
				}
			}
			return 'blah'

			break;
		default:
			throw new Error({
				name: 'jscfilewatcher-api-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}