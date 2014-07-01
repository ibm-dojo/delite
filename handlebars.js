/**
 * Plugin that loads a Handlebars template from a specified MID, and returns a function to
 * generate DOM corresponding to that template, and set up handlers
 * to modify the generated DOM as widget properties change.  The returned function is meant
 * to run in the context of the widget, so that properties are available through `this` and
 * so is a `watch()` method to monitor changes to those properties.
 *
 * Could also theoretically be used by a build-tool to precompile templates, assuming you loaded
 * [jsdom](https://github.com/tmpvar/jsdom) to provide methods like `document.createElement()`.
 *
 * Template has a format like:
 *
 * ```html
 * <button>
 *   <span class="d-reset {{iconClass}}"></span>
 *   {{label}}
 * </button>
 * ```
 * 
 * Usage is typically like:
 * 
 * ```js
 * define([..., "delite/handlebars!./templates/MyTemplate.html"], function(..., renderFunc){
 *     ...
 *     buildRendering: renderFunc,
 *     ...
 * });
 * ```
 * 
 * @module delite/handlebars
 */
define(["./template"], function (template) {

	// Text plugin to load the templates and do the build.
	var textPlugin = "requirejs-text/text";


	/**
	 * Given a string like "hello {{foo}} world", split it into static text and property references,
	 * and return array representing the parts, ex: `["hello ", {property: "foo"}, " world"]`.
	 * @param {string} text
	 * @returns {Array}
	 */
	function tokenize(text) {
		var inVar, parts = [];

		if (text) {
			text.split(/({{|}})/).forEach(function (str) {
				if (str === "{{") {
					inVar = true;
				} else if (str === "}}") {
					inVar = false;
				} else if (str) {
					parts.push(inVar ? { property: str.trim() } : str);
				}
			});
		}

		return parts;
	}

	var handlebars = /** @lends module:delite/handlebars */ {
		/**
		 * Given a template in DOM, returns the Object tree representing that template.
		 * @param {Element} templateNode - Root node of template.
		 * @param {string} [xmlns] - Used primarily for SVG nodes.
		 * @returns {Object} Object in format
		 * `{tag: string, xmlns: string, attributes: {}, children: Object[], attachPoints: string[]}`.
		 * @private
		 */
		parse: function (templateNode, xmlns) {
			// Get tag name, reversing the tag renaming done in parse()
			var tag = templateNode.tagName.replace(/^template-/i, "").toLowerCase();

			// Process attributes
			var attributes = {}, connects = {}, attachPoints;
			var i = 0, item, attrs = templateNode.attributes;
			for (i = 0; (item = attrs[i]); i++) {
				if (item.value) {
					switch (item.name) {
					case "xmlns":
						xmlns = item.value;
						break;
					case "is":
						tag = item.value;
						break;
					case "data-attach-point":
						attachPoints = item.value.split(/, */);
						break;
					default:
						if (/^on-/.test(item.name)) {
							// on-click="{{handlerMethod}}" sets connects.click = "handlerMethod"
							connects[item.name.substring(3)] = item.value.replace(/\s*({{|}})\s*/g, "");
						} else {
							// x="hello {{foo}} world" sets attributes.x = ["hello ", {property: "foo"}, " world"]
							attributes[item.name] = tokenize(item.value);
						}
					}
				}
			}

			return {
				tag: tag,
				xmlns: xmlns,
				attributes: attributes,
				connects: connects,
				children: handlebars.parseChildren(templateNode, xmlns),
				attachPoints: attachPoints
			};
		},

		/**
		 * Scan child nodes, both text and Elements.
		 * @param {Element} templateNode
		 * @param {string} [xmlns] - Used primarily for SVG nodes.
		 * @returns {Array}
		 * @private
		 */
		parseChildren: function (templateNode, xmlns) {
			var children = [];

			for (var child = templateNode.firstChild; child; child = child.nextSibling) {
				var childType = child.nodeType;
				if (childType === 1) {
					// Standard DOM node, recurse
					children.push(handlebars.parse(child, xmlns));
				} else if (childType === 3) {
					// Text node likely containing variables like {{foo}}.
					children = children.concat(tokenize(child.nodeValue));
				}
			}

			// Optimization to avoid generating unnecessary createTextNode() calls:
			// Trim starting and ending whitespace nodes, but not whitespace in the middle, so that
			// the following example only ends up with one whitespace node between hello and world:
			//
			// <div>\n\t<span>hello</span>< span>world</span>\n</div>
			//
			// Also, avoid using trim() since that removes &nbsp; nodes.
			if (children.length && templateNode.tagName !== "PRE") {
				var start = 0, end = children.length - 1;
				while (/^[ \t\n]*$/.test(children[start]) && start < end) {
					start++;
				}
				if (typeof children[start] === "string") {
					children[start] = children[start].replace(/^[ \t\n]+/, "");
				}
				while (/^[ \t\n]*$/.test(children[end]) && end > start) {
					end--;
				}
				if (typeof children[end] === "string") {
					children[end] = children[end].replace(/[ \t\n]+$/, "");
				}
				children = children.slice(start, end + 1);
			}

			return children;
		},


		/**
		 * Given a template string, returns the DOM tree representing that template.
		 * Will only run in a browser, or in node.js with https://github.com/tmpvar/jsdom.
		 * @param {string} templateText - HTML text for template.
		 * @returns {Element} Root element of tree
		 * @private
		 */
		toDom: function (templateText) {
			// Rename all the custom elements in the template so that browsers with native
			// document.createElement() support don't start instantiating nested widgets, creating internal nodes etc.
			// Regex designed to match <foo-bar> and <button is=...> but not <!-- comment -->, and not
			// native tags like <br>...except for <template> itself, which needs to be renamed for some reason.
			templateText = templateText.replace(
				/(<\/? *)([a-zA-Z0-9]+-[-a-zA-Z0-9]+|template|[a-zA-Z]+[^>]+is=)/g, "$1template-$2");

			// Create DOM tree from template.
			// If template contains SVG nodes then parse as XML, to preserve case of attributes like viewBox.
			// Otherwise parse as HTML, to allow for missing closing tags, ex: <ul> <li>1 <li>2 </ul>.
			var root;
			if (/<template-svg/.test(templateText)) {
				var parser = new DOMParser();
				root = parser.parseFromString(templateText, "text/xml").firstChild;
				while (root.nodeType !== 1) {
					// Skip top level comment and move to "real" template root node.
					// Needed since there's no .firstElementChild or .nextElementSibling for SVG nodes on FF.
					root = root.nextSibling;
				}
			} else {
				// Use innerHTML because Safari doesn't support DOMParser.parseFromString(str, "text/html")
				var container = document.createElement("div");
				container.innerHTML = templateText;
				root = container.firstElementChild; // use .firstElementChild to skip possible top level comment
			}

			return root;
		},

		/**
		 * Given a template, returns a function to generate DOM corresponding to that template,
		 * and setup listeners (using `Widget.watch()`) to propagate changes in the widget
		 * properties to the templates.
		 *
		 * This method is usually only called directly when your template contains custom elements,
		 * and a call to handlebars!myTemplate.html might try to compile the template before the custom
		 * elements were loaded.
		 *
		 * @param {string} template - See module description for details on template format.
		 * @returns {Function} - Function that optionally takes a top level node, or creates it if not passed in, and
		 * then creates the rest of the DOMNodes in the template.
		 */
		compile: function (templateText) {
			var templateDom = handlebars.toDom(templateText);
			var tree = handlebars.parse(templateDom);
			var func = template.compile(tree);
			return func;
		},

		/**
		 * Returns a function to generate the DOM specified by the template.
		 * Also loads any AMD dependencies specified on the template's root node via the `data-requires` property.
		 * This is the function run when you use this module as a plugin.
		 * @param {string} mid - Absolute path to the resource.
		 * @param {Function} require - AMD's require() method.
		 * @param {Function} onload - Callback function which will be called, when the loading finishes
		 *     and the stylesheet has been inserted.
		 * @private
		 */
		load: function (mid, require, onload) {
			require([textPlugin + "!" + mid], function (templateText) {
				var templateDom = handlebars.toDom(templateText),
					requires = templateDom.getAttribute("data-requires") || "";
				templateDom.removeAttribute("data-requires");
				require(requires.split(/,\s*/), function () {
					var tree = handlebars.parse(templateDom);
					var func = template.compile(tree);
					onload(func);
				});
			});
		},

		pluginBuilder: textPlugin
	};

	return handlebars;
});