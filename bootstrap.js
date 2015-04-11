const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const core = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};


const myServices = {};
var PromiseWorker;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });

var stringBundle = Services.strings.createBundle(core.path.locale + 'global.properties?' + Math.random()); // Randomize URI to work around bug 719376
var cOS = OS.Constants.Sys.Name.toLowerCase();
var myWorker;

function startWorker() {
	myWorker = new PromiseWorker(core.path.chrome + 'modules/workers/myWorker.js');
	
	var objInfo = {};
	switch (cOS) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			objInfo.OSVersion = parseFloat(Services.sysinfo.getProperty('version'));
			if (objInfo.OSVersion >= 6.1) {
				objInfo.isWin7 = true;
			} else if (objInfo.OSVersion == 5.1 || objInfo.OSVersion == 5.2) {
				objInfo.isWinXp = true;
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {		
				objInfo.OSVersion = parseFloat(version_osx[1]);
			}
			break;
		default:
			// nothing special
	}
	
	objInfo.FFVersion = Services.appinfo.version;
	objInfo.FFVersionLessThan30 = (Services.vc.compare(Services.appinfo.version, 30) < 0);
	
	var promise_initWorker = myWorker.post('init', [objInfo]);
	promise_initWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_initWorker - ', aVal);
			// start - do stuff here - promise_initWorker
			// end - do stuff here - promise_initWorker
		},
		function(aReason) {
			var rejObj = {name:'promise_initWorker', aReason:aReason};
			console.error('Rejected - promise_initWorker - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_initWorker', aCaught:aCaught};
			console.error('Caught - promise_initWorker - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	);
	// should maybe test if the promise was successful
}

function main() {
	/*
	var promise_doOsAlert = myWorker.post('doOsAlert', [stringBundle.GetStringFromName('startup_prompt_title'), stringBundle.GetStringFromName('startup_prompt_msg')]);
	promise_doOsAlert.then(
		function(aVal) {
			console.log('Fullfilled - promise_doOsAlert - ', aVal);
			// start - do stuff here - promise_doOsAlert
			
			// end - do stuff here - promise_doOsAlert
		},
		function(aReason) {
			var rejObj = {name:'promise_doOsAlert', aReason:aReason};
			console.error('Rejected - promise_doOsAlert - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_doOsAlert', aCaught:aCaught};
			console.error('Caught - promise_doOsAlert - ', rejObj);
			//deferred_createProfile.reject(rejObj);
		}
	);
	*/
	
	switch (cOS) {
		case 'linux':
		case 'freebsd':
		case 'openbsd':
		case 'sunos':
		case 'webos': // Palm Pre
		case 'android':
		case 'darwin':
		case 'winnt':
			//new ostypes.API.;
			var promise_initWatch = myWorker.post('initWatch', [
				OS.Constants.Path.desktopDir,
				{
					masks: ['IN_ALL_EVENTS'] // has no effect on mac
				}
			]);
			promise_initWatch.then(
				function(aVal) {
					console.log('Fullfilled - promise_initWatch - ', aVal);
					// start - do stuff here - promise_initWatch
					// end - do stuff here - promise_initWatch
				},
				function(aReason) {
					var rejObj = {name:'promise_initWatch', aReason:aReason};
					console.error('Rejected - promise_initWatch - ', rejObj);
					//deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_initWatch', aCaught:aCaught};
					console.error('Caught - promise_initWatch - ', rejObj);
					//deferred_createProfile.reject(rejObj);
				}
			);
			break;
		default:
			throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
	}
	
}

function mainUsingAPI() {
	var callback_logPath = function(aOSPath, aEvent) {
		// aEvent is a string, or if user passed in options.masks and the event that happend is not one of the strings below, then its a number returned by the OS
			// created
			// deleted
			// renamed
			// contents-modified
		console.log(
	};
	let watcher = 
}

// start - OS.File.Watcher API
var FSInitWorker;
var _FSInitWorker_start_already_triggered = false;
function _FSInitWorker_start() {
	// returns promise
	
	if (!FSInitWorker) {
		FSInitWorker = new PromiseWorker(core.path.chrome + 'modules/workers/FSInitWorker.js');
	}
}
var _Watcher_nextId = 0; // never decrement this
var _Watcher_UnterminatedFSPollWorkers = {}; // used for termination on shutdown // key is aWatcherId and value is the FSPollWorker reference
function Watcher(aCallback, options = {}) {
	// returns prototype object, meaning whenever this function is called it should be called like `let watcher = new OS.File.Watcher(callback)`
	// if user wants to know if it was succesfully initalized they can do this:
	/*
		let watcher = new OS.File.Watcher(callback)
		watcher.promise_initialized.then(onFulfill, onReject).catch(onCatch);
	*/
	// dev user can do watcher.addPath/watcher.removePath before waiting for promise_initalized, as they return promises, those promise will just return after execution after initialization
	var thisW = this;
	if (!aCallback || Object.toString.call(aCallback) != '[object Function]') {
		throw new Error('The argument aCallback is not a function. It must be a function, which optionally takes two arguments: first is aOSPath and second is aEvent.');
	}
	
	thisW.id = _Watcher_nextId;
	_Watcher_nextId++; // so its available to next one
	
	thisW.readState = 0;
	// readyState's
		// 0 - uninintialized
		// 1 - initialized, ready to do addPaths // when i change readyState to 1, i should check if any paths to add are in queue
		// 2 - closed due to user calling Watcher.prototype.close
		// 3 - closed due to failed to initialize
	
	thisW.cb = aCallback;
	
	thisW.paths_watched = []; // array of lower cased OS paths, these are inputed user passing a os path to addWatch, that are being watched
	
	thisW.pendingAdds = {}; // object with key aOSPath.toLowerCase()
	
	var deferred_initialized = new Deferred();
	thisW.promise_initialized = deferred_initialized.promise;
	
	var do_initWatcher = function() {
		var promise_initWatcher = FSInitWorker.post('initWatcher', [thisW.id]);
		promise_initWatcher.then(
		  function(aVal) {
			console.log('Fullfilled - promise_initWatcher - ', aVal);
			// start - do stuff here - promise_initWatcher
			thisW.readState = 1;
			deferred_initialized.resolve(true);
			// add in the paths that are waiting
			for (var pendingAdd in thisW.pendingAdds) {
				thisW.pendingAdds[pendingAdd]();
			}
			// end - do stuff here - promise_initWatcher
		  },
		  function(aReason) {
			var rejObj = {name:'promise_initWatcher', aReason:aReason};
			console.warn('Rejected - promise_initWatcher - ', rejObj);
			thisW.readState = 3;
			deferred_initialized.reject(rejObj);
			// run through the waiting adds, they are functions which will reject the pending deferred's with .message saying "closed due to readyState 3" as initialization failed
			for (var pendingAdd in thisW.pendingAdds) {
				thisW.pendingAdds[pendingAdd]();
			}
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_initWatcher', aCaught:aCaught};
			console.error('Caught - promise_initWatcher - ', rejObj);
			thisW.readState = 3;
			deferred_initialized.reject(rejObj);
			// run through the waiting adds, they are functions which will reject the pending deferred's with .message saying "closed due to readyState 3" as initialization failed
			for (var pendingAdd in thisW.pendingAdds) {
				thisW.pendingAdds[pendingAdd]();
			}
		  }
		);
	};
	
	var promise_ensureFSInitWorkerStarted = _FSInitWorker_start();
	promise_ensureFSInitWorkerStarted.then(
	  function(aVal) {
		console.log('Fullfilled - promise_ensureFSInitWorkerStarted - ', aVal);
		// start - do stuff here - promise_ensureFSInitWorkerStarted
		do_initWatcher();
		// end - do stuff here - promise_ensureFSInitWorkerStarted
	  },
	  function(aReason) {
		var rejObj = {name:'promise_ensureFSInitWorkerStarted', aReason:aReason};
		console.warn('Rejected - promise_ensureFSInitWorkerStarted - ', rejObj);
		deferred_initialized.reject(rejObj);
	  }
	).catch(
	  function(aCaught) {
		var rejObj = {name:'promise_ensureFSInitWorkerStarted', aCaught:aCaught};
		console.error('Caught - promise_ensureFSInitWorkerStarted - ', rejObj);
		deferred_initialized.reject(rejObj);
	  }
	);
	
}
Watcher.prototype.addPath = function(aOSPath) {
	// returns promise
		// resolves to true on success
		// rejects object with keys of name and message, expalining why it failed
		
	var deferredMain_Watcher_addPath = new Deferred();
	
	var aOSPathLower = aOSPath.toLowerCase();
	
	var thisW = this;
	
	var do_addPath = function() {
		if (thisW.readState != 1) {
			// closed either to failed initialization or user called watcher.close
			deferredMain_Watcher_addPath.reject({
				name: 'watcher-closed',
				message: 'Cannot add as this Watcher was previously closed with reason ' + thisW.readState
			});
		} else {
			var promise_addPath = myWorker.post('addPathToWatcher', [thisW.id, aOSPath]);
			promise_addPath.then(
			  function(aVal) {
				console.log('Fullfilled - promise_addPath - ', aVal);
				// start - do stuff here - promise_addPath
				thisW.paths_watched.push(aOSPathLower);
				deferredMain_Watcher_addPath.resolve(true);
				// end - do stuff here - promise_addPath
			  },
			  function(aReason) {
				var rejObj = {name:'promise_addPath', aReason:aReason};
				console.warn('Rejected - promise_addPath - ', rejObj);
				deferredMain_Watcher_addPath.reject(rejObj);
			  }
			).catch(
			  function(aCaught) {
				var rejObj = {name:'promise_addPath', aCaught:aCaught};
				console.error('Caught - promise_addPath - ', rejObj);
				deferredMain_Watcher_addPath.reject(rejObj);
			  }
			);
		}
	};
	
	if (thisW.readyState === 0) {
		// watcher not yet initalized
		if (aOSPathLower in thisW.pathsPendingAdd) {
			deferredMain_Watcher_addPath.reject({
				name: 'duplicate-path',
				message: 'This path is already waiting to be added. It is waiting as the Watcher has not been initailized yet.'
			});
		} else {
			thisW.pendingAdds[aOSPathLower] = do_addPath;
		}
	} else if (thisW.readyState == 1) {
		// watcher is ready
		if (thisW.paths_watched.indexOf(aOSPathLower) > -1) {
			deferredMain_Watcher_addPath.reject({
				name: 'duplicate-path',
				message: 'This path was already succesfully added by a previous call to Watcher.prototype.addPath.'
			});
		} else {
			do_addPath();
		}
	} else {
		// watcher is closed
		deferredMain_Watcher_addPath.reject({
			name: 'watcher-closed',
			message: 'Cannot add as this Watcher was previously closed with reason ' + thisW.readState
		});
	}
	
	return deferredMain_Watcher_addPath.promise;
}
Watcher.prototype.removePath = function() {
	// must return promise, as removal of path is done by call to myWorker.js to do a c call
		// resolves to true if sucesfully removed
	var deferredMain_Watcher_removePath = new Deferred();
	
	var thisW = this;
	var aOSPathLower = aOSPath.toLowerCase();
	
	if (thisW.readyState === 0) {
		// watcher not yet initalized
		if (aOSPathLower in thisW.pathsPendingAdd) {
			delete thisW.pathsPendingAdd[aOSPathLower];
			deferredMain_Watcher_removePath.resolve(true);
		} else {
			deferredMain_Watcher_removePath.reject({
				name: 'path-not-found',
				message: 'This path was never added, it was not found in watched paths arrays/objects.'
			});
		}
	} else if (thisW.readyState == 1) {
		// watcher is ready
		if (thisW.paths_watched.indexOf(aOSPathLower) > -1) {
			var promise_removePath = myWorker.post('removePathFromWatcher', [thisW.id, aOSPath]);
			promise_removePath.then(
			  function(aVal) {
				console.log('Fullfilled - promise_removePath - ', aVal);
				// start - do stuff here - promise_removePath
				thisW.paths_watched.splice(thisW.paths_watched.indexOf(aOSPathLower), 1);
				deferredMain_Watcher_removePath.resolve(true);
				// end - do stuff here - promise_removePath
			  },
			  function(aReason) {
				var rejObj = {name:'promise_removePath', aReason:aReason};
				console.warn('Rejected - promise_removePath - ', rejObj);
				deferredMain_Watcher_removePath.reject(rejObj);
			  }
			).catch(
			  function(aCaught) {
				var rejObj = {name:'promise_removePath', aCaught:aCaught};
				console.error('Caught - promise_removePath - ', rejObj);
				deferredMain_Watcher_removePath.reject(rejObj);
			  }
			);
		} else {
			deferredMain_Watcher_removePath.reject({
				name: 'path-not-found',
				message: 'This path was never added, it was not found in watched paths arrays/objects.'
			});
		}
	} else {
		// watcher is closed
		deferredMain_Watcher_removePath.reject({
			name: 'watcher-closed',
			message: 'No need to remove paths as this Watcher was previously closed with reason ' + thisW.readState
		});
	}
	
	return deferredMain_Watcher_removePath.promise;
}
Watcher.prototype.close = function() {
	// returns promise as it has to make a c call
		// resolves to true on success, else an object explaining why it failed
	var deferredMain_Watcher_close = new Deferred();
	var thisW = this;
	
	if (thisW.readyState == 2 || thisW.readyState == 3) {
		// was already previously closed
		deferredMain_Watcher_close.reject({
			name: 'watcher-closed',
			message: 'Cannot close because Watcher was already previously closed with reason ' + thisW.readState
		});
	} else {
		var promise_closeWatcher = myWorker.post('removePathFromWatcher', [thisW.id, aOSPath]);
		promise_closeWatcher.then(
		  function(aVal) {
			console.log('Fullfilled - promise_closeWatcher - ', aVal);
			// start - do stuff here - promise_closeWatcher
			delete _Watcher_UnterminatedFSPollWorkers[thisW.id];
			deferredMain_Watcher_close.resolve(true);
			// end - do stuff here - promise_closeWatcher
		  },
		  function(aReason) {
			var rejObj = {name:'promise_closeWatcher', aReason:aReason};
			console.warn('Rejected - promise_closeWatcher - ', rejObj);
			deferredMain_Watcher_close.reject(rejObj);
		  }
		).catch(
		  function(aCaught) {
			var rejObj = {name:'promise_closeWatcher', aCaught:aCaught};
			console.error('Caught - promise_closeWatcher - ', rejObj);
			deferredMain_Watcher_close.reject(rejObj);
		  }
		);
	}
	
	return deferredMain_Watcher_close.promise;
}
var FSPollWorker;
Watcher.prototype.waitForNextChange = function() {
	// returns promise
	
	var thisW = this;
	if (!thisW.FSPollWorker) {
		thisW.FSPollWorker = new PromiseWorker(core.path.chrome + 'modules/workers/FSPollWorker.js');
	}
	
	
	// for winnt, if ReadDirectoryChangesW only supports one path per, this func should do a promise for each path to FSPollWorker. a FSPollWorker must be created for each callback as when want to close, to abort all of the promises i can terminate the worker, then itterate through the promises and reject them for reason of Watcher closed.
	// actually i think for all OS'es each callback should get its own FSPollWorker
	// question to p0lip: regrading kqueue and inotify, if currently in a poll loop, if addPath do i have to abort the poll and restart it? or will the pre-existing poll also now trigger when the new added path change happens? because this is for case where pre-existing poll is watching dir1, and then addPath(dir2) and then change in dir2 happens, will the prexisting poll fire?
}
// end - OS.File.Watcher API

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	console.log('test')
	core.aData = aData;
	PromiseWorker = Cu.import(core.path.chrome + 'modules/PromiseWorker.jsm').BasePromiseWorker;
	
	//Services.prompt.alert(null, stringBundle.GetStringFromName('startup_prompt_title'), stringBundle.GetStringFromName('startup_prompt_title'));
	
	
	startWorker();
	
	
	
	//main();
	
	mainUsingAPI();
}
 
function shutdown(aData, aReason) {
	// must terminate workers as they are seperate threads
	if (FSInitWorker) {
		FSInitWorker.terminate();
		// terminate all FSPollWorker's - can do this inside this `if (FSInitWorker)` block because obviously if that doesnt exist then no FSPollWorker's exist
		for (var aWatcherId in _Watcher_UnterminatedFSPollWorkers) {
			_Watcher_UnterminatedFSPollWorkers[aWatcherId].terminate();
		}
	}
	
	if (aReason == APP_SHUTDOWN) { return }
	
	Cu.unload(core.path.chrome + 'modules/PromiseWorker.jsm');
}

// start - common helper functions
function Deferred() {
	if (Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
		/* A method to resolve the associated Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} value : This value is used to resolve the promise
		 * If the value is a Promise then the associated promise assumes the state
		 * of Promise passed as value.
		 */
		this.resolve = null;

		/* A method to reject the assocaited Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} reason: The reason for the rejection of the Promise.
		 * Generally its an Error object. If however a Promise is passed, then the Promise
		 * itself will be the reason for rejection no matter the state of the Promise.
		 */
		this.reject = null;

		/* A newly created Pomise object.
		 * Initially in pending state.
		 */
		this.promise = new Promise(function(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
		Object.freeze(this);
	}
}
// end - common helper functions