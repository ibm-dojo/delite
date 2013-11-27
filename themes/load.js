define([
	"require",
	"dojo/has",
	"dojo/_base/config",
	"../css"		// listed here for benefit of builder, so dui/css is included into the layer
], function (req, has, config) {

	"use strict";

	var themeMap = config.themeMap || [
		// summary:
		//		A map of user-agents to theme files.
		// description:
		//		The first array element is a regexp pattern that matches the
		//		userAgent string.
		//
		//		The second array element is a theme folder widget.
		//
		//		The matching is performed in the array order, and stops after the
		//		first match.

		[/Holodark|Android/, "holodark"],
		[/BlackBerry|BB10/, "blackberry"],
		[/iPhone|iPad/, "ios"],
		[/.*/, "bootstrap"]			// chrome, firefox, IE
	];

	// Get the theme
	var theme = config.theme || location.search.match(/theme=(\w+)/) ? RegExp.$1 : null;
	if (!theme) {
		var ua = config.userAgent || (location.search.match(/ua=(\w+)/) ? RegExp.$1 : navigator.userAgent);
		for (var i = 0; i < themeMap.length; i++) {
			if (themeMap[i][0].test(ua)) {
				theme = themeMap[i][1];
				break;
			}
		}
	}

	return {
		// summary:
		//		Loads the specified CSS file(s), substituting {{theme}} with the theme for the current page.
		//
		//		For example, on an iPhone load!./css/{{theme}}/common,./Button/{{theme}}/Button
		//		will load (in the following order):
		//
		//			- ./css/ios/common
		//			- ./Button/ios/Button
		//
		//		You can also pass an additional URL parameter string
		//		theme={theme widget} to force a specific theme through the browser
		//		URL input. The available theme ids are bootstrap, holodark (theme introduced in Android 3.0),
		//		blackberry, and bootstrap. The theme names are case-sensitive. If the given
		//		theme does not match, the bootstrap theme is used.
		//
		//	|	http://your.server.com/yourapp.html // automatic detection
		//	|	http://your.server.com/yourapp.html?theme=holodark // forces Holodark theme
		//	|	http://your.server.com/yourapp.html?theme=blackberry // forces Blackberry theme
		//	|	http://your.server.com/yourapp.html?theme=ios // forces iPhone theme
		//
		//		You can also specify a particular user agent through the ua=... URL parameter.

		normalize: function(logicalPaths, normalize){
			// summary:
			//		Convert relative paths to absolute ones.   By default only the first path (in the comma
			//		separated list) is converted.

			return logicalPaths.split(/, */).map(normalize).join(",");
		},

		load: function (logicalPaths, require, onload) {
			// summary:
			//		Load and install the specified CSS files for the given logicalPaths, then call onload().
			// logicalPaths: String
			//		Comma separated list of simplified paths.  They will be expanded to convert {{theme}} to
			//		the current theme.
			// require: Function
			//		AMD's require() method
			// onload: Function
			//		Callback function which will be called when the loading finishes
			//		and the stylesheet has been inserted.

			// Convert list of logical paths into list of actual paths
			// ex: Button/css/{{theme}}/Button --> Button/css/ios/Button
			var actualPaths = logicalPaths.replace(/{{theme}}/g, theme);

			// Make single call to css! plugin to load resources in order specified
			req([ "../css!" + actualPaths ], function () {
				onload(arguments);
			});
		}
	};
});
