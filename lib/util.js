'use strict';

var fs = require('fs');
var path = require('path');

var connect = require('connect');

exports.watchActiveModules = function(watcher) {
	// hijack each module extension handler, and watch the file
	function injectWatcher(handler) {
		return function (module, filename) {
			fs.watchFile(filename, watcher);
			handler(module, filename);
		};
	}

	for (var ext in require.extensions) {
		var handler = require.extensions[ext];
		require.extensions[ext] = injectWatcher(handler);
	}
};

exports.parseSupervisorOpt = function(options, args) {
	if (typeof options === 'object') {
		if (typeof options.watch === 'string') {
			options.watch = [options.watch];
		}
		if (options.watch && options.watch.length) {
			args.unshift('--watch', options.watch.join());
		}

		if (typeof options.ignore === 'string') {
			options.ignore = [options.ignore];
		}
		if (options.ignore && options.ignore.length) {
			args.unshift('--ignore', options.ignore.join());
		}

		if (options.pollInterval) {
			args.unshift('--poll-interal', options.pollInterval);
		}

		if (options.extensions) {
			args.unshift('--extensions', options.extensions);
		}

		if (options.noRestartOn) {
			args.unshift('--no-restart-on', options.noRestartOn);
		}
	}

	return args;
};

exports.runServer = function (grunt, options, async) {
	var middleware = [];
	if (options.bases) {
		if (grunt.util._.isString(options.bases)) {
			options.bases = [options.bases];
		}
		// Connect requires the bases path to be absolute.
		options.bases = grunt.util._.map(options.bases, function(b) {
			return path.resolve(b);
		});

		grunt.util._.each(options.bases, function(b) {
			middleware = middleware.concat([
				// Serve static files.
				connect.static(b),
				// Make empty directories browsable.
				connect.directory(b)
			]);
		});
	}

	// If --debug was specified, enable logging.
	if (options.debug) {
		connect.logger.format('grunt', ('[D] server :method :url :status ' +
						':res[content-length] - :response-time ms').magenta);
		middleware.unshift(connect.logger('grunt'));
	}

	var server;
	if (options.server) {
		try {
			server = require(options.server);
			if (typeof server.listen !== 'function') {
				grunt.fatal('Server should provide a function called "listen" which act as http.Server.listen');
			}
			if (typeof server.use !== 'function') {
				grunt.fatal('Server should provide a function called "use" which act as connect.use');
			}
		} catch (e) {
			grunt.fatal('Server "' + options.server + '" not found');
		}
		for (var i = 0; i < middleware.length; i++) {
			server.use(middleware[i]);
		}
	} else {
		server = connect.apply(null, middleware);
	}

	// Start server.
	server.listen(options.port, options.hostname, function() {
			grunt.log.writeln('Web server started on ' + options.hostname + ':' + options.port);
		})
		.on('error', function(err) {
			if (err.code === 'EADDRINUSE') {
				grunt.fatal('Port ' + options.port + ' is already in use by another process.');
			} else {
				grunt.fatal(err);
			}
		});

	if (options.keepalive) {
		async();
	}
};