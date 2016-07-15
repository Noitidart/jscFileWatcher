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
var Stuff = {};

// Init
var gWkComm = new Comm.client.worker();
var pollerid;
var sessionid;
var pipe;
var path_mon_id_collection = {};
var next_signalid = 0;
// key is watcherid
// value is object:
// {
// 	data: {
// 		// win
//
// 		// mac
//
// 		// inotify
// 	},
// 	paths: {
// 		path: {
// 			// win
//				hdir
//				o
//				lp_index
//				notif_buf
// 			// mac
//
// 			// inotify
//
// 			// gtk
// 			signalerid
// 			mon
// 		}
// 	}
// }


function init(aArg) {
	({ pollerid, sessionid, pipe_ptrstr } = aArg);
	console.log('pollerid:', pollerid, 'sessionid:', sessionid, 'pipe_ptrstr:', pipe_ptrstr);

	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// Globals
				// pipe = ostypes.API('CreateFile')('\\\\.\\pipe\\dirwatcher' + sessionid + pollerid, ostypes.CONST.GENERIC_READ, ostypes.CONST.FILE_SHARE_READ, null, OS.Constants.Win.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_OVERLAPPED, null);
				pipe = ostypes.TYPE.HANDLE(ctypes.UInt64(pipe_ptrstr));
				console.log('pipe:', pipe);
				LP_HANDLES = [pipe];
				LP_HANDLES_C = ostypes.TYPE.HANDLE.array()(LP_HANDLES);
				// set up a watcher on a pipe, send to mainthread the pipe so it can interrupt

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
				winHandler_c = ostypes.TYPE.FileIOCompletionRoutine.ptr(winHandler);


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
	var { aPath, aWatcherId } = aArg;

	var watcher_entry = path_mon_id_collection[aWatcherId];
	if (!watcher_entry) {
		watcher_entry = path_mon_id_collection[aWatcherId] = {
			data: {
				watcherid_c: ctypes.uint16_t(aWatcherId)
			},
			paths: {}
		};
	}
	if (watcher_entry.paths[aPath]) {
		console.warn('already watching aPath:', aPath);
		return false;
	}

	var hdir = ostypes.API('CreateFile')(aPath, ostypes.CONST.FILE_LIST_DIRECTORY, ostypes.CONST.FILE_SHARE_READ | ostypes.CONST.FILE_SHARE_WRITE | ostypes.CONST.FILE_SHARE_DELETE, null, ostypes.CONST.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_BACKUP_SEMANTICS | ostypes.CONST.FILE_FLAG_OVERLAPPED, null);
	var o = ostypes.TYPE.OVERLAPPED();

	var notif_buf = ostypes.TYPE.DWORD.array(NOTIFICATION_DWORD_BUFFER_LENGTH)(); //ostypes.TYPE.DWORD.array(NOTIFICATION_BUFFER_SIZE_IN_BYTES)(); // im not sure about the 4096 ive seen people use that and 2048 im not sure why
	console.info('notif_buf.constructor.size:', notif_buf.constructor.size, 'this SHOULD BE same as NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES);
	if (notif_buf.constructor.size != NOTIFICATION_BUFFER_SIZE_IN_BYTES) {
		console.error('please email noitidart@gmail.com about this error. notif_buf is of a size i dont expect', 'notif_buf.constructor.size:', notif_buf.constructor.size, 'this SHOULD HAVE BEEN same as NOTIFICATION_BUFFER_SIZE_IN_BYTES:', NOTIFICATION_BUFFER_SIZE_IN_BYTES)
		setTimeout(poll, 0); // resume poll after return
		return undefined;
	}

	var signalid = next_signalid++;
	var signalid_c = ctypes.uint16_t(signalid);

	// hEvent is equivalent of user_data in Gio/Gtk
	o.hEvent = ctypes.cast(signalid_c.address(), ctypes.voidptr_t);

	var lp_index = LP_HANDLES.length;
	LP_HANDLES.push(hdir);
	LP_HANDLES_C = ostypes.TYPE.HANDLE.array()(LP_HANDLES);

	var rez_rdc = ostypes.API('ReadDirectoryChanges')(hdir, notif_buf.address(), NOTIFICATION_BUFFER_SIZE_IN_BYTES, false, DW_NOTIFY_FILTER, null, o.address(), winHandler_c);
	console.log('rez_rdc:', rez_rdc);

	if (!rez_rdc) {
		// failed to add due to error
		console.error('failed to add watcher due to error:', ctypes.winLastError);
		setTimeout(poll, 0); // resume poll after return
		return undefined;
	} else {
		watcher_entry.paths[aPath] = { hdir, o, lp_index, notif_buf, signalid, signalid_c };
		setTimeout(poll, 0); // resume poll after return
		return true;
	}
}

function poll() {
	// console.log('poll entered');
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				console.log('starting wait');
				var rez_wait = ostypes.API('WaitForMultipleObjectsEx')(LP_HANDLES.length, LP_HANDLES_C, false, ostypes.CONST.INFINITE, true);
				console.log('rez_wait:', rez_wait);
				// if (cutils.jscEqual(rez_wait, 0)) {
				// 	// its the pipe interrupt, so dont restart the loop
				// } else {
				// 	// i get 192 when my file watcher triggers, dont restart poll here as it will keep returning with `1` or the index of the one that triggered, i have to reset the signal by calling ReadDirectoryChanges again
				// }
			break;
	}
}

