var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var kqTypes = function() {
	
	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
	
	// C TYPES - also simple types but just not really specific to os - i even define these here, in case i want to change everything global. if i had done ctypes.uint32_t in places, i couldn't do a global change, but with ostypes.TYPE.uint32_t i can do global change
	this.char = ctypes.char;
	this.int = ctypes.int;
	this.int16_t = ctypes.int16_t;
	this.int64_t = ctypes.int64_t;
	this.intptr_t = ctypes.intptr_t;
	this.long = ctypes.long;
	this.off_t = ctypes.off_t;
	this.quad_t = ctypes.long_long;
	this.short = ctypes.short;
	this.size_t = ctypes.size_t;
	this.u_int = ctypes.unsigned_int;
	this.u_short = ctypes.unsigned_short;
	this.uint16_t = ctypes.uint16_t;
	this.uint32_t = ctypes.uint32_t;
	this.uintptr_t = ctypes.uintptr_t
	this.uint64_t = ctypes.uint64_t;
	this.void = ctypes.void_t;
	
	// ADV C TYPES
	this.time_t = this.long; // https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L34 AND also based on this github search https://github.com/search?utf8=%E2%9C%93&q=time_t+ctypes&type=Code&ref=searchresults AND based on this answer here: http://stackoverflow.com/a/471287/1828637

	// SIMPLE TYPES
	this.ino_t = ctypes.unsigned_long; // http://stackoverflow.com/questions/9073667/where-to-find-the-complete-definition-of-off-t-type and chatted with arai and we're very sure its ctypes.unsigned_long which is arch dependent
	this.DIR = ctypes.StructType('DIR');
	this.FILE = ctypes.StructType('FILE');
	
	// SIMPLE STRUCTS
	// mac: http://www.opensource.apple.com/source/xnu/xnu-1456.1.26/bsd/sys/event.h
	// freebsd: 
	if (core.os.name == 'darwin') {
		this.kevent = ctypes.StructType('kevent', [ // http://www.opensource.apple.com/source/xnu/xnu-1456.1.26/bsd/sys/event.h
			{ ident: this.uintptr_t },
			{ filter: this.int16_t },
			{ flags: this.uint16_t },
			{ fflags: this.uint32_t },
			{ data: this.intptr_t },
			{ udata: this.void.ptr }
		]);
	} else if (core.os.name == 'freebsd' || core.os.name == 'openbsd') {
		this.kevent = ctypes.StructType('kevent', [
			{ ident: this.uintptr_t },
			{ filter: this.short },
			{ flags: this.u_short },
			{ fflags: this.u_int },
			{ data: this.quad_t },
			{ udata: this.void.ptr }
		]);
	} else if (core.os.name == 'netbsd') {
		this.kevent = ctypes.StructType('kevent', [ // http://netbsd.gw.com/cgi-bin/man-cgi?kqueue++NetBSD-current
			{ ident: this.uintptr_t },
			{ filter: this.uint32_t },
			{ flags: this.uint32_t },
			{ fflags: this.uint32_t },
			{ data: this.int64_t },
			{ udata: this.void.ptr } // should be `this.intptr_t` but setting to void.ptr
		]);
	}
	
	this.timespec = ctypes.StructType('timespec', [ // http://www.opensource.apple.com/source/text_cmds/text_cmds-69/sort/timespec.h
		{ tv_sec: this.time_t },
		{ tv_nsec: this.long }
	]);
	
	// start - build dirent struct
	var OSFILE_OFFSETOF_DIRENT_D_INO = 0; // im guessing this is always at 0, by looking at a bunch of places and d_ino was always first
	var dirent_extra_size = 0;
	if (OS.Constants.libc.OSFILE_SIZEOF_DIRENT_D_NAME < 8) {
		// d_name is defined like "char d_name[1];" on some platforms (e.g. Solaris), we need to give it more size for our structure.
		dirent_extra_size = 255;
	}
	this.dirent = createStructTypeBasedOnOffsets('dirent', OS.Constants.libc.OSFILE_SIZEOF_DIRENT + dirent_extra_size, [
		['d_ino', this.ino_t, OSFILE_OFFSETOF_DIRENT_D_INO],
		['d_name', this.char.array(OS.Constants.libc.OSFILE_SIZEOF_DIRENT_D_NAME + dirent_extra_size), OS.Constants.libc.OSFILE_OFFSETOF_DIRENT_D_NAME]
	]);
	// end - build dirent struct
}

var kqInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new kqTypes();

	// CONSTANTS
	this.CONST = {
		
		// start - kqueue - https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L122
		EVFILT_READ: -1,
		EVFILT_WRITE: -2,
		EVFILT_AIO: -3,
		EVFILT_VNODE: -4,
		EVFILT_PROC: -5,
		EVFILT_SIGNAL: -6,
		EVFILT_TIMER: -7,
		//EVFILT_MACHPORT: -8, // for mac only, in BSD it is: EVFILT_PROCDESC
		EVFILT_FS: -9,

		EV_ADD: 0x0001,		// add event to kq (implies enable)
		EV_DELETE: 0x0002,	// delete event from kq
		EV_ENABLE: 0x0004,	// enable event
		EV_DISABLE: 0x0008,	// disable event (not reported)
		EV_ONESHOT: 0x0010,	// only report one occurrence
		EV_CLEAR: 0x0020,	// clear event state after reporting
		EV_SYSFLAGS: 0xF000,	// reserved by system
		EV_FLAG0: 0x1000,	// filter-specific flag
		EV_FLAG1: 0x2000,	// filter-specific flag
		EV_EOF: 0x8000,		// EOF detected
		EV_ERROR: 0x4000,	// error, data contains errno
		
		// https://github.com/jonnybest/taskcoach/blob/f930e55fa895315e9e9688994aa8dbc10b09b1e5/taskcoachlib/filesystem/fs_darwin.py#L35
		NOTE_DELETE: 0x00000001,
		NOTE_WRITE: 0x00000002,
		NOTE_EXTEND: 0x00000004,
		NOTE_ATTRIB: 0x00000008,
		NOTE_LINK: 0x00000010,
		NOTE_RENAME: 0x00000020,
		NOTE_REVOKE: 0x00000040,
		
		// end - kqueue
	};
	
	// os specific consts
	if (core.os.name == 'darwin') {
		self.CONST.EVFILT_MACHPORT = -8;
	} else if (core.os.name == 'freebsd' || core.os.name == 'openbsd') {
		self.CONST.EVFILT_PROCDESC = -8;
	}
	
	var _lib = {}; // cache for lib
	var lib = function(path) {
		//ensures path is in lib, if its in lib then its open, if its not then it adds it to lib and opens it. returns lib
		//path is path to open library
		//returns lib so can use straight away

		if (!(path in _lib)) {
			//need to open the library
			//default it opens the path, but some things are special like libc in mac is different then linux or like x11 needs to be located based on linux version
			switch (path) {
				case 'libc':
				
					if (core.os.name == 'darwin') {
						_lib[path] = ctypes.open('libc.dylib');
					} else if (core.os.name == 'freebsd') {
						_lib[path] = ctypes.open('libc.so.7');
					} else if (core.os.name == 'openbsd') {
						_lib[path] = ctypes.open('libc.so.61.0');
					} else if (core.os.name == 'sunos') {
						_lib[path] = ctypes.open('libc.so');
					} else {
						throw new Error({
							name: 'watcher-api-error',
							message: 'Path to libc on operating system of , "' + OS.Constants.Sys.Name + '" is not supported for kqueue'
						});
					}
					
					break;
				default:
					try {
						_lib[path] = ctypes.open(path);
					} catch (e) {
						throw new Error({
							name: 'watcher-api-error',
							message: 'Could not open ctypes library path of "' + path + '"',
							ex_msg: ex.message
						});
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
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/close.2.html#//apple_ref/doc/man/2/close
			 * int close (
			 *   int fildes
			 * ); 
			 */
			return lib('libc').declare('close', self.TYPE.ABI,
				self.TYPE.int,	// return
				self.TYPE.int	// fildes
			);
		},
		closedir: function() {
			/* http://linux.die.net/man/3/closedir
			 * https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/closedir.3.html
			 * int closedir (
			 *   DIR *dirp
			 * );
			 */
			return lib('libc').declare('closedir', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.DIR.ptr	// *dirp
			);
		},
		kevent: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			 * int kevent (
			 *   int kq,
			 *   const struct kevent *changelist,
			 *   int nchanges,
			 *   struct kevent *eventlist,
			 *   int nevents,
			 *   const struct timespec *timeout
			 * ); 
			 */
			return lib('libc').declare('kevent', self.TYPE.ABI,
				self.TYPE.int,			// return
				self.TYPE.int,			// kq
				self.TYPE.kevent.ptr,	// *changelist
				self.TYPE.int,			// nchanges
				self.TYPE.kevent.ptr,	// *eventlist
				self.TYPE.int,			// nevents
				self.TYPE.timespec.ptr	// *timeout
			);
		},
		kqueue: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			 * int kqueue (
			 *   void
			 * ); 
			 */
			return lib('libc').declare('kqueue', self.TYPE.ABI,
				self.TYPE.int	// return
			);
		},
		open: function() {
			/* https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/open.2.html
			 * int open (
			 *   const char *path
			 *   int oflag
			 * ); 
			 */
			return lib('libc').declare('open', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.char.ptr,	// *path
				self.TYPE.int		// oflag
			);
		},
		opendir: function() {
			/* http://linux.die.net/man/3/opendir
			 * https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/opendir.3.html
			 * DIR *opendir (
			 *   const char *name
			 * );
			 */
			return lib('libc').declare('opendir', self.TYPE.ABI,
				self.TYPE.DIR.ptr,	// return
				self.TYPE.char.ptr	// *name
			);
		},
		readdir: function() {
			/* http://linux.die.net/man/3/readdir
			 * https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/readdir.3.html
			 * WARNING: Cannot call readdir from multiple threads on same directory path, it will break, thanks to discussion with @arai on #jsctypes
			 * struct dirent *readdir (
			 *   DIR *dirp
			 * );
			 */
			return lib('libc').declare('readdir', self.TYPE.ABI,
				self.TYPE.dirent.ptr,	// return
				self.TYPE.DIR.ptr		// *dirp
			);
		},
		readdir_r: function() {
			/* http://linux.die.net/man/3/readdir
			 * https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man3/readdir.3.html
			 * int readdir_r (
			 *   DIR *dirp
			 *   struct dirent *entry
			 *   struct dirent **result
			 * );
			 */
			return lib('libc').declare('readdir_r', self.TYPE.ABI,
				self.TYPE.int,				// return
				self.TYPE.DIR.ptr,			// *dirp
				self.TYPE.dirent.ptr,		// *entry
				self.TYPE.dirent.ptr.ptr	// **result
			);
		},
		popen: function() {
			/* http://linux.die.net/man/3/popen
			 * FILE *popen (
			 *   const char *command,
			 *   const char *type
			 * );
			 */
			return lib('libc').declare('popen', self.TYPE.ABI,
				self.TYPE.FILE.ptr,	// return
				self.TYPE.char.ptr,	// *command
				self.TYPE.char.ptr	// *type
			);
		},
		fread: function() {
			/* http://linux.die.net/man/3/fread
			 * size_t fread (
			 *   void *ptr,
			 *   size_t size,
			 *   size_t nmemb,
			 *   FILE *stream
			 * );
			 */
			return lib('libc').declare('fread', self.TYPE.ABI,
				self.TYPE.size_t,	// return
				self.TYPE.void.ptr,	// *ptr
				self.TYPE.size_t,	// size
				self.TYPE.size_t,	// nmemb
				self.TYPE.FILE.ptr	// *stream
			);
		},
		pclose: function() {
			/* http://linux.die.net/man/3/pclose
			 * int pclose (
			 *   FILE *stream
			 * );
			 */
			return lib('libc').declare('pclose', self.TYPE.ABI,
				self.TYPE.int,		// return
				self.TYPE.FILE.ptr	// *stream
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		EV_SET: function EV_SET(kev_address, ident, filter, flags, fflags, data, udata) {
			// macro
			// docs say args are: &kev, ident, filter, flags, fflags, data, udata // docs are here: https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man2/kqueue.2.html
			console.info('kev_address:', kev_address.toString(), uneval(kev_address));
			console.info('kev_address.contents:', kev_address.contents.toString(), uneval(kev_address.contents));
			kev_address.contents.addressOfField('ident').contents = ident;
			kev_address.contents.addressOfField('filter').contents = filter;
			kev_address.contents.addressOfField('flags').contents = flags;
			kev_address.contents.addressOfField('fflags').contents = fflags;
			kev_address.contents.addressOfField('data').contents = data;			
			kev_address.contents.addressOfField('udata').contents = udata;
		}
	};
}

function createStructTypeBasedOnOffsets(structName, totalSize, arrFields) {
	// remove fields for which offset is undefined, this means that this OS does not have this field
	for (var i = 0; i < arrFields.length; i++) {
		if (arrFields[i][2] === undefined) {
			console.warn('removing field named ' + arrFields[i][0])
			arrFields.splice(i, 1);
			i--;
		}
	}

	// sort fields in asc order of offset
	arrFields.sort(function(a, b) {
		return a[2] > b[2]; // sorts ascending
	});

	// add padding of ctypes.uint8_t in between fields
	var paddingFieldCnt = 0;
	var cOffset = 0;
	for (var i = 0; i < arrFields.length; i++) {
		var nextOffset = arrFields[i][2];
		console.log('cOffset:', cOffset, 'nextOffset:', nextOffset);
		if (nextOffset == cOffset) {
			console.log('this field should be here, so go on to next');
		} else if (nextOffset > cOffset) {
			console.log('nextOffset is greater then cOffset');
			var paddingFieldName = 'padding_' + paddingFieldCnt;
			arrFields.splice(i, 0, [paddingFieldName, ctypes.ArrayType(ctypes.uint8_t, nextOffset - cOffset), cOffset]);
			cOffset += nextOffset - cOffset;
			i++;
			paddingFieldCnt++;
		}
		cOffset += arrFields[i][1].size;
	}
	if (cOffset < totalSize) {
		var paddingFieldName = 'padding_' + paddingFieldCnt;
		arrFields.push([paddingFieldName, ctypes.ArrayType(ctypes.uint8_t, totalSize - cOffset), cOffset]);
		cOffset += totalSize - cOffset;
	}
	console.log('total size:', cOffset);

	console.log('arrFields:', arrFields.join('|||').toString());

	var feedArr = [];
	for (var i = 0; i < arrFields.length; i++) {
		var cField = {};
		cField[arrFields[i][0]] = arrFields[i][1];
		feedArr.push(cField);
	}

	console.log(uneval(ctypes.StructType(structName, feedArr)));
	return ctypes.StructType(structName, feedArr);
}

var ostypes = new kqInit();