/*jshint esnext: true, moz: true, node: true, -W117*/
// Imports
'use strict';
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

var core = {
  name: 'jscFileWatcher',
  id: 'jscFileWatcher@jetpack',
  path: {
    chrome: 'chrome://jscfilewatcher/content/',
    locale: 'chrome://jscfilewatcher/locale/'
  },
  aData: 0
};

importScripts(core.path.chrome + 'modules/cutils.jsm');

// Globals
var cOS = OS.Constants.Sys.Name.toLowerCase();

// Some more imports
switch (cOS) {
  case 'winnt':
  case 'winmo':
  case 'wince':
    importScripts(core.path.chrome + 'modules/ostypes_win.jsm');
    break;
  case 'linux':
  case 'sunos':
  case 'webos': // Palm Pre
  case 'android': //profilist doesnt support android (android doesnt have profiles)
    importScripts(core.path.chrome + 'modules/ostypes_nix.jsm');
    break;
  case 'darwin':
    importScripts(core.path.chrome + 'modules/ostypes_mac.jsm');
    break;
  case 'freebsd':
  case 'openbsd':
    importScripts(core.path.chrome + 'modules/ostypes_bsd.jsm');
    break;
  default:
    throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
}

// PromiseWorker
var PromiseWorker = require(core.path.chrome + 'modules/workers/PromiseWorker.js');
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
      {
        let requiredKeys = ['OSVersion'];
        for (let i=0; i<requiredKeys.length; i++) {
          if (!(requiredKeys[i] in objOfInitVars)) {
            throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
          }
        }
      }
      break;
    default:
      // do nothing
      {
        let requiredKeys = ['FFVersion', 'FFVersionLessThan30'];
        for (let i=0; i<requiredKeys.length; i++) {
          if (!(requiredKeys[i] in objOfInitVars)) {
            throw new Error('failed to init, required key of ' + requiredKeys[i] + ' not found in objInfo obj');
          }
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
      {
        let rez = ostypes.API('MessageBox')(null, body, title, ostypes.CONST.MB_OK);
        return cutils.jscGetDeepest(rez);
      }
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

        let rez = ostypes.API('CFUserNotificationDisplayNotice')(0, ostypes.CONST.kCFUserNotificationCautionAlertLevel, null, null, null, myCFStrs.head, myCFStrs.body, null);
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

function initWatch(path, /*callback,*/ options = {}) {
	switch (cOS) {
		case 'winnt':
			var rez = winntWatch(path);
			return true;
		case 'linux':
		case 'sunos':
		case 'webos': // Palm Pre
		case 'android':
			//new ostypes.API.;
			if (!('masks' in options)) {
				throw new Error('Missing required `masks` key in options objection');
			}
			//masks must be an array of strings
			if (Object.prototype.toString.call(options.masks) !== '[object Array]') {
				throw new Error('options.masks must be array of strings');
			}
			var masks = ostypes.CONST.IN_CLOSE_WRITE | ostypes.CONST.IN_MOVED_FROM | ostypes.CONST.IN_MOVED_TO | ostypes.CONST.IN_CREATE | ostypes.CONST.IN_DELETE_SELF | ostypes.CONST.IN_MOVE_SELF;
				// reason for flags with respect to aEvent of callback to main thread:
					// IN_CLOSE_WRITE - aEvent of contents-modified
					// IN_MOVED_TO - aEvent of renamed (maybe renamed-to?)
					// IN_MOVED_FROM - aEvent of renamed (maybe renamed-from?)
					// IN_CREATE - created; file/direcotry created in watched directory
					// IN_DELETE - deleted; File/directory deleted from watched directory.
					// IN_DELETE_SELF - deleted; self was deleted
					// IN_MOVED_SELF - moved; self was moved
					
			for (let i=0; i<options.masks.length; i++) {
				if (typeof options.masks[i] !== 'string') {
					throw new Error('element at position ' + i + ' in options.masks is not a string');
				} else if (!(options.masks[i] in ostypes.CONST)) {
					throw new Error('"' + options.masks[i] + '" was found at position ' + i + ' in options.masks. It was not found in ostypes.CONST obj, it is likely an invalid constant');
				}
				masks |= ostypes.CONST[options.masks[i]];
			}
			var rez_notify = new Notify(path, masks, console.log.bind(console, "callback triggered!"));
			rez_notify.addWatch();
			return true;
		case 'darwin':
        case 'freebsd':
        case 'openbsd':
			var rez_Kqueue = new Kqueue(path);
			rez_Kqueue.addWatch();
			return true;
		default:
			throw new Error(['os-unsupported', OS.Constants.Sys.Name]);
	}
	
	
}
// start - winnt file watching
function winntWatch(path) {
	// verify path is a directory
	var hDirectory = ostypes.API('CreateFile')(path, ostypes.CONST.FILE_LIST_DIRECTORY, ostypes.CONST.FILE_SHARE_READ | ostypes.CONST.FILE_SHARE_WRITE | ostypes.CONST.FILE_SHARE_DELETE, null, OS.Constants.Win.OPEN_EXISTING, ostypes.CONST.FILE_FLAG_BACKUP_SEMANTICS, null);
	console.info('hDirectory:', hDirectory.toString(), uneval(hDirectory));
	if (ctypes.winLastError !== 0) { //cutils.jscEqual(hDirectory, ostypes.CONST.INVALID_HANDLE_VALUE)) { // commented this out cuz hDirectory is returned as `ctypes.voidptr_t(ctypes.UInt64("0xb18"))` and i dont know what it will be when it returns -1 but the returend when put through jscEqual gives `"breaking as no targetType.size on obj level:" "ctypes.voidptr_t(ctypes.UInt64("0xb18"))"`
		console.error('Failed hDirectory, winLastError:', ctypes.winLastError);
		throw new Error('Failed hDirectory, winLastError: ' + ctypes.winLastError);
	}
	
	var temp_buffer = ostypes.TYPE.DWORD.array(4096)(); // im not sure about the 4096 ive seen people use that and 2048 im not sure why
	var temp_buffer_size = ostypes.TYPE.DWORD(temp_buffer.constructor.size);
	var bytes_returned = ostypes.TYPE.LPDWORD();
	var changes_to_watch = ostypes.TYPE.DWORD(ostypes.CONST.FILE_NOTIFY_CHANGE_LAST_WRITE | ostypes.CONST.FILE_NOTIFY_CHANGE_FILE_NAME | ostypes.CONST.FILE_NOTIFY_CHANGE_DIR_NAME);
	
	var rez_RDC = ostypes.API('ReadDirectoryChanges')(hDirectory, temp_buffer, temp_buffer_size, false, changes_to_watch, bytes_returned, null, null);
	console.log('ok got here');
	return;
	console.info('rez_RDC:', rez_RDC.toString(), uneval(rez_RDC));
	if (cutils.jscEqual(rez_RDC, 0)) {
		console.error('Failed rez_RDC, winLastError:', ctypes.winLastError);
		throw new Error('Failed rez_RDC, winLastError: ' + ctypes.winLastError);
	}
	
	//var casted = ctypes.cast(temp_buffer.address(), ostypes.TYPE.FILE_NOTIFY_INFORMATION.ptr).contents;
	//console.info('casted:', casted.toString(), uneval(casted));
	
	
}
// end - winnt file watching
// start - mac file watching
function EV_SET(kev_ptr, ident, filter, flags, fflags, data, udata_jsStr) {
	// macro
	// &kev, ident, filter, flags, fflags, data, udata
    kev_ptr.contents.ident = ident;
    kev_ptr.contents.filter = filter;
    kev_ptr.contents.flags = flags;
    kev_ptr.contents.fflags = fflags;
    kev_ptr.contents.data = data;
    kev_ptr.contents.udata = ostypes.TYPE.char.array()(udata_jsStr);
}
function Kqueue(path/*, callback*/) {
	var rez_fd = ostypes.API('kqueue')(0);
	console.info('rez_fd:', rez_fd.toString(), uneval(rez_fd));
	if (ctypes.errno !== 0) { console.error('Failed rez_fd, errno:', ctypes.errno); throw new Error('Failed rez_fd, errno: ' +  ctypes.errno); }
	
	this.kq = rez_fd;
	this.path = path;
	this.callback = inotifyCallbackTemp;
}
Kqueue.prototype.addWatch = function() {
	
    // Open a file descriptor for the file/directory that you want to monitor.
	var event_fd = ostypes.API('open')(this.path, OS.Constants.libc.O_EVTONLY);
	console.info('event_fd:', event_fd.toString(), uneval(event_fd));
	if (ctypes.errno !== 0) { console.error('Failed event_fd, errno:', ctypes.errno); throw new Error('Failed event_fd, errno: ' + ctypes.errno); }
	
	// The address in user_data will be copied into a field in the event.If you are monitoring multiple files,you could,for example,pass in different data structure for each file.For this example,the path string is used.
	var user_data = this.path;
	
	// Set the timeout to wake us every half second.
	var timeout = ostypes.TYPE.timespec();
	var useSec = 0;
	var useNsec = 500000000;
	timeout.tv_sec = useSec;	// 0 seconds
	timeout.tv_nsec = useNsec;	// 500 milliseconds
	
	// Set up a list of events to monitor.
    var vnode_events = ostypes.CONST.NOTE_DELETE | ostypes.CONST.NOTE_WRITE | ostypes.CONST.NOTE_EXTEND | ostypes.CONST.NOTE_ATTRIB | ostypes.CONST.NOTE_LINK | ostypes.CONST.NOTE_RENAME | ostypes.CONST.NOTE_REVOKE; // ostypes.TYPE.unsigned_int
	var events_to_monitor = ostypes.TYPE.kevent.array(ostypes.CONST.NUM_EVENT_FDS)();
    EV_SET( events_to_monitor.addressOfElement(0), event_fd, ostypes.CONST.EVFILT_VNODE, ostypes.CONST.EV_ADD | ostypes.CONST.EV_CLEAR, vnode_events, 0, user_data);

	// Handle events
	var event_data = ostypes.TYPE.kevent.array(ostypes.CONST.NUM_EVENT_SLOTS)();
	
	var num_files = 1; // ostypes.TYPE.int
	var continue_loop = 40; // Monitor for twenty seconds. // ostypes.TYPE.int
	while (--continue_loop) {
		var event_count = ostypes.API('kevent')(this.kq, events_to_monitor, ostypes.CONST.NUM_EVENT_SLOTS, event_data, num_files, timeout.address());
		console.info('event_count:', event_count.toString(), uneval(event_count));
		if (ctypes.errno !== 0) {
			console.error('Failed event_count, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
			throw new Error('Failed event_count, errno: ' + ctypes.errno + ' and event_count: ' + cutils.jscGetDeepest(event_count));
		}
		if (cutils.jscEqual(event_data.addressOfElement(0).contents.flags, ostypes.CONST.EV_ERROR)) {
			console.error('Failed event_count, due to event_data.flags == EV_ERROR, errno:', ctypes.errno, 'event_count:', cutils.jscGetDeepest(event_count));
			throw new Error('Failed event_count, due to event_data.flags == EV_ERROR, errno: ' + ctypes.errno + ' and event_count: ' + cutils.jscGetDeepest(event_count));
		}
		
		if (!cutils.jscEqual(event_count, '0')) {
            console.log('Event ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.ident) + ' occurred. Filter ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.filter) + ', flags ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.flags) + ', filter flags ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.fflags) + ', filter data ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.data) + ', path ' + cutils.jscGetDeepest(event_data.addressOfElement(0).contents.udata/*.contents.readString()*/));
		} else {
			// No event
		}
		
		// Reset the timeout. In case of a signal interrruption, the values may change.
		timeout.tv_sec = useSec;	// 0 seconds
		timeout.tv_nsec = useNsec;	// 500 milliseconds
	}
	ostypes.API('close')(event_fd);
	return 0;
};
// end - mac file watching
// start - nix file watching
function Notify(path, masks, callbackSuccess, callbackError){
    if (!callbackSuccess) {
      throw new Error('At least one callback must be specified!');
    }
    this.fd = ostypes.API('inotify_init')(0);
    if (this.fd === -1) {
		console.error('Failed rez_init, errno:', ctypes.errno);
		throw new Error('Failed to inotify init, error code is ' + ctypes.errno);
	}
	this.path = path;
	this.masks = masks;
    this.callbackSuccess = callbackSuccess;
    this.callbackEror = callbackError;
	return true;
}
Notify.prototype.addWatch = function(){
  this.watch = ostypes.API('inotify_add_watch')(this.fd, this.path, this.masks); // return an instance of iNotify (sorry for calling it like this, its actually something like ID for the watch).
  console.info('this.watch:', this.watch.toString(), uneval(this.watch));
  if (this.watch === -1) {
    console.error('Failed this.watch, errno:', ctypes.errno);
    throw new Error('failed to add watch, error is: ' + ctypes.errno);
  } else {
    console.log('succesfully added watch, file descripted = ', this.watch);
  }
  // based on https://github.com/Noitidart/ChromeWorker
  var pollWorker = new ChromeWorker(core.path.chrome + 'modules/workers/nixPoll.js');
  function handleMessageFromWorker(msg, data) {
    console.log('incoming message from worker, msg:', msg, data);
  }
  pollWorker.addEventListener('success', handleMessageFromWorker);
  pollWorker.addEventListener('error', handleMessageFromWorker);

  console.log('ok added pollWorker');
  pollWorker.postMessage(this.fd);
  return true;
};
Notify.prototype.removeWatch = function(path, callback){
  var rez_rm = ostypes.API('inotify_rm_watch')(this.fd, this.watch);
  console.info('rez_rm:', rez_rm, rez_rm.toString(), uneval(rez_rm));
  if (rez_rm !== -1) {
    console.log('succesfully removed watch');
    this.watch = null;
    return true;
  } else {
    // it is -1
    console.error('Failed rez_rm, errno:', ctypes.errno);
    throw new Error('failed to remove watch, error is: ' + ctypes.errno);
  }
};
Notify.prototype.close = function() {
  var rez_c  = ostypes.API('close')(this.fd);
  console.info('rez_c:', rez_c, rez_c.toString(), uneval(rez_c));
  if (rez_c !== -1) {
    this.fd = null;
    console.log('succesfully closed');
    return true;
  } else {
   // it is -1
    console.error('Failed rez_c, errno:', ctypes.errno);
    throw new Error('failed to close, error is: ' + ctypes.errno);
  }
};
// end - nix file watching
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
		return 'initialAttempt succeeded';
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