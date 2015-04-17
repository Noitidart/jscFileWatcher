var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var macTypes = function() {
	
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
	this.short = ctypes.short;
	this.size_t = ctypes.size_t;
	this.uint16_t = ctypes.uint16_t;
	this.uint32_t = ctypes.uint32_t;
	this.uintptr_t = ctypes.uintptr_t
	this.uint64_t = ctypes.uint64_t;
	this.unsigned_long = ctypes.unsigned_long;
	this.void = ctypes.void_t;
	
	// ADV C TYPES
	this.time_t = this.long; // https://github.com/j4cbo/chiral/blob/3c66a8bb64e541c0f63b04b78ec2d0ffdf5b473c/chiral/os/kqueue.py#L34 AND also based on this github search https://github.com/search?utf8=%E2%9C%93&q=time_t+ctypes&type=Code&ref=searchresults AND based on this answer here: http://stackoverflow.com/a/471287/1828637
	
	// SIMPLE TYPES - as per typedef in c code in header files, docs, etc
	this.Boolean = ctypes.unsigned_char;
	this.CFIndex = ctypes.long;
	this.CFOptionFlags = ctypes.unsigned_long;
	this.CFTimeInterval = ctypes.double;
	this.CFTypeRef = ctypes.voidptr_t;
	this.ConstStr255Param = ctypes.unsigned_char.ptr;
	this.ConstStringPtr = ctypes.unsigned_char.ptr;
	this.OpaqueDialogPtr = ctypes.StructType("OpaqueDialogPtr");
	this.SInt16 = ctypes.short;
	this.SInt32 = ctypes.long;
	this.UInt16 = ctypes.unsigned_short;
	this.UInt32 = ctypes.unsigned_long;
	this.UInt64 = ctypes.unsigned_long_long;
	this.UniChar = ctypes.jschar;
	this.VOID = ctypes.void_t;
	
	// ADVANCED TYPES
	this.AlertType = this.SInt16;
	this.DialogItemIndex = this.SInt16;
	this.DialogPtr = this.OpaqueDialogPtr.ptr;
	this.EventKind = this.UInt16;
	this.FSEventStreamCreateFlags = this.UInt32;
	this.FSEventStreamEventFlags = this.UInt32;
	this.FSEventStreamEventId = this.UInt64;
	this.EventModifiers = this.UInt16;
	this.OSErr = this.SInt16;
	
	// SUPER ADVANCED TYPES
	this.DialogRef = this.DialogPtr;

	// SIMPLE STRUCTS
	
	this.__CFAllocator = ctypes.StructType('__CFAllocator');
	this.__CFArray = ctypes.StructType("__CFArray");
	this.__CFRunLoop = ctypes.StructType("__CFRunLoop");
	this.__CFString = ctypes.StructType('__CFString');
	this.__CFURL = ctypes.StructType('__CFURL');
    this.__FSEventStream = ctypes.StructType("__FSEventStream");
	this.Point = ctypes.StructType('Point', [
		{ v: this.short },
		{ h: this.short }
	]);
	this.timespec = ctypes.StructType('timespec', [ // http://www.opensource.apple.com/source/text_cmds/text_cmds-69/sort/timespec.h
		{ tv_sec: this.time_t },
		{ tv_nsec: this.long }
	]);
	
	// ADV STRUCTS
	this.CFAllocatorRef = this.__CFAllocator.ptr;
	this.CFArrayRef = this.__CFArray.ptr;
	this.CFStringRef = this.__CFString.ptr;
	this.CFURLRef = this.__CFURL.ptr;
	this.EventRecord = ctypes.StructType("EventRecord", [
		{ what: this.EventKind },
		{ message: this.unsigned_long },
		{ when: this.UInt32 },
		{ where: this.Point },
		{ modifiers: this.EventModifiers }
	]);
	this.FSEventStreamRef = this.__FSEventStream.ptr;
	this.ConstFSEventStreamRef = this.__FSEventStream.ptr;
	this.CFRunLoopRef = this.__CFRunLoop.ptr;
	
	// SIMPLE FUNCTION TYPES
	this.CFAllocatorCopyDescriptionCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.CFStringRef, [this.void.ptr]).ptr;
	this.CFAllocatorRetainCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void.ptr, [this.void.ptr]).ptr;
	this.CFAllocatorReleaseCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.void.ptr]).ptr;
	this.CFArrayCopyDescriptionCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.CFStringRef, [this.void.ptr]).ptr;
	this.CFArrayEqualCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.Boolean, [this.void.ptr, this.void.ptr]).ptr;
	this.CFArrayReleaseCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.CFAllocatorRef, this.void.ptr]).ptr;
	this.CFArrayRetainCallBack = ctypes.FunctionType(this.CALLBACK_ABI, this.void.ptr, [this.CFAllocatorRef, this.void.ptr]).ptr;
	this.FSEventStreamCallback = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.ConstFSEventStreamRef, this.void.ptr, this.size_t, this.void.ptr, this.FSEventStreamEventFlags, this.FSEventStreamEventId]).ptr;
	this.ModalFilterProcPtr = ctypes.FunctionType(this.CALLBACK_ABI, this.Boolean, [this.DialogRef, this.EventRecord.ptr, this.DialogItemIndex.ptr]).ptr;
	
	// ADVANCED FUNCTION TYPES
	this.ModalFilterUPP = this.ModalFilterProcPtr;
	
	// CRAZY ADVANCED STRUCT TYPE - uses the func types defined
	this.AlertStdAlertParamRec = ctypes.StructType("AlertStdAlertParamRec", [
		{ movable: this.Boolean },
		{ helpButton: this.Boolean },
		{ filterProc: this.ModalFilterUPP },
		{ defaultText: this.ConstStringPtr },
		{ cancelText: this.ConstStringPtr },
		{ otherText: this.ConstStringPtr },
		{ defaultButton: this.SInt16 },
		{ cancelButton: this.SInt16 },
		{ position: this.UInt16 }
	]);
	this.CFArrayCallBacks = ctypes.StructType("CFArrayCallBacks", [
		{ version: this.CFIndex },
		{ retain: this.CFArrayRetainCallBack },
		{ release: this.CFArrayReleaseCallBack },
		{ copyDescription: this.CFArrayCopyDescriptionCallBack },
		{ equal: this.CFArrayEqualCallBack }
	]);
	this.FSEventStreamContext = ctypes.StructType("FSEventStreamContext", [
		{version: this.CFIndex},
		{info: this.void.ptr},
		{retain: this.CFAllocatorRetainCallBack},
		{release: this.CFAllocatorReleaseCallBack},
		{copyDescription: this.CFAllocatorCopyDescriptionCallBack}
	]);
}

var macInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new macTypes();
	
	var _lib = {}; // cache for lib
	var lib = function(path) {
		//ensures path is in lib, if its in lib then its open, if its not then it adds it to lib and opens it. returns lib
		//path is path to open library
		//returns lib so can use straight away

		if (!(path in _lib)) {
			//need to open the library
			//default it opens the path, but some things are special like libc in mac is different then linux or like x11 needs to be located based on linux version
			switch (path) {
				case 'CarbonCore':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreServices.framework/Frameworks/CarbonCore.framework/CarbonCore');
					
					break;
				case 'CoreFoundation':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
					
					break;
				case 'FSEvents':
				
						_lib[path] = ctypes.open('/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/FSEvents');
					
					break;
				case 'objc':
				
						_lib[path] = ctypes.open(ctypes.libraryName('objc'));
					
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
	var _const = {}; // lazy load consts
	this.CONST = {
		kCFAllocatorDefault: null, // 0
		kFSEventStreamCreateFlagFileEvents: 16, // https://github.com/bizonix/DropBoxLibrarySRC/blob/2e4a151caa88b48653f31a22cb207fff851b75f8/pyc_decrypted/latest/pymac/constants.py#L165
		kFSEventStreamCreateFlagWatchRoot: 4,
		kFSEventStreamEventIdSinceNow: -1,
		get kCFTypeArrayCallBacks () { console.error('in getter'); if (!('kCFTypeArrayCallBacks' in _const)) { _const['kCFTypeArrayCallBacks'] = lib('CoreFoundation').declare('kCFTypeArrayCallBacks', self.TYPE.CFArrayCallBacks); console.error('DEFINED IN CACHE'); } return _const['kCFTypeArrayCallBacks']; },
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
		CFArrayCreate: function() {
			return lib('CoreFoundation').declare("CFArrayCreate", self.TYPE.ABI,
				self.TYPE.CFArrayRef,
				self.TYPE.CFAllocatorRef,
				self.TYPE.void.ptr.ptr,
				self.TYPE.CFIndex,
				self.TYPE.CFArrayCallBacks.ptr
			);
		},
		CFRelease: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFTypeRef/#//apple_ref/c/func/CFRelease
			 * void CFRelease (
			 *   CFTypeRef cf
			 * ); 
			 */
			return lib('CoreFoundation').declare('CFRelease', self.TYPE.ABI,
				self.TYPE.VOID,		// return
				self.TYPE.CFTypeRef	// cf
			);
		},
		CFStringCreateWithCharacters: function() {
			/* https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFStringRef/#//apple_ref/c/func/CFStringCreateWithCharacters
			 * CFStringRef CFStringCreateWithCharacters (
			 *   CFAllocatorRef alloc,
			 *   const UniChar *chars,
			 *   CFIndex numChars
			 * ); 
			 */
			return lib('CoreFoundation').declare('CFStringCreateWithCharacters', self.TYPE.ABI,
				self.TYPE.CFStringRef,		// return
				self.TYPE.CFAllocatorRef,	// alloc
				self.TYPE.UniChar.ptr,		// *chars
				self.TYPE.CFIndex			// numChars
			);
		},
		kCFTypeArrayCallBacks: function() {
			return lib('CoreFoundation').declare("kCFTypeArrayCallBacks", self.TYPE.CFArrayCallBacks);
		},
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
		FSEventStreamCreate: function() {
			return lib('FSEvents').declare('FSEventStreamCreate', self.TYPE.ABI,
				self.TYPE.FSEventStreamRef,
				self.TYPE.CFAllocatorRef,
				self.TYPE.FSEventStreamCallback,
				self.TYPE.FSEventStreamContext.ptr,
				self.TYPE.CFArrayRef,
				self.TYPE.FSEventStreamEventId,
				self.TYPE.CFTimeInterval,
				self.TYPE.FSEventStreamCreateFlags
			);
		},
		FSEventStreamCreateRelativeToDevice: function() {},
		FSEventStreamScheduleWithRunLoop: function() {
			return lib('FSEvents').declare("FSEventStreamScheduleWithRunLoop", self.TYPE.ABI,
				self.TYPE.void,
				self.TYPE.FSEventStreamRef,
				self.TYPE.CFRunLoopRef,
				self.TYPE.CFStringRef
			);
		},
		FSEventStreamStart: function() {
			return lib('FSEvents').declare("FSEventStreamStart", self.TYPE.ABI,
				self.TYPE.Boolean,
				self.TYPE.FSEventStreamRef
			);
		},
		FSEventStreamStop: function() {},
		FSEventStreamInvalidate: function() {},
		FSEventStreamRelease: function() {},
		FSEventStreamGetLatestEventId: function() {},
		FSEventStreamFlushAsync: function() {},
		FSEventStreamFlushSync: function() {},
		FSEventStreamGetDeviceBeingWatched: function() {},
		FSEventStreamCopyPathsBeingWatched: function() {},
		FSEventsCopyUUIDForDevice: function() {},
		FSEventsGetCurrentEventId: function() {
			return lib('FSEvents').declare("FSEventsGetCurrentEventId", self.TYPE.ABI,
				self.TYPE.FSEventStreamEventId
			);
		},
		FSEventsGetLastEventIdForDeviceBeforeTime: function() {},
		FSEventsPurgeEventsForDeviceUpToEventId: function() {}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		Str255: function(str) {
			return String.fromCharCode(str.length) + str;
		},
		makeCFStr: function(jsStr) {
			// js str is just a string
			// returns a CFStr that must be released with CFRelease when done
			return self.API('CFStringCreateWithCharacters')(null, jsStr, jsStr.length);
		}
	};
}

var ostypes = new macInit();
