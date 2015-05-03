var EXPORTED_SYMBOLS = ['ostypes'];

// no need to define core or import cutils as all the globals of the worker who importScripts'ed it are availble here

if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
	var is64bit = false;
} else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
	var is64bit = true;
} else {
	throw new Error('huh??? not 32 or 64 bit?!?!');
}

var gioTypes = function() {
	
	// ABIs
	this.CALLBACK_ABI = ctypes.default_abi;
	this.ABI = ctypes.default_abi;
	
	// C TYPES
	this.char = ctypes.char;
	this.void = ctypes.void_t;
	
	// SIMPLE TYPES // https://developer.gnome.org/glib/unstable/glib-Basic-Types.html#gint
	this.gchar = ctypes.char;
	this.GCancellable = ctypes.StructType('_GCancellable');
	this.GFile = ctypes.StructType('_GFile');
	this.GFileMonitor = ctypes.StructType('_GFileMonitor');
	this.gint = ctypes.int;
	this.gpointer = ctypes.void_t.ptr;
	this.guint32 = ctypes.unsigned_int;
	this.gulong = ctypes.unsigned_long;
	
	// ADVANCED TYPES
	this.gboolean = this.gint;
	this.GQuark = this.guint32;
	
	// SUPER ADVANCED TYPES // defined by "advanced types"

	
	// SUPER DUPER ADVANCED TYPES // defined by "super advanced types"

	
	// GUESS/INACCURATE TYPES AS THEY ARE ENUM OR SOMETHING I COULDNT FIND BUT THE FOLLOWING WORK FOR MY APPLICATIONS
	this.GCallback = ctypes.StructType('_GCallback').ptr;
	this.GFileMonitorEvent = ctypes.unsigned_int;
	this.GFileMonitorFlags = ctypes.unsigned_int;
	this.GClosureNotify	= ctypes.voidptr_t;
	this.GConnectFlags = ctypes.unsigned_int;
	
	// STRUCTURES
	
	// SIMPLE STRUCTS // based on any of the types above
	this.GError = ctypes.StructType('GError', [ // https://developer.gnome.org/glib/stable/glib-Error-Reporting.html#GError
		{ domain: this.GQuark },
		{ code: this.gint },
		{ message: this.gchar.ptr }
	]);
	
	// ADVANCED STRUCTS // based on "simple structs" to be defined first
	
	// FUNCTION TYPES
	this.user_function = ctypes.FunctionType(this.CALLBACK_ABI, this.void, [this.GFileMonitor.ptr, this.GFile.ptr, this.GFile.ptr, this.GFileMonitorEvent, this.gpointer]);
	
	// STRUCTS USING FUNC TYPES
	
}

