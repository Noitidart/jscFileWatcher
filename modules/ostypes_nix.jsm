var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size === 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size === 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var ifdef_UNICODE = true;

var nixTypes = function() {
  // ABIs
  this.CALLBACK_ABI = ctypes.default_abi
  this.ABI = ctypes.default_abi;
  
	// C TYPES
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.long = ctypes.long;
	this.size_t = ctypes.size_t;
	this.ssize_t = ctypes.ssize_t;
	this.uint32_t = ctypes.uint32_t;
	this.void = ctypes.void_t;
	
	// SIMPLE TYPES
	this.fd_set = ctypes.uint8_t; // This is supposed to be fd_set*, but on Linux at least fd_set is just an array of bitfields that we handle manually. link4765403
	
	//these consts need to be defined here too, they will also be found in ostypes.CONST but i need here as structs use them
	var struct_const = {
		NAME_MAX: 255
	};
		
	// SIMPLE STRUCTS
	this.inotify_event = ctypes.StructType('inotify_event', [ // http://man7.org/linux/man-pages/man7/inotify.7.html
		{ wd: this.int },													// Watch descriptor
		{ mask: this.uint32_t },											// Mask describing event
		{ cookie: this.uint32_t },											// Unique cookie associating related events (for rename(2))
		{ len: this.uint32_t },												// Size of name field
		{ name: ctypes.ArrayType(this.char, struct_const.NAME_MAX + 1) }	// Optional null-terminated name // Within a ufs filesystem the maximum length from http://www.unix.com/unix-for-dummies-questions-and-answers/4260-maximum-file-name-length.htmlof a filename is 255 and i do 256 becuause i wnant it null terminated
	]);

	this.timeval = ctypes.StructType('timeval', [
		{ 'tv_sec': this.long },
		{ 'tv_usec': this.long }
	]);
};

var nixInit = function() {
	var self = this;

	this.IS64BIT = is64bit;

	this.TYPE = new nixTypes();
	
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
  
  // CONSTANTS
  this.CONST = {
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
	
	NAME_MAX: 255 // also in TYPEs as i needed it in a struct
  };
  
	// ADV CONSTANTS
	// Helper events.
	this.CONST.IN_CLOSE = this.CONST.IN_CLOSE_WRITE | this.CONST.IN_CLOSE_NOWRITE,
	this.CONST.IN_MOVE = this.CONST.IN_MOVED_FROM | this.CONST.IN_MOVED_TO,
		
	// All events which a program can wait on.
	this.CONST.IN_ALL_EVENTS = (this.CONST.IN_ACCESS | this.CONST.IN_MODIFY | this.CONST.IN_ATTRIB | this.CONST.IN_CLOSE_WRITE | this.CONST.IN_CLOSE_NOWRITE | this.CONST.IN_OPEN | this.CONST.IN_MOVED_FROM | this.CONST.IN_MOVED_TO | this.CONST.IN_CREATE | this.CONST.IN_DELETE | this.CONST.IN_DELETE_SELF | this.CONST.IN_MOVE_SELF);

  
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
				self.TYPE.int,			// return
				self.TYPE.int,			// fd
				self.TYPE.char.ptr,	// *pathname
				self.TYPE.uint32_t		// mask
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
				self.TYPE.int,		// return
				self.TYPE.int		// flags
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
				self.TYPE.int,		// return
				self.TYPE.int,		// fd
				self.TYPE.int		// wd
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
				self.TYPE.ssize_t,		// return
				self.TYPE.int,			// fd
				self.TYPE.void.ptr, 	// *buf
				self.TYPE.size_t		// count
			);
		},
		select: function() {
			/* http://linux.die.net/man/2/select
			 * int select (
			 *   int nfds,
			 *   fd_set *readfds,
			 *   fd_set *writefds,
			 *   fd_set *exceptfds,
			 *   struct timeval *timeout
			 * );
			 */
			return lib('libc').declare('select', self.TYPE.ABI,
				self.TYPE.int,			// return
				self.TYPE.int,			// nfds
				self.TYPE.fd_set.ptr,	// *readfds  // This is supposed to be fd_set*, but on Linux at least fd_set is just an array of bitfields that we handle manually. link4765403
				self.TYPE.fd_set.ptr,	// *writefds // This is supposed to be fd_set*, but on Linux at least fd_set is just an array of bitfields that we handle manually. link4765403
				self.TYPE.fd_set.ptr,	// *exceptfds // This is supposed to be fd_set*, but on Linux at least fd_set is just an array of bitfields that we handle manually. link4765403
				self.TYPE.timeval.ptr	// *timeout
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
  
  this.HELPER = {
	fd_set_get_idx: function(fd) {
		// https://github.com/pioneers/tenshi/blob/9b3273298c34b9615e02ac8f021550b8e8291b69/angel-player/src/chrome/content/common/serport_posix.js#L497
		if (core.os.name == 'linux' /*is_linux*/) {
			// Unfortunately, we actually have an array of long ints, which is
			// a) platform dependent and b) not handled by typed arrays. We manually
			// figure out which byte we should be in. We assume a 64-bit platform
			// that is little endian (aka x86_64 linux).
			let elem64 = Math.floor(fd / 64);
			let bitpos64 = fd % 64;
			let elem8 = elem64 * 8;
			let bitpos8 = bitpos64;
			if (bitpos8 >= 8) {     // 8
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 16
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 24
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 32
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 40
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 48
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 56
				bitpos8 -= 8;
				elem8++;
			}

			return {'elem8': elem8, 'bitpos8': bitpos8};
		} else if (core.os.name == 'darwin' /*is_mac*/) {
			// We have an array of int32. This should hopefully work on Darwin
			// 32 and 64 bit.
			let elem32 = Math.floor(fd / 32);
			let bitpos32 = fd % 32;
			let elem8 = elem32 * 8;
			let bitpos8 = bitpos32;
			if (bitpos8 >= 8) {     // 8
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 16
				bitpos8 -= 8;
				elem8++;
			}
			if (bitpos8 >= 8) {     // 24
				bitpos8 -= 8;
				elem8++;
			}
        
			return {'elem8': elem8, 'bitpos8': bitpos8};
		}
	},
	fd_set_set: function(fdset, fd) {
		// https://github.com/pioneers/tenshi/blob/9b3273298c34b9615e02ac8f021550b8e8291b69/angel-player/src/chrome/content/common/serport_posix.js#L497
		let { elem8, bitpos8 } = self.HELPER.fd_set_get_idx(fd);
		console.info('elem8:', elem8.toString());
		console.info('bitpos8:', bitpos8.toString());
		fdset[elem8] = 1 << bitpos8;
	},
	fd_set_isset: function(fdset, fd) {
		// https://github.com/pioneers/tenshi/blob/9b3273298c34b9615e02ac8f021550b8e8291b69/angel-player/src/chrome/content/common/serport_posix.js#L497
		let { elem8, bitpos8 } = self.HELPER.fd_set_get_idx(fd);
		console.info('elem8:', elem8.toString());
		console.info('bitpos8:', bitpos8.toString());
		return !!(fdset[elem8] & (1 << bitpos8));
	}
  };
	
};

var ostypes = new nixInit();