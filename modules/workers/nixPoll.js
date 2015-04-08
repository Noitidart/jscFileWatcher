'use strict';
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
importScripts(core.path.chrome + 'modules/ostypes_nix.jsm');

var cOS = 'linux';

self.onmessage = function (msg) {
	// msg must be fd
	pollThis(msg.data);
}


function pollThis(fd, restartAfterChange) {
	console.log('ok in pollThis of nixPoll');
	var count = 1024 + ostypes.TYPE.inotify_event.size; //size_t
	var buf = ctypes.char.array(count)();
      var i = 0;
      console.log('starting the loop');
      while (true) {
      		i++;
      		if (i == 100) {
      			console.log('got to i 100');
      		}
      		if (i == 200) {
      			console.log('got to i 200');
      		}
		var length = ostypes.API('read')(fd, buf.address(), count);
		console.info('length:', length, length.toString())
		if (length == -1) {
			throw new Error('read failed');
		} else if (length > 0) {
			// something happend, read struct
			//var casted = ctypes.cast(buf.addressOfElement(0), ostypes.TYPE.inotify_event.ptr).contents;
			//var fname = casted.addressOfField('fname').readString();
			console.info('casted:'/*, casted.toString()*/);
			self.postMessage('change found');
			if (!restartAfterChange) {
				break;
			}
		}
      }
	  console.log('ok loop done of pollThis of nixPoll');
}