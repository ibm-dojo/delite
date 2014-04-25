define(["requirejs-text/text", "./template"], function (text, template) {

	// Text plugin to load the templates and do the build.
	var textPlugin = "requirejs-text/text";
	
	function tokenize(/*String*/ text) {
		// Given a string like "hello {{foo}} world", split it into static text and property references,
		//  and return array representing the parts, ex: ["hello ", {property: "foo"}, " world"]

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

	var handlebars = {
		// summary:
		//		Plugin that loads a Handlebars template from a specified MID, and returns a function to
		//		generate DOM corresponding to that template, and set up handlers
		//		to modify the generated DOM as widget properties change.  The returned function is meant
		//		to run in the context of the widget, so that properties are available through "this" and
		//		so is a watch() method to monitor changes to those properties.
		//
		//		Can also be used by the build-tool to precompile templates, assuming you load
		//		https://github.com/tmpvar/jsdom to provide methods like document.createElement().

		//		TODO: loops like <ul>{{#each ary}}<span>{{foo}}</span>{{/each}}</ul>
		//		where ary is an array like [{foo: 123},...].  In this case the parent node
		//		(<ul> in this example) can't have any other children besides what's defined by
		//		the {{#each ary}}...{{/ary}} block.

		parseNode: function (/*DOMNode*/ templateNode, /*String?*/ xmlns) {
			// summary:
			//		Scan a single Element (not text node, not branching node like {{#if}}, but regular DOMNode

			// Get tag name, reversing the tag renaming done in parse()
			var tag = templateNode.tagName.replace(/^template-/i, "").toLowerCase();

			// Process attributes
			var attributes = {}, attachPoints;
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
						attributes[item.name] = tokenize(item.value);
					}
				}
			}

			return {
				tag: tag,
				xmlns: xmlns,
				attributes: attributes,
				children: handlebars.parseChildren(templateNode, xmlns),
				attachPoints: attachPoints
			};
		},

		parseChildren: function (/*DOMNode*/ templateNode, /*String?*/ xmlns) {
			// summary:
			//		Scan child nodes, both text and Elements

			var children = [];

			for (var child = templateNode.firstChild; child; child = child.nextSibling) {
				var childType = child.nodeType;
				if (/each|if/i.test(child.tagName)) {
					children.push({
						branch: child.attributes.condition.nodeValue,
						children: this.parseChildren(child, xmlns)
					});
					// TODO: handle <each> tags
				} else if (childType === 1) {
					// Standard DOM node, recurse
					children.push(handlebars.parseNode(child, xmlns));
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

		parse: function (/*String*/ templateText) {
			// summary:
			//		Given a template, returns the tree representing that template.
			//		Will only run in a browser, or in node.js with https://github.com/tmpvar/jsdom.

			// Adjust the template, putting if statements and looping statements inside their own
			// <each> and <if> blocks.
			var adjustedTemplate = templateText.replace(/{{#(each|if) +([^}]+)}}/g,
					"<$1 condition='$2'>").replace(/{{\/[^}]+}}/g, "</$1>");

			// Also, rename all the custom elements in the template so that browsers with native
			// document.createElement() support don't start instantiating nested widgets, creating internal nodes etc.
			// Regex designed to match <foo-bar> and <button is=...> but not <!-- comment -->, and not
			// native tags like <br>...except for <template> itself, which needs to be renamed for some reason.
			adjustedTemplate = adjustedTemplate.replace(
				/(<\/? *)([a-zA-Z0-9]+-[-a-zA-Z0-9]+|template|[a-zA-Z]+[^>]+is=)/g, "$1template-$2");

			// Create DOM tree from template.
			// If template contains SVG nodes then parse as XML, to preserve case of attributes like viewBox.
			// Otherwise parse as HTML, to allow for missing closing tags, ex: <ul> <li>1 <li>2 </ul>.
			var root;
			if (/<svg/.test(templateText)) {
				var parser = new DOMParser();
				root = parser.parseFromString(adjustedTemplate, "text/xml").firstChild;
				while (root.nodeType !== 1) {
					// Skip top level comment and move to "real" template root node.
					// Needed since there's no .firstElementChild or .nextElementSibling for SVG nodes on FF.
					root = root.nextSibling;
				}
			} else {
				// Use innerHTML because Safari doesn't support DOMParser.parseFromString(str, "text/html")
				var container = document.createElement("div");
				container.innerHTML = adjustedTemplate;
				root = container.firstElementChild; // use .firstElementChild to skip possible top level comment
			}

			return handlebars.parseNode(root);
		},

		compile: function (templateText) {
			// summary:
			//		Given a template, returns a function to generate DOM corresponding to that template,
			//		and setup listeners (using `Widget.watch()`) to propagate changes in the widget
			//		properties to the templates.
			// template: String
			//		See module description for details on template format.
			// returns: Function
			//		Returns a function that optionally takes a top level node, or creates it if not passed in, and
			//		then creates the rest of the DOMNodes in the template

			var tree = handlebars.parse(templateText);
			var func = template.compile(tree);
			return func;
		},

		load: function (mid, require, onload, config) {
			// summary:
			//		Returns a function to generate the DOM specified by the template.
			//		This is the function run when you use this module as a plugin.
			// mid: String
			//		Absolute path to the resource.
			// require: Function
			//		AMD's require() method
			// onload: Function
			//		Callback function which will be called, when the loading finishes
			//		and the stylesheet has been inserted.
			// config: Object
			//		A configuration object with isLoad=true when doing a build.

			require([textPlugin + "!" + mid], function (template) {
				onload(handlebars.compile(template));
			});
		},

		pluginBuilder: textPlugin
	};

	return handlebars;
});