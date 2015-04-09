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
	pollThis(msg.data, true);
}


function pollThis(fd, restartAfterChange) {
	console.log('ok in pollThis of nixPoll');
		  var count = ostypes.TYPE.inotify_event.size; //size_t
		  var buf = ctypes.ArrayType(ctypes.char, count)();
		  console.log('starting the loop, fd:', fd, 'count:', count);
		  var length;
      while (true) {
		length = ostypes.API('read')(this.fd, buf, count);
		if (cutils.jscEqual(length, -1)) {
			throw new Error('read failed');
		} else if (!cutils.jscEqual(length, 0)) {
			// then its > 0 as its not -1
			// something happend, read struct
		  var casted = ctypes.cast(buf.addressOfElement(0), ostypes.TYPE.inotify_event.ptr).contents;
		  console.log('casted:', casted.toString());
		  
		  var file_name = casted.addressOfField('name').contents.readString();
		  console.info('file_name:', file_name);
			self.postMessage('change found');
			if (!restartAfterChange) {
				break;
			}
		}
      }
	  console.log('ok loop done of pollThis of nixPoll');
}