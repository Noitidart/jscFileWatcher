var EXPORTED_SYMBOLS = ['ostypes'];

var gen = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};

importScripts(gen.path.chrome + 'modules/cutils.jsm'); // used by HELPER functions

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

//var ifdef_UNICODE = true;

var nixTypes = function() {
	
	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
	
	// SIMPLE STRUCTS
	this.inotify_event = ctypes.StructType('inotify_event', [ // http://man7.org/linux/man-pages/man7/inotify.7.html
		{ wd: ctypes.int },				// Watch descriptor
		{ mask: ctypes.uint32_t },		// Mask describing event
		{ cookie: ctypes.uint32_t },	// Unique cookie associating related events (for rename(2))
		{ len: ctypes.uint32_t },		// Size of name field
		{ name: ctypes.char.ptr }		// Optional null-terminated name
	]);
}


var nixInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new nixTypes();

	// CONSTANTS
	this.CONST = {
		// start - INOTIFY - from https://github.com/dsoprea/PyInotify/blob/980610f91d4c3819dce54988cfec8f138599cedf/inotify/constants.py
		// inotify_init1 flags.
		IN_CLOEXEC  : 02000000,
		IN_NONBLOCK : 00004000,
		
		// Supported events suitable for MASK parameter of INOTIFY_ADD_WATCH.
		IN_ACCESS        : 0x00000001,
		IN_MODIFY        : 0x00000002,
		IN_ATTRIB        : 0x00000004,
		IN_CLOSE_WRITE   : 0x00000008,
		IN_CLOSE_NOWRITE : 0x00000010,
		IN_OPEN          : 0x00000020,
		IN_MOVED_FROM    : 0x00000040,
		IN_MOVED_TO      : 0x00000080,
		IN_CREATE        : 0x00000100,
		IN_DELETE        : 0x00000200,
		IN_DELETE_SELF   : 0x00000400,
		IN_MOVE_SELF     : 0x00000800,
		
		// Events sent by kernel.
		IN_UNMOUNT    : 0x00002000, // Backing fs was unmounted.
		IN_Q_OVERFLOW : 0x00004000, // Event queued overflowed.
		IN_IGNORED    : 0x00008000, // File was ignored.

		// Special flags.
		IN_ONLYDIR     : 0x01000000, // Only watch the path if it is a directory.
		IN_DONT_FOLLOW : 0x02000000, // Do not follow a sym link.
		IN_MASK_ADD    : 0x20000000, // Add to the mask of an already existing watch.
		IN_ISDIR       : 0x40000000, // Event occurred against dir.
		IN_ONESHOT     : 0x80000000 // Only send event once.
		// end - INOTIFY
	};
	
	// ADV CONSTANTS
	// start - INOTIFY - from https://github.com/dsoprea/PyInotify/blob/980610f91d4c3819dce54988cfec8f138599cedf/inotify/constants.py
	// Helper events.
	this.CONST.IN_CLOSE = (this.CONST.IN_CLOSE_WRITE | this.CONST.IN_CLOSE_NOWRITE);
	this.CONST.IN_MOVE = (this.CONST.IN_MOVED_FROM | this.CONST.IN_MOVED_TO);
	
	// All events which a program can wait on.
	this.CONST.IN_ALL_EVENTS = (this.CONST.IN_ACCESS | this.CONST.IN_MODIFY | this.CONST.IN_ATTRIB | this.CONST.IN_CLOSE_WRITE | this.CONST.IN_CLOSE_NOWRITE | this.CONST.IN_OPEN | this.CONST.IN_MOVED_FROM | this.CONST.IN_MOVED_TO | this.CONST.IN_CREATE | this.CONST.IN_DELETE | this.CONST.IN_DELETE_SELF | this.CONST.IN_MOVE_SELF);
	// end - INOTIFY
	
	var _lib = {}; // cache for lib
	var lib = function(path) {
		//ensures path is in lib, if its in lib then its open, if its not then it adds it to lib and opens it. returns lib
		//path is path to open library
		//returns lib so can use straight away

		if (!(path in _lib)) {
			//need to open the library
			//default it opens the path, but some things are special like libc in mac is different then linux or like x11 needs to be located based on linux version
			switch (path) {
				case 'x11':
					try {
						_lib[path] = ctypes.open('libX11.so.6');
					} catch (e) {
						_lib[path] = ctypes.open(ctypes.libraryName('X11'));
					}
					break;
				case 'libc':
					try {
						_lib[path] = ctypes.open('libc.so.6');
					} catch (ex) {
						ctypes.open(ctypes.libraryName('c'));
					}
				default:
					try {
						_lib[path] = ctypes.open(path);
					} catch (e) {
						//console.error('Integration Level 1: Could not get open path:', path, 'e:' + e);
						throw new Error('Integration Level 1: Could not get open path:"' + path + '" e: "' + e + '"');
					}
			}
		}
		return _lib[path];
	};
	
	// start - function declares
	var _api = {};
	this.API = function(declaration) { // it means ensureDeclared and return declare. if its not declared it declares it. else it returns the previously declared.
		if (!(declaration in _api)) {
			_api[declaration] = preDec[declaration](); //if declaration is not in preDec then dev messed up
		}
		return _api[declaration];
	};

	// start - predefine your declares here
	var preDec = { //stands for pre-declare (so its just lazy stuff) //this must be pre-populated by dev // do it alphabateized by key so its ez to look through
		close: function() {
			/* http://linux.die.net/man/2/close	
			*  int close(
			*    int fd
			*  );
			*/
			return lib('libc').declare('close', self.TYPE_ABI,
				ctypes.int,		// return
				ctypes.int		// fd
			);
		},
		inotify_add_watch: function() {
			/* http://linux.die.net/man/2/inotify_add_watch
			 * int inotify_add_watch(
			 *   int fd,
			 *   const char *pathname,
			 *   uint32_t mask
			 * );
			 */
			 return lib('libc').declare('inotify_add_watch', self.TYPE.ABI,
				ctypes.int,			// return
				ctypes.char.ptr,	// *pathname
				ctypes.uint32_t		// mask
			);
		},
		inotify_init: function() {
			/* http://linux.die.net/man/2/inotify_init
			 * Notes: Pass 0 as flags if you want inotify_init1 to behave as `int inotify_init(void);`
			 * int inotify_init1(
			 *   int flags
			 * );
			 */
			return lib('libc').declare('inotify_init1', self.TYPE.ABI,
				ctypes.int,		// return
				ctypes.int		// flags
			);
		},
		inotify_rm_watch: function() {
			/* http://linux.die.net/man/2/inotify_rm_watch
			 * int inotify_rm_watch(
			 *   int fd,
			 *   int wd
			 * );
			 */
			return lib('libc').declare('inotify_rm_watch', self.TYPE.ABI,
				ctypes.int,		// return
				ctypes.int,		// fd
				ctypes.int		// wd
			);
		},
		read: function() {
			/* http://linux.die.net/man/2/read
			*  ssize_t read(
			*    int fd, 
			*    void *buf, 
			*    size_t count;
			*  );
			*/
			return lib('libc').declare('read', self.TYPE.ABI, 
				ctypes.ssize_t,		// return
				ctypes.int,			// fd
				ctypes.void_t.ptr, 	// *buf
				ctypes.size_t		// count
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		// here
	};
}

var ostypes = new nixInit();
