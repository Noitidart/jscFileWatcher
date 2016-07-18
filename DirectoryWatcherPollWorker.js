// spawned as ChromeWorker by DirectoryWatcherWorkerSubscript.js
const core = {
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

// import paths
importScripts('../DirectoryWatcherPaths.js');
core.path = directorywatcher_paths;

// import Comm
importScripts(core.path.comm);

// import ostypes
importScripts(core.path.ostypes_dir + 'cutils.jsm');
importScripts(core.path.ostypes_dir + 'ctypes_math.jsm');
switch (core.os.name) {
	case 'winnt':
	case 'winmo':
	case 'wince':
		importScripts(core.path.ostypes_dir + 'ostypes_win.jsm');
		break
	case 'darwin':
		importScripts(core.path.ostypes_dir + 'ostypes_mac.jsm');
		break;
	default:
		// assume gtk based system OR android
		importScripts(core.path.ostypes_dir + 'ostypes_x11.jsm');
}

// Globals
var { callInMainworker } = CommHelper.childworker;

// Init
var gWkComm = new Comm.client.worker();

var gPipe;
var gNextSignalId = 0;
var path_mon_id_collection = {};
var gDWActive = {};
/*
	path: {
		all
			...
		win
			hdir
			o
			lp_index
			notif_buf
			signalid
			signalid_c
		mac
			cfstr - CFString of the path

		gio
			...
		inotify
			...
	}
*/

function init(aArg) {
	var { pipe_ptrstr } = aArg;
	console.log('pipe_ptrstr:', pipe_ptrstr);

	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// Globals
				gPipe = ostypes.TYPE.HANDLE(ctypes.UInt64(pipe_ptrstr));
				console.log('gPipe:', gPipe);
				gLpHandles = [gPipe];
				gLpHandles_c = ostypes.TYPE.HANDLE.array()(gLpHandles);
				// set up a watcher on a gPipe, send to mainthread the gPipe so it can interrupt

				// notification buffer size and length stuff
				WATCHED_RES_MAXIMUM_NOTIFICATIONS = 100; // 100; Dexter uses 100
				NOTIFICATION_BUFFER_SIZE_IN_BYTES = ostypes.TYPE.FILE_NOTIFY_INFORMATION.size * WATCHED_RES_MAXIMUM_NOTIFICATIONS;
				// we need it DWORD aligned - http://stackoverflow.com/a/29555298/1828637
				console.log('pre dword sized NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES)
				while (NOTIFICATION_BUFFER_SIZE_IN_BYTES % ostypes.TYPE.DWORD.size) {
					NOTIFICATION_BUFFER_SIZE_IN_BYTES++;
				}
				NOTIFICATION_DWORD_BUFFER_LENGTH = NOTIFICATION_BUFFER_SIZE_IN_BYTES / ostypes.TYPE.DWORD.size;
				console.log('post dword sized NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES, 'NOTIFICATION_DWORD_BUFFER_LENGTH:', NOTIFICATION_DWORD_BUFFER_LENGTH);

				DW_NOTIFY_FILTER = ostypes.CONST.FILE_NOTIFY_CHANGE_LAST_WRITE | ostypes.CONST.FILE_NOTIFY_CHANGE_FILE_NAME | ostypes.CONST.FILE_NOTIFY_CHANGE_DIR_NAME; // this is what @Dexter used
				winRoutine_c = ostypes.TYPE.FileIOCompletionRoutine.ptr(winRoutine);

			break;
		case 'darwin':

				gRunLoop = ostypes.API('CFRunLoopGetCurrent')();

				gCfHandles = []; // each element is the cfstr in gDWActive
				gCfHandles_c = null; // ostypes.TYPE.void.ptr.array()(gCfHandles);
				gCfHandles_cf = null; // ostypes.API('CFArrayCreate')(null, gCfHandles_c, gCfHandles.length, ostypes.CONST.kCFTypeArrayCallBacks.address());

				gStream = null;

				macRoutine_c = ostypes.TYPE.FSEventStreamCallback(macRoutine);

				return {
					runloop_ptrstr: cutils.strOfPtr(gRunLoop)
				};

			break;
		default:
			// do nothing special
	}
}

// start functionality
function addPath(aArg) {
	// returns
		// true - successfully added
		// false - already there
		// undefined - error
	var { aPath } = aArg;

	var path_info = dwGetActiveInfo(aPath);

	if (path_info) {
		console.warn('already watching aPath:', aPath);
		return false;
	}

	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				var hdir = ostypes.API('CreateFile')(aPath, ostypes.CONST.FILE_LIST_DIRECTORY, ostypes.CONST.FILE_SHARE_READ | ostypes.CONST.FILE_SHARE_WRITE | ostypes.CONST.FILE_SHARE_DELETE, null, ostypes.CONST.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_BACKUP_SEMANTICS | ostypes.CONST.FILE_FLAG_OVERLAPPED, null);
				var o = ostypes.TYPE.OVERLAPPED();

				var notif_buf = ostypes.TYPE.DWORD.array(NOTIFICATION_DWORD_BUFFER_LENGTH)(); //ostypes.TYPE.DWORD.array(NOTIFICATION_BUFFER_SIZE_IN_BYTES)(); // im not sure about the 4096 ive seen people use that and 2048 im not sure why
				console.info('notif_buf.constructor.size:', notif_buf.constructor.size, 'this SHOULD BE same as NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES);
				if (notif_buf.constructor.size != NOTIFICATION_BUFFER_SIZE_IN_BYTES) {
					console.error('please email noitidart@gmail.com about this error. notif_buf is of a size i dont expect', 'notif_buf.constructor.size:', notif_buf.constructor.size, 'this SHOULD HAVE BEEN same as NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES)
					startPoll();
					return undefined;
				}

				var signalid = gNextSignalId++;
				var signalid_c = ctypes.uint16_t(signalid);

				// hEvent is equivalent of user_data in Gio/Gtk
				o.hEvent = ctypes.cast(signalid_c.address(), ctypes.voidptr_t);

				// var lp_index = gLpHandles.length;
				// gLpHandles.push(hdir);
				// gLpHandles_c = ostypes.TYPE.HANDLE.array()(gLpHandles);

				var rez_rdc = ostypes.API('ReadDirectoryChanges')(hdir, notif_buf.address(), NOTIFICATION_BUFFER_SIZE_IN_BYTES, false, DW_NOTIFY_FILTER, null, o.address(), winRoutine_c);
				console.log('rez_rdc:', rez_rdc);

				if (!rez_rdc) {
					// failed to add due to error
					console.error('failed to add watcher due to error:', ctypes.winLastError);
					startPoll();
					return undefined;
				} else {
					// gDWActive[aPath] = { hdir, o, lp_index, notif_buf, signalid, signalid_c };
					gDWActive[aPath] = { hdir, o, notif_buf, signalid, signalid_c };
					startPoll();
					return true;
				}
			break;
		case 'darwin':

				var cfstr = ostypes.HELPER.makeCFStr(aPath);

				var new_cfhandles = [];
				for (var a_path in gDWActive) {
					var a_path_entry = gDWActive[a_path];
					new_cfhandles.push(a_path_entry.cfstr);
				}
				new_cfhandles.push(cfstr);

				var rez_reset = macResetStream(new_cfhandles);
				console.log('rez_reset:', rez_reset);

				if (rez_reset) {
					// ok succesfully added
					gDWActive[aPath] = { cfstr };
					startPoll();
					return true;
				} else {
					ostypes.API('CFRelease')(cfstr);
					return rez;
				}

			break;
	}
}

function removePath(aArg) {
	// returns
		// true - successfully removed
		// false - wasnt there
		// undefined - error
	var { aPath } = aArg;

	console.log('poll worker - removePath, aPath:', aPath);

	var path_info = dwGetActiveInfo(aPath);
	if (!path_info) {
		console.warn('was not watching aPath:', aPath);
		startPoll();
		return false;
	}
	var path_entry = path_info.entry;

	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				var { hdir } = path_entry;

				// // stop watching this by removing it from gLpHandles/gLpHandles_c
				// // remove from gLpHandles
				// gLpHandles.splice(lp_index, 1);
				// gLpHandles_c = ostypes.TYPE.HANDLE.array()(gLpHandles);
				//
				// // decrement lp_index of all other paths that were above lp_index
				// for (var a_path in gDWActive) {
				// 	var a_path_entry = gDWActive[a_path];
				// 	if (a_path_entry.lp_index > lp_index) {
				// 		a_path_entry.lp_index--;
				// 	}
				// }

				// cancel apc
				var rez_cancelio = ostypes.API('CancelIo')(hdir); // dont need CancelIoEx as im in the same thread
				console.log('rez_cancelio:', rez_cancelio);

				if (!rez_cancelio) {
					// if fail here, its just bad for memory
					console.error('failed to cancelio on path:', aPath, 'due to error:', ctypes.winLastError);
					// it is still being watched
					startPoll();
					return undefined;
				} else {
					path_entry.removed = 'notyet'; // will be set by winRoutine in ERROR_OPERATION_ABORTED
					while (path_entry.removed == 'notyet') {
						var rez_sleep = ostypes.API('SleepEx')(ostypes.CONST.INFINITE, true);
						// the winRoutine for ERROR_OPERATION_ABORTED will trigger first, then the next line for console logging `rez_sleep` will happen
						console.log('rez_sleep:', rez_sleep);
					}

					if (!cutils.jscEqual(rez_sleep, ostypes.CONST.WAIT_IO_COMPLETION)) {
						console.error('rez_sleep is not WAIT_IO_COMPLETION! it is:', rez_sleep);
					}

					if (Object.keys(gDWActive).length) {
						startPoll();
					} else {
						console.log('poller worker - after cancel - not resuming poll as there are no pathts to watch');
						clearTimeout(gStartPollTimeout); // in case there is a left over from back to back `removePath`'s and the 2nd to last triggered a `startPoll()`
					}

					console.log('poll worker - removePath result:', path_entry.removed);
					return path_entry.removed;
				}
			break;
		case 'darwin':

				// create new array with all EXCEPT aPath entry
				var new_cfhandles = [];
				for (var a_path in gDWActive) {
					if (a_path != aPath) {
						var a_path_entry = gDWActive[a_path];
						new_cfhandles.push(a_path_entry.cfstr);
					}
				}

				if (new_cfhandles.length) {
					var rez_reset = macResetStream(new_cfhandles);

					if (rez_reset) {
						delete gDWActive[aPath];
						ostypes.API('CFRelease')(path_entry.cfstr);
					}

					startPoll();
					return rez_reset;
				} else {
					macReleaseGlobals();
					gCfHandles = [];

					console.log('not watching anymore paths so will not restart poll');

					return true;
				}

			break;
	}
}

function poll() {
	// console.log('poll entered');
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				console.log('starting wait');
				var rez_wait = ostypes.API('WaitForMultipleObjectsEx')(gLpHandles.length, gLpHandles_c, false, ostypes.CONST.INFINITE, true);
				console.log('rez_wait:', rez_wait);
				// if (cutils.jscEqual(rez_wait, 0)) {
				// 	// its the gPipe interrupt, so dont restart the loop
				// } else {
				// 	// i get 192 when my file watcher triggers, dont restart poll here as it will keep returning with `1` or the index of the one that triggered, i have to reset the signal by calling ReadDirectoryChanges again
				// }
			break;
		case 'darwin':

				console.log('starting wait');
				ostypes.API('CFRunLoopRun')();
				console.log('wait done');

			break;
	}
}

function macReleaseGlobals() {
	// release globals
	if (gCfHandles_c) { // on init or when 0 paths watched, gCfHandles_c and gCfHandles_cf is null
		// clean up the old handles
		ostypes.API('CFRelease')(gCfHandles_cf);
		gCfHandles_cf = null;
		gCfHandles_c = null;
	}
	if (gStream) {
		macReleaseStream(gStream, false);
		gStream = null;
	}
}

function macReleaseStream(aStream, aNotStarted) {

	ostypes.API('FSEventStreamUnscheduleFromRunLoop')(aStream, gRunLoop, ostypes.CONST.kCFRunLoopDefaultMode);

	if (!aNotStarted) {
		ostypes.API('FSEventStreamStop')(aStream);
	}

	ostypes.API('FSEventStreamInvalidate')(aStream);
	// just doing FSEventStreamStop and FSEventStreamInvalidate will make runLoopRun break but we want to totally clean up the stream as we dont want it anymore as we are making a new one
	ostypes.API('FSEventStreamRelease')(aStream);
}

function macResetStream(aNewCfHandles) {
	// aNewCfHandles is what you want gCfHandles on success
	// on success the globals are updated (gCfHandles, gCfHandles_c, gCfHandles_cf, gStream)

	// returns
		// true - success
		// false -
		// undefined - if error

	var rez;

	var new_cfhandles_c = ostypes.TYPE.void.ptr.array()(aNewCfHandles);
	var new_cfhandles_cf = ostypes.API('CFArrayCreate')(null, new_cfhandles_c, aNewCfHandles.length, ostypes.CONST.kCFTypeArrayCallBacks.address());
	if (new_cfhandles_cf.isNull()) {
		console.error('failed to create cf arr!');

		// clean up new_'s
		new_cfhandles_c = null;

		// return
		rez = undefined;
	} else {
		// create the new stream
		var new_stream = ostypes.API('FSEventStreamCreate')(ostypes.CONST.kCFAllocatorDefault, macRoutine_c, null, new_cfhandles_cf, ostypes.TYPE.UInt64(ostypes.CONST.kFSEventStreamEventIdSinceNow), 0, ostypes.CONST.kFSEventStreamCreateFlagWatchRoot | ostypes.CONST.kFSEventStreamCreateFlagFileEvents | ostypes.CONST.kFSEventStreamCreateFlagNoDefer);
		console.log('new_stream:', new_stream);
		if (new_stream.isNull()) { // i have seen this null when new_cfhandles_cf had no paths added to it, so was an empty aNewCfHandles/new_cfhandles_c
			console.error('Failed FSEventStreamCreate!! Aborting as in not re-starting poll');

			// clean up new_'s
			ostypes.API('CFRelease')(new_cfhandles_cf);
			new_cfhandles_cf = null;
			new_cfhandles_c = null;

			// return
			rez = undefined;
		} else {

			// schedule it on gRunLoop in default mode for CFrunLoopRun
			ostypes.API('FSEventStreamScheduleWithRunLoop')(new_stream, gRunLoop, ostypes.CONST.kCFRunLoopDefaultMode); // returns void

			// start the stream
			var rez_startstream = ostypes.API('FSEventStreamStart')(new_stream);
			console.log('rez_startstream:', rez_startstream);
			if (!rez_startstream) {
				console.error('Failed FSEventStreamStart! Aborting - as in will not restart poll');

				// clean up new_'s
				macReleaseStream(new_stream, true);
				ostypes.API('CFRelease')(new_cfhandles_cf);
				new_cfhandles_cf = null;
				new_cfhandles_c = null;

				// return
				rez = undefined;
			} else {
				// return
				rez = true;
			}
		}
	}


	if (rez) {
		macReleaseGlobals();

		// update globals
		gCfHandles = aNewCfHandles;
		gCfHandles_c = new_cfhandles_c;
		gCfHandles_cf = new_cfhandles_cf;
		gStream = new_stream;
	};

	return rez;
}

function macRoutine(streamRef, clientCallBackInfo, numEvents, eventPaths, eventFlags, eventIds) {
	console.log('in macRoutine:', 'streamRef:', streamRef, 'clientCallBackInfo:', clientCallBackInfo, 'numEvents:', numEvents, 'eventPaths:', eventPaths, 'eventFlags:', eventFlags, 'eventIds:', eventIds);

	// i need to read the args within this callback, the docs say that at the end of this callback the args are released, so if i had sent this to the mainworker `oshandler` it would read released memory and probably crash
	// the other reason i need to read here is because i dont have a signalid for mac, so i have to figure out the `path` by checking the parent dir of the events
	// TODO: think about how to deal with subdirs, here are some notes:
		// also mac seems to read subdirs, so i want to not alert on subdirs to match behavior of inotify. windows also does read subdirs. but my plan is, if user later adds a subdir, rather then creating a new watch, just dont discard those subdirs
		// IMPORTANT: DO NOT discard subdirs here, send it to mainworker and `oshandler` will determine if should discard subdir

	// js version
	var _numevents = parseInt(cutils.jscGetDeepest(numEvents));

	// these arguments are pointers, lets get the c contents
	var _eventpaths_c = ctypes.cast(eventPaths, ostypes.TYPE.char.ptr.array(_numevents).ptr).contents;
	var _eventflags_c = ctypes.cast(eventFlags, ostypes.TYPE.FSEventStreamEventFlags.array(_numevents).ptr).contents;
	var _eventids_c = ctypes.cast(eventIds, ostypes.TYPE.FSEventStreamEventId.array(_numevents).ptr).contents;

	// lets turn all the c contents, into js arrays with js values
	// var cutilsIter = (arr_c, actor) => { var arr = new Array(arr_c.length); arr.forEach( (_, i) => arr[i]=actor(arr_c[i]) ); return arr; } // wont work due to bug https://bugzilla.mozilla.org/show_bug.cgi?id=1287357
	var cutilsIter = (arr_c, actor) => { var l=arr_c.length; var arr=new Array(l); for(var i=0; i<l; i++) { arr[i]=actor(arr_c[i]) }; return arr; }
	var _eventpaths = cutilsIter( _eventpaths_c, el=>el.readString() );
	var _eventflags = cutilsIter( _eventflags_c, el=>parseInt(cutils.jscGetDeepest(el)) );
	var _eventids = cutilsIter( _eventids_c, el=>parseInt(cutils.jscGetDeepest(el)) );

	console.log('macRoutine args as js:', '_numevents:', _numevents, '_eventids:', _eventids, '_eventflags:', _eventflags, '_eventpaths:', _eventpaths);
}

function winRoutine(dwErrorCode, dwNumberOfBytesTransfered, lpOverlapped) {
	console.log('in winRoutine:', 'dwErrorCode:', dwErrorCode, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'lpOverlapped:', lpOverlapped);

	// get signalid
	var signalid = ctypes.cast(lpOverlapped.contents.hEvent, ctypes.uint16_t.ptr).contents;
	console.log('signalid:', signalid);

	// get watcher_entry and path_entry
	var path_info = dwGetActiveInfo(signalid);
	if (!path_info) {
		console.error('what on earth? this should never happen! no path_info for signalid! this is bad!! aborting all watching in this worker');
		throw new Error('what on earth? this should never happen! no path_info for signalid! this is bad!! aborting all watching in this worker');
	}

	var {entry:path_entry, path} = path_info;
	// console.log('path:', path);

	if (cutils.jscEqual(dwErrorCode, 0)) {
		// ok no error, so a file change happened

		// get notif_buf
		var notif_buf = path_entry.notif_buf;

		// inform mainworker oshandler
		callInMainworker('dwCallOsHandlerById', {
			path,
			rest_args: [dwNumberOfBytesTransfered, cutils.strOfPtr(notif_buf.address())]
		});

		var new_notif_buf = ostypes.TYPE.DWORD.array(NOTIFICATION_DWORD_BUFFER_LENGTH)(); // must use new notif_buf to avoid race conditions per - "However, you have to make sure that you use a different buffer than your current call or you will end up with a race condition." - https://qualapps.blogspot.com/2010/05/understanding-readdirectorychangesw_19.html
		path_entry.notif_buf = new_notif_buf;

		// retrigger ReadDirectoryChanges on this hdir, otherwise WaitForMultipleObjectsEx will return immediately with index of this hdir in gLpHandles
		var rez_rdc = ostypes.API('ReadDirectoryChanges')(path_entry.hdir, path_entry.notif_buf.address(), NOTIFICATION_BUFFER_SIZE_IN_BYTES, false, DW_NOTIFY_FILTER, null, path_entry.o.address(), winRoutine_c);
		console.log('rez_rdc:', rez_rdc);

		if (!rez_rdc) {
			// failed to re-watch
			console.error('ABORTING DUE TO UNEXPECTED ERROR!! failed to re-watch due to error:', ctypes.winLastError);
		} else {
			startPoll();
		}
	} else if (cutils.jscEqual(dwErrorCode, ostypes.CONST.ERROR_OPERATION_ABORTED)) {
		// this one was canceled via CancelIo so lets release the handle
		console.log('in callback - CANCELLED via CancelIo');

		var { hdir } = path_entry;

		// close handle
		var rez_closehandle = ostypes.API('CloseHandle')(hdir);
		console.log('rez_closehandle:', rez_closehandle);

		// remove from active paths as it was succesully unwatched
		delete gDWActive[path];

		if (!rez_closehandle) {
			// if fail here, it should be ok, its just bad for memory
			console.error('failed to closehandle on path:', aPath, 'due to error:', ctypes.winLastError);
			path_entry.removed = true;
		} else {
			// succesfully removed path
			path_entry.removed = true;
		}
	} else {
		console.error('UNKNOWN ERROR!!!! dwErrorCode:', dwErrorCode);
	}
}

var gStartPollTimeout;
function startPoll() {
	clearTimeout(gStartPollTimeout);
	gStartPollTimeout = setTimeout(poll, 0);
}

function dwGetActiveInfo(aBy) {
	// aBy
		// string - path - platform path of directory watched
		// int - signalid

	// returns
		// undefined if not found
		// `{path, entry}` where `entry` in `gDWActive` by reference

	if (typeof(aBy) == 'string') {
		if (!gDWActive[aBy]) {
			return undefined;
		} else {
			return { path:aBy, entry:gDWActive[aBy] };
		}
	} else {
		for (var path in gDWActive) {
			var path_entry = gDWActive[path];
			if (path_entry.signalid === aBy) {
				return { path, entry:path_entry };
			}
		}
	}
}

// start - common helper functions
function Deferred() {
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// end - common helper functions
