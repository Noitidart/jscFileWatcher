// assumes that OS.File and Comm (and ostypes if ChromeWorker) are loaded in the global scope
// assumes there is a file in parent directory of DirectoryWatcher.js named DirectoryWatcherPaths.js which contains const directorywatcher_paths = { comm:'', ostypes_dir:'' }
// goal: this can be loaded into mainthread or ChromeWorker. as of now though is setup to only be loaded into ChromeWorker.
// use importScripts to load this into ChromeWorker

function isChromeWorker() {
	return this.DedicatedWorkerGlobalScope && this.ctypes;
}


if (!Comm) { throw new Error('Comm is not loaded into global scope!') }
if (!OS || !OS.File) { throw new Error('OS.File is not loaded into global scope!') }
if (isChromeWorker()) {
	if (!ostypes) { throw new Error('ostypes is not loaded into global scope!') }
}

class DirectoryWatcher {
	constructor(aCallback) {
		this.cb = aCallback;
		this.osname = OS.Constants.Sys.Name.toLowerCase();
	}
	addPath(path) {
		if (isChromeWorker()) {
			switch (this.osname) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						//
					break;
				case 'darwin':
						//
					break;
				case 'android':
						//
					break;
				default:
					// assume gtk based system
			}
		} else {

		}
	}
	removePath(path) {
		if (isChromeWorker()) {
			switch (this.osname) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						//
					break;
				case 'darwin':
						//
					break;
				case 'android':
						//
					break;
				default:
					// assume gtk based system
			}
		} else {

		}
	}
	close() {
		if (isChromeWorker()) {
			switch (this.osname) {
				case 'winnt':
				case 'winmo':
				case 'wince':
						//
					break;
				case 'darwin':
						//
					break;
				case 'android':
						//
					break;
				default:
					// assume gtk based system
			}
		} else {

		}
	}
}
OS.File.DirectoryWatcher = DirectoryWatcher;