function winHandler(dwErrorCode, dwNumberOfBytesTransfered, lpOverlapped) {
	console.log('in winRoutine:', 'dwErrorCode:', dwErrorCode, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'lpOverlapped:', lpOverlapped);

	// get signalid
	var signalid = ctypes.cast(lpOverlapped.contents.hEvent, ctypes.uint16_t.ptr).contents;
	console.log('signalid:', signalid);

	// get watcher_entry and path_entry
	var watcher_entry;
	var path_entry;
	var path;
	var watcherid;
	get_entries: {
		for (var a_watcherid in path_mon_id_collection) {
			var a_watcher_entry = path_mon_id_collection[a_watcherid].paths;
			for (var a_path in a_watcher_entry) {
				var a_path_entry = a_watcher_entry[a_path];
				if (a_path_entry.signalid === signalid) {
					path_entry = a_path_entry;
					path = a_path;
					watcher_entry = a_watcher_entry;
					watcherid = a_watcherid;
					break get_entries;
				}
			}
		}
	}
	// console.log('path:', path, 'watcherid:', watcherid, 'path_entry:', path_entry, 'watcher_entry:', watcher_entry);

	if (cutils.jscEqual(dwErrorCode, 0)) {
		// ok no error, so a file change happened

		// get notif_buf
		var notif_buf = path_entry.notif_buf;

		// inform mainworker oshandler
		callInMainworker('DirectoryWatcherCallOsHandlerById', {
			watcherid,
			handler_args: [dwNumberOfBytesTransfered, cutils.strOfPtr(notif_buf.address()), path]
		});

		// retrigger ReadDirectoryChanges on this hdir, otherwise WaitForMultipleObjectsEx will return immediately with index of this hdir in LP_HANDLES
		var rez_rdc = ostypes.API('ReadDirectoryChanges')(path_entry.hdir, path_entry.notif_buf.address(), NOTIFICATION_BUFFER_SIZE_IN_BYTES, false, DW_NOTIFY_FILTER, null, path_entry.o.address(), winHandler_c);
		console.log('rez_rdc:', rez_rdc);

		if (!rez_rdc) {
			// failed to re-watch
			console.error('ABORTING DUE TO UNEXPECTED ERROR!! failed to re-watch due to error:', ctypes.winLastError);
		} else {
			setTimeout(poll, 0); // no reason for setTimeout, i was just thinking no need to recurse, as it might not GC stuff
		}
	} else if (cutils.jscEqual(dwErrorCode, ostypes.CONST.ERROR_OPERATION_ABORTED)) {
		// this one was canceled via CancelIoEx so lets release the handle
	} else {
		console.error('UNKNOWN ERROR!!!! ABORTING!! dwErrorCode:', dwErrorCode);
	}
}