var gioInit = function() {
	var self = this;
	
	this.IS64BIT = is64bit;
	
	this.TYPE = new gioTypes();

	// CONSTANTS
	this.CONST = {		
		G_FILE_MONITOR_EVENT_CHANGED: 0,
		G_FILE_MONITOR_EVENT_CHANGES_DONE_HINT: 1,
		G_FILE_MONITOR_EVENT_DELETED: 2,
		G_FILE_MONITOR_EVENT_CREATED: 3,
		G_FILE_MONITOR_EVENT_ATTRIBUTE_CHANGED: 3,
		G_FILE_MONITOR_EVENT_PRE_UNMOUNT: 4,
		G_FILE_MONITOR_EVENT_UNMOUNTED: 5,
		G_FILE_MONITOR_EVENT_MOVED: 6,
		G_FILE_MONITOR_NONE: 0,
		G_FILE_MONITOR_WATCH_MOUNTS: 1,
		G_FILE_MONITOR_SEND_MOVED: 2,
		G_FILE_MONITOR_WATCH_HARD_LINKS: 3
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
		g_file_monitor: function() {
			/* https://developer.gnome.org/gio/stable/GFile.html#g-file-monitor
			 * GFileMonitor *g_file_monitor (
			 *   GFile *file,
			 *   GFileMonitorFlags flags,
			 *   GCancellable *cancellable,
			 *   GError **error
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_monitor', self.TYPE.ABI,
				self.TYPE.GFileMonitor.ptr,		// return
				self.TYPE.GFile.ptr,			// *file
				self.TYPE.GFileMonitorFlags,	// flags
				self.TYPE.GCancellable.ptr,		// *cancellable
				self.TYPE.GError.ptr.ptr		// **error
			);
		},
		g_file_monitor_cancel: function() {
			/* https://developer.gnome.org/gio/stable/GFileMonitor.html#g-file-monitor-cancel
			 * gboolean g_file_monitor_cancel (
			 *   GFileMonitor *monitor
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_monitor_cancel', self.TYPE.ABI,
				self.TYPE.gboolean,			// return
				self.TYPE.GFileMonitor.ptr	// *monitor
			);
		},
		g_file_monitor_directory: function() {
			/* https://developer.gnome.org/gio/stable/GFile.html#g-file-monitor-directory
			 * GFileMonitor *g_file_monitor_directory (
			 *   GFile *file,
			 *   GFileMonitorFlags flags,
			 *   GCancellable *cancellable,
			 *   GError **error
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_monitor_directory', self.TYPE.ABI,
				self.TYPE.GFileMonitor.ptr,		// return
				self.TYPE.GFile.ptr,			// *file
				self.TYPE.GFileMonitorFlags,	// flags
				self.TYPE.GCancellable.ptr,		// *cancellable
				self.TYPE.GError.ptr.ptr		// **error
			);
		},
		g_file_monitor_file: function() {
			/* https://developer.gnome.org/gio/stable/GFile.html#g-file-monitor-file
			 * GFileMonitor *g_file_monitor_file (
			 *   GFile *file,
			 *   GFileMonitorFlags flags,
			 *   GCancellable *cancellable,
			 *   GError **error
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_monitor_file', self.TYPE.ABI,
				self.TYPE.GFileMonitor.ptr,		// return
				self.TYPE.GFile.ptr,			// *file
				self.TYPE.GFileMonitorFlags,	// flags
				self.TYPE.GCancellable.ptr,		// *cancellable
				self.TYPE.GError.ptr.ptr		// **error
			);
		},
		g_file_monitor_set_rate_limit: function() {
			/* https://developer.gnome.org/gio/stable/GFileMonitor.html#g-file-monitor-set-rate-limit
			 * void g_file_monitor_set_rate_limit (
			 *   GFileMonitor *monitor,
             *   gint limit_msecs
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_monitor_set_rate_limit', self.TYPE.ABI,
				self.TYPE.void,				// return
				self.TYPE.GFileMonitor.ptr,	// *monitor
				self.TYPE.gint				// limit_msecs
			);
		},
		g_file_new_for_path: function() {
			/* https://developer.gnome.org/gio/stable/GFile.html#g-file-new-for-path
			 * GFile *g_file_new_for_path (
			 *   const char *path
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_file_new_for_path', self.TYPE.ABI,
				self.TYPE.GFile.ptr,	// return
				self.TYPE.char.ptr		// *path
			);
		},
		g_object_unref: function() {
			/* https://developer.gnome.org/gobject/unstable/gobject-The-Base-Object-Type.html#g-object-unref
			 * void g_object_unref (
			 *   gpointer object
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_object_unref', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.gpointer	// object
			);
		},
		g_signal_connect_data: function() {
			/* https://developer.gnome.org/gobject/unstable/gobject-Signals.html#g-signal-connect
			 * gulong g_signal_connect_data (
			 *   gpointer instance,
			 *   const gchar *detailed_signal,
			 *   GCallback c_handler,
			 *   gpointer data,
			 *   GClosureNotify destroy_data,
			 *   GConnectFlags connect_flags
			 * );
			 */
			return lib('libgobject-2.0.so.0').declare('g_signal_connect_data', self.TYPE.ABI,
				self.TYPE.gulong,			// return
				self.TYPE.gpointer,			// instance
				self.TYPE.gchar.ptr,		// *detailed_signal
				self.TYPE.GCallback,		// c_handler
				self.TYPE.gpointer,			// data
				self.TYPE.GClosureNotify,	// destroy_data
				self.TYPE.GConnectFlags		// connect_flags
			);
		},
		g_signal_handler_disconnect: function() {
			/* https://developer.gnome.org/gobject/unstable/gobject-Signals.html#g-signal-handler-disconnect
			 * void g_signal_handler_disconnect (
			 *   gpointer instance,
			 *   gulong handler_id
			 * );
			 */
			return lib('libgio-2.0.so.0').declare('g_signal_handler_disconnect', self.TYPE.ABI,
				self.TYPE.void,		// return
				self.TYPE.gpointer,	// instance
				self.TYPE.gulong	// handler_id
			);
		}
	};
	// end - predefine your declares here
	// end - function declares
	
	this.HELPER = {
		
	};
}

var ostypes = new gioInit();