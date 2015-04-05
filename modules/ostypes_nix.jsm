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
	
	
}

var nixInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new nixTypes();

	// CONSTANTS
	this.CONST = {
		// here
	};
	
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
						lib[path] = ctypes.open('libX11.so.6');
					} catch (e) {
						try {
							lib[path] = ctypes.open(ctypes.libraryName('X11'));
						} catch (e) {
							console.error('Integration Level 2: Could not get libX11 name; not activating', 'e:', e);
							throw new Error('Integration Level 2: Could not get libX11 name; not activating, e:' + e);
						}
					}
					break;
				case 'libc':
					lib[path] = ctypes.open(ctypes.libraryName('libc'));
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
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		// here
	};
}

var ostypes = new nixInit();