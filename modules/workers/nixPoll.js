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

var cOS = 'linux';

self.onmessage = function (msg) {
	pollThis(msg.data);
}


function pollThis(fd) {
	var count = 1024 + ostypes.TYPE.inotify_event.size; //size_t
	var buf = ctypes.char.array(count)();
	var length = ostypes.API('read')(fd, buf.address(), count);
      if (length === -1) {
        throw new Error('read failed');
	  }
      var i = 0;
      var changes = new Set();
      while (i < length) {      
        self.postMessage('i is >= length');
      }
	
}