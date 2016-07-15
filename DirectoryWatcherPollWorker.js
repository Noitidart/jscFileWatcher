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

function init(aArg) {
	({ pollerid, sessionid, pipe_ptrstr } = aArg);
	console.log('pollerid:', pollerid, 'sessionid:', sessionid, 'pipe_ptrstr:', pipe_ptrstr);

	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				// Globals
				pipe = ostypes.API('CreateFile')('\\\\.\\pipe\\dirwatcher' + sessionid + pollerid, ostypes.CONST.GENERIC_READ, ostypes.CONST.FILE_SHARE_READ, null, OS.Constants.Win.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_OVERLAPPED, null);
				// pipe = ostypes.TYPE.HANDLE(ctypes.UInt64(pipe_ptrstr));
				console.log('pipe:', pipe);


				WATCHED_RES_MAXIMUM_NOTIFICATIONS = 100; // 100; Dexter uses 100
				// NOTIFICATION_BUFFER_SIZE = ostypes.TYPE.FILE_NOTIFY_INFORMATION.size * WATCHED_RES_MAXIMUM_NOTIFICATIONS;
				// DW_NOTIFY_FILTER = ostypes.CONST.FILE_NOTIFY_CHANGE_LAST_WRITE | ostypes.CONST.FILE_NOTIFY_CHANGE_FILE_NAME | ostypes.CONST.FILE_NOTIFY_CHANGE_DIR_NAME; // this is what @Dexter used
				// winHandler_c = ostypes.TYPE.FileIOCompletionRoutine.ptr(winHandler);

				LP_HANDLES = [pipe];
				LP_HANDLES_C = ostypes.TYPE.HANDLE.array()(LP_HANDLES);
				// set up a watcher on a pipe, send to mainthread the pipe so it can interrupt


			break;
		default:
			// do nothing special
	}
}

// start functionality
function addPath(aArg) {
	var { aPath, aWatcherId } = aArg;

	setTimeout(poll, 0); // start poll after a timeout. so i can return `true` to caller
	return true;
}

function poll() {
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				console.log('starting wait');
				var rez_wait = ostypes.API('WaitForMultipleObjectsEx')(LP_HANDLES.length, LP_HANDLES_C, false, ostypes.CONST.INFINITE, true);
				console.log('rez_wait:', rez_wait);

			break;
	}
}

function winHandler(dwErrorCode, dwNumberOfBytesTransfered, lpOverlapped) {
	console.log('in winRoutine:', 'dwErrorCode:', dwErrorCode, 'dwNumberOfBytesTransfered:', dwNumberOfBytesTransfered, 'lpOverlapped:', lpOverlapped);
}
