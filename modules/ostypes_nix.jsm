/*jshint esnext: true, moz: true*/
var EXPORTED_SYMBOLS = ['ostypes'];

var core = {
	name: 'jscFileWatcher',
	id: 'jscFileWatcher@jetpack',
	path: {
		chrome: 'chrome://jscfilewatcher/content/',
		locale: 'chrome://jscfilewatcher/locale/'
	},
	aData: 0
};

importScripts(core.path.chrome + 'modules/cutils.jsm'); // used by HELPER functions

if (ctypes.voidptr_t.size === 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size === 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var ifdef_UNICODE = true;

var nixTypes = function() {};
nixTypes.prototype = {
  // ABIs
  CALLBACK_ABI: ctypes.default_abi,
  ABI: ctypes.default_abi,
  
	// SIMPLE TYPES
	char: ctypes.char,
	int: ctypes.int,
	size_t: ctypes.size_t,
	ssize_t: ctypes.ssize_t,
	uint32_t: ctypes.uint32_t,
	'void*': = ctypes.voidptr_t
};

  
// SIMPLE STRUCTS
inotify_event: ctypes.StructType('inotify_event', [ // http://man7.org/linux/man-pages/man7/inotify.7.html
	{ wd: nixTypes.prototype.int },				       // Watch descriptor
	{ mask: nixTypes.prototype.uint32_t },		 // Mask describing event
	{ cookie: nixTypes.prototype.uint32_t },	 // Unique cookie associating related events (for rename(2))
	{ len: nixTypes.prototype.uint32_t },		   // Size of name field
	{ name: ctypes.ArrayType(nixTypes.prototype.char, 256) }		// Optional null-terminated name // Within a ufs filesystem the maximum length from http://www.unix.com/unix-for-dummies-questions-and-answers/4260-maximum-file-name-length.htmlof a filename is 255 and i do 256 becuause i wnant it null terminated
])


var nixInit = function() {
  var self = this;
  
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
          break;
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
		close() {
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
		inotify_add_watch() {
			/* http://linux.die.net/man/2/inotify_add_watch
			 * int inotify_add_watch(
			 *   int fd,
			 *   const char *pathname,
			 *   uint32_t mask
			 * );
			 */
			 return lib('libc').declare('inotify_add_watch', self.TYPE.ABI,
				self.TYPE.int,			// return
				self.TYPE.int,			// fd
				self.TYPE.char.ptr,	// *pathname
				self.TYPE.uint32_t		// mask
			);
		},
		inotify_init() {
			/* http://linux.die.net/man/2/inotify_init
			 * Notes: Pass 0 as flags if you want inotify_init1 to behave as `int inotify_init(void);`
			 * int inotify_init1(
			 *   int flags
			 * );
			 */
			return lib('libc').declare('inotify_init1', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.int		// flags
			);
		},
		inotify_rm_watch() {
			/* http://linux.die.net/man/2/inotify_rm_watch
			 * int inotify_rm_watch(
			 *   int fd,
			 *   int wd
			 * );
			 */
			return lib('libc').declare('inotify_rm_watch', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.int,		// fd
				self.TYPE.int		// wd
			);
		},
		read() {
		       /* http://linux.die.net/man/2/read
			*  ssize_t read(
			*    int fd, 
			*    void *buf, 
			*    size_t count;
			*  );
			*/
			return lib('libc').declare('read', self.TYPE.ABI, 
				self.TYPE.ssize_t,		// return
				self.TYPE.int,			// fd
				self.TYPE['void*'], 	// *buf
				self.TYPE.size_t		// count
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
};
nixInit.prototype = {
  
  IS64BIT: is64bit,
  
  TYPE: new nixTypes(),
  
  // CONSTANTS
  CONST: {
    // start - INOTIFY - from https://github.com/dsoprea/PyInotify/blob/980610f91d4c3819dce54988cfec8f138599cedf/inotify/constants.py
	// had to use https://github.com/D-Programming-Language/druntime/blob/61ba4b8d3c0052065c17ffc8eef4f11496f3db3e/src/core/sys/linux/sys/inotify.d#L53
		// cuz otherwise it would throw SyntaxError: octal literals and octal escape sequences are deprecated
    // inotify_init1 flags.
    IN_CLOEXEC      : 0x80000, // octal!2000000 
    IN_NONBLOCK     : 0x800, // octal!4000
    
    // Supported events suitable for MASK parameter of INOTIFY_ADD_WATCH.
    IN_ACCESS                : 0x00000001,
    IN_MODIFY                : 0x00000002,
    IN_ATTRIB                : 0x00000004,
    IN_CLOSE_WRITE     	     : 0x00000008,
    IN_CLOSE_NOWRITE	     : 0x00000010,
    IN_OPEN                  : 0x00000020,
    IN_MOVED_FROM            : 0x00000040,
    IN_MOVED_TO              : 0x00000080,
    IN_CREATE                : 0x00000100,
    IN_DELETE                : 0x00000200,
    IN_DELETE_SELF           : 0x00000400,
    IN_MOVE_SELF             : 0x00000800,
    
    // Events sent by kernel.
    IN_UNMOUNT      : 0x00002000, // Backing fs was unmounted.
    IN_Q_OVERFLOW   : 0x00004000, // Event queued overflowed.
    IN_IGNORED      : 0x00008000, // File was ignored.

    // Special flags.
    IN_ONLYDIR             : 0x01000000, // Only watch the path if it is a directory.
    IN_DONT_FOLLOW         : 0x02000000, // Do not follow a sym link.
    IN_MASK_ADD            : 0x20000000, // Add to the mask of an already existing watch.
    IN_ISDIR               : 0x40000000, // Event occurred against dir.
    IN_ONESHOT             : 0x80000000, // Only send event once.

    // end - INOTIFY
  },
  HELPER: {
    // here
  }
};
// ADV CONSTANTS
// Helper events.
nixInit.prototype.CONST.IN_CLOSE = nixInit.prototype.CONST.IN_CLOSE_WRITE | nixInit.prototype.CONST.IN_CLOSE_NOWRITE,
nixInit.prototype.CONST.IN_MOVE = nixInit.prototype.CONST.IN_MOVED_FROM | nixInit.prototype.CONST.IN_MOVED_TO,
    
// All events which a program can wait on.
nixInit.prototype.CONST.IN_ALL_EVENTS = (nixInit.prototype.CONST.IN_ACCESS | nixInit.prototype.CONST.IN_MODIFY | nixInit.prototype.CONST.IN_ATTRIB | nixInit.prototype.CONST.IN_CLOSE_WRITE | nixInit.prototype.CONST.IN_CLOSE_NOWRITE | nixInit.prototype.CONST.IN_OPEN | nixInit.prototype.CONST.IN_MOVED_FROM | nixInit.prototype.CONST.IN_MOVED_TO | nixInit.prototype.CONST.IN_CREATE | nixInit.prototype.CONST.IN_DELETE | nixInit.prototype.CONST.IN_DELETE_SELF | nixInit.prototype.CONST.IN_MOVE_SELF);

var ostypes = new nixInit();
