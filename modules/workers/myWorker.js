// Imports
importScripts('resource://gre/modules/osfile.jsm')
importScripts('resource://gre/modules/workers/require.js');

var gen = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};

importScripts(gen.path.chrome + 'modules/cutils.jsm');

// Globals
var cOS = OS.Constants.Sys.Name.toLowerCase();

// Some more imports
switch (cOS) {
	case 'winnt':
	case 'winmo':
	case 'wince':
		importScripts(gen.path.chrome + 'modules/ostypes_win.jsm');
		break;
	case 'linux':
	case 'freebsd':
	case 'openbsd':
	case 'sunos':
	case 'webos': // Palm Pre
	case 'android': //profilist doesnt support android (android doesnt have profiles)
		importScripts(gen.path.chrome + 'modules/ostypes_nix.jsm');
		break;
	case 'darwin':
		importScripts(gen.path.chrome + 'modules/ostypes_mac.jsm');
		break;
	default:
		throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
}

// PromiseWorker
var PromiseWorker = require(gen.path.chrome + 'modules/workers/PromiseWorker.js');
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

// Init
var objInfo; //populated by init
function init(objOfInitVars) {
	switch (cOS) {
		case 'winnt':
		//case 'winmo':
		//case 'wince':
			var requiredKeys = ['OSVersion'];
			for (var i=0; i<requiredKeys.length; i++) {
				if (!(requiredKeys[i] in objOfInitVars)) {
					throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
				}
			}
			break;
		default:
			// do nothing
			var requiredKeys = ['FFVersion', 'FFVersionLessThan30'];
			for (var i=0; i<requiredKeys.length; i++) {
				if (!(requiredKeys[i] in objOfInitVars)) {
					throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
				}
			}
	}
	
	objInfo = objOfInitVars;
}

// start - main defintions
function doOsAlert(title, body) {
	switch (cOS) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			var rez = ostypes.API('MessageBox')(null, body, title, ostypes.CONST.MB_OK);
			return cutils.jscGetDeepest(rez);
			break;
		/*
		case 'linux':
		case 'freebsd':
		case 'openbsd':
		case 'sunos':
		case 'webos': // Palm Pre
		case 'android': //profilist doesnt support android (android doesnt have profiles)
			importScripts('chrome://profilist/content/modules/ostypes_nix.jsm');
			break;
		*/
		case 'darwin':
			if (ostypes.IS64BIT) {
				var myCFStrs = {
					head: ostypes.HELPER.makeCFStr(title),
					body: ostypes.HELPER.makeCFStr(body)
				};
				
				var rez = ostypes.API('CFUserNotificationDisplayNotice')(0, ostypes.CONST.kCFUserNotificationCautionAlertLevel, null, null, null, myCFStrs.head, myCFStrs.body, null);
				console.info('rez:', rez.toString(), uneval(rez)); // CFUserNotificationDisplayNotice does not block till user clicks dialog, it will return immediately
				
				if (cutils.jscEqual(rez, 0)) {
					console.log('Notification was succesfully shown!!');
					return true;
				} else {
					throw new Error('Failed to show notification... :(');
				}
				
				for (var cfstr in myCFStrs) {
					if (myCFStrs.hasOwnProperty(cfstr)) {
						var rez_CFRelease = ostypes.API('CFRelease')(myCFStrs[cfstr]); // returns void
					}
				}
			} else {
				var hit = ostypes.TYPE.SInt16();
				var rez = ostypes.API('StandardAlert')(ostypes.CONST.kCFUserNotificationCautionAlertLevel, ostypes.HELPER.Str255(title), ostypes.HELPER.Str255(body), null, hit.address());
				console.info('rez:', rez.toString(), uneval(rez));
				console.info('hit:', hit.toString(), uneval(hit));
				return cutils.jscGetDeepest(hit);
			}
			break;
		default:
			throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
	}
}
// end - main defintions


// start - helper functions
var txtDecodr; // holds TextDecoder if created
function getTxtDecodr() {
	if (!txtDecodr) {
		txtDecodr = new TextDecoder();
	}
	return txtDecodr;
}
function read_encoded(path, options) {
	// async version of read_encoded from bootstrap.js
	// because the options.encoding was introduced only in Fx30, this function enables previous Fx to use it
	// must pass encoding to options object, same syntax as OS.File.read >= Fx30
	// TextDecoder must have been imported with Cu.importGlobalProperties(['TextDecoder']);

	if (options && !('encoding' in options)) {
		throw new Error('Must pass encoding in options object, otherwise just use OS.File.read');
	}
	
	if (options && objInfo.FFVersionLessThan30) { // tests if version is less then 30
		//var encoding = options.encoding; // looks like i dont need to pass encoding to TextDecoder, not sure though for non-utf-8 though
		delete options.encoding;
	}
	
	var aVal = OS.File.read(path, options);

	if (objInfo.FFVersionLessThan30) { // tests if version is less then 30
		//console.objInfo('decoded aVal', getTxtDecodr().decode(aVal));
		return getTxtDecodr().decode(aVal); // Convert this array to a text
	} else {
		//console.objInfo('aVal', aVal);
		return aVal;
	}
}

function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir) {
	// sync version of the one from bootstrap
	//argsOfOsFileFunc must be array
	
	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		throw new Error('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
	}
	
	
	// setup retry
	var retryIt = function() {
		//try {
			var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
			return 'tryOsFile succeeded after making dirs';
		//} catch (ex) {
			
		//}
		// no try so it throws if errors
	};
	
	// setup recurse make dirs
	var makeDirs = function() {
		var toDir;
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;
				
			default:
				throw new Error('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		}
		makeDir_Bug934283(toDir, {from: fromDir});
		return retryIt();
	};
	
	// do initial attempt
	try {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		return 'initialAttempt succeeded'
	} catch (ex) {
		if (ex.becauseNoSuchFile) {
			console.log('make dirs then do secondAttempt');
			return makeDirs();
		}
	}
}

function makeDir_Bug934283(path, options) {
	// sync version of one in bootstrap.js
	
	if (!options || !('from' in options)) {
		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {
		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);
	console.log('dirsToMake:', dirsToMake);

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		if (dirsToMake.length > 0) {
			return makeDirRecurse();
		} else {
			return 'this path now exists for sure: "' + pathExistsForCertain + '"';
		}
	};
	return makeDirRecurse();
}
// end - helper functions