// spawned as ChromeWorker by DirectoryWatcher.js
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

// impot ostypes
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

// start functionality
