define([
	"intern!object",
	"intern/chai!assert",
	"dcl/advise",
	"decor/Stateful",
	"delite/register",
	"delite/CustomElement",
	"requirejs-domready/domReady!"
], function (registerSuite, assert, advise, Stateful, register, CustomElement) {

	var container;
	var calls = 0;
	var MyCustomElement;

	var obj = {
		foo: function () {
			// summary: empty function that we connect to
		}
	};

	// track calls to attributeChangedCallback;
	var accCalls = [];

	// track calls to refreshRendering()
	var rrCalls = [];

	/*jshint multistr: true */
	var html = "<test-ce-foo id='one' name='bob' attr1=10 attr2=10></test-ce-foo> \
		<test-ce-foo id='two' name='is' attr1=5 attr2=10></test-ce-foo> \
		<div id='threeWrapper'> \
		<test-ce-bar id='three' name='your' attr1=5 attr2=5> \
		<div id='three.one'> \
		<div id='three.one.one'></div> \
		<test-ce-bar id='four' name='uncle' attr1=10 attr2=5></test-ce-bar> \
		</div> \
		</test-ce-bar> \
		</div> \
		<div id='not-a-custom-element'></div>";

	registerSuite({
		name: "CustomElement",

		beforeEach: function () {
			container = document.createElement("div");
			document.body.appendChild(container);
		},


		afterEach: function () {
			container.parentNode.removeChild(container);
		},

		instantiation: {
			"declarative attributes": function () {
				/* global global:true */
				global = 0;

				/* global globalObj:true */
				globalObj = { text: "global var" };

				/* global globalInstance:true */
				globalInstance = {
					func: function () {
						global = 456;
					}
				};

				container.innerHTML +=
					"<test-ce-declarative id='d' boolProp='boolProp' numProp='5' stringProp='hello' " +
					"funcProp='global=123;' funcProp2='globalInstance.func' " +
					"objProp1='foo:1,bar:2' objProp2='globalObj'/>";
				var d = document.getElementById("d");
				var def = this.async(1000);
				var listenerCalled = false;
				// in Chrome (native custom elements) this should happen as soon as the registration will occur,
				// on other browser this should happen right after upgrade
				d.addEventListener("customelement-attached", def.rejectOnError(function (evt) {
					assert.strictEqual(evt.target, d, "customelement-attached target");
					listenerCalled = true;
				}));

				register("test-ce-declarative", [HTMLElement, CustomElement], {
					boolProp: false,
					numProp: 0,
					stringProp: "",
					funcProp: function () {
					},
					funcProp2: function () {
					},
					objProp1: { },
					objProp2: { }
				});


				register.upgrade(d);
				assert.isTrue(listenerCalled, "listener called");
				assert.isTrue(d.boolProp, "d.boolProp");

				assert.strictEqual(d.numProp, 5, "d.numProp");
				assert.strictEqual(d.stringProp, "hello", "d.stringProp");
				d.funcProp();
				assert.strictEqual(global, 123, "d.funcProp() executed");
				d.funcProp2();
				assert.strictEqual(global, 456, "d.funcProp2() executed");
				assert.strictEqual(d.objProp1.foo, 1, "d.objProp1.foo");
				assert.strictEqual(d.objProp1.bar, 2, "d.objProp1.bar");
				assert.strictEqual(d.objProp2.text, "global var", "d.objProp2.text");
				def.resolve();
				return def;
			},

			"setter not called on creation": function () {
				// Setters are no longer called on creation except for parameters sent to new Foo(...)
				var fooSetterCalled = false;
				var MyCustomElement = register("my-custom-element", [HTMLElement, CustomElement], {
					foo: 345,
					_setFooAttr: function (val) {
						fooSetterCalled = val;
						this._set("foo", val);
					}
				});
				var instance = new MyCustomElement();
				assert(instance, "instance created");
				assert.strictEqual(fooSetterCalled, false, "fooSetterCalled");
			}
		},

		"own and destroy": function () {
			// Setup ownership
			register("test-ce-lifecycle-custom-element", [HTMLElement, CustomElement], {
				createdCallback: function () {
					// Rather odd call to this.own() for testing the connections are dropped on destroy()
					this.own(advise.after(obj, "foo", function () {
						calls++;
					}, true));
				}
			});

			container.innerHTML +=
				"<test-ce-lifecycle-custom-element id='w1'></test-ce-lifecycle-custom-element>" +
				"<test-ce-lifecycle-custom-element id='w2'></test-ce-lifecycle-custom-element>";
			register.parse(container);

			// test the connection
			assert.strictEqual(calls, 0, "foo() not called yet");
			obj.foo();
			assert.strictEqual(calls, 2, "foo() called from each custom element");


			// Then destroy
			var w = document.getElementById("w1");
			w.destroy();
			assert.ok(!document.getElementById("w1"), "custom element no longer exists");

			// test the connection from w1 was destroyed (w2 still there)
			calls = 0;
			obj.foo();
			assert.strictEqual(calls, 1, "connection was deleted");

			// test the DOM node was removed
			assert.ok(!document.getElementById("w1"), "DOM Node removed");
		},

		"#on": {
			programmatic: function () {
				// Create a custom element with a custom "foo" event, plus the standard "click" event.
				var MyCustomElement = register("my-widget2-on", [HTMLElement, CustomElement], {});

				var evt = null, clicked = 0;
				var w = new MyCustomElement({});
				w.on("foo", function (e) {
					evt = e;
				});
				w.on("click", function () {
					clicked++;
				});
				container.appendChild(w);

				w.emit("foo");
				assert.isNotNull(evt, "on('foo', ...) was called with event object");

				w.emit("click");
				assert.strictEqual(clicked, 1, "one click event");
			},

			declarative: function () {
				// Test that declarative instantiation (on-foo=...) works,
				// and also that CustomElement.on() works.

				// Define a custom element that emits two events, "click" and "custom".
				// You can catch the events via either programmatic on("click", ...) or declarative on-custom=...
				// syntax.
				MyCustomElement = register("my-custom-element-on", [HTMLElement, CustomElement], { });

				// Create variables accessed from the declarative custom element (see definition in <body>)
				/* global globalClicked:true */
				globalClicked = 0;
				/* global globalCustom:true */
				globalCustom = 0;
				/* global globalType:true */
				globalType = null;

				container.innerHTML =
					"<my-custom-element-on id='MyCustomElement' on-click='globalClicked++;' " +
					"on-custom='globalCustom++; globalType=event.type;'>hi</my-CustomElement-on>";
				register.parse(container);

				var MyCustomElement = document.getElementById("MyCustomElement");

				var clicked = 0;
				MyCustomElement.on("click", function () {
					clicked++;
				});
				MyCustomElement.emit("click");
				assert.strictEqual(clicked, 1, ".on('clicked', ...)");
				assert.strictEqual(globalClicked, 1, "onclick='...'");

				var custom = 0;
				MyCustomElement.on("custom", function () {
					custom++;
				});
				MyCustomElement.emit("custom");
				assert.strictEqual(custom, 1, ".on('custom', ...)");
				assert.strictEqual(globalCustom, 1, "oncustom='...'");
				assert.strictEqual(globalType, "custom", "event parameter passed into handler");
			}
		},

		// Test that Stateful notification of properties works.
		// Testing specifically here (in addition to decor) because CustomElement redefines Stateful#_getProps()
		stateful: function () {
			var d = this.async(1000);

			// Create a custom element with a custom "foo" event, plus the standard "click" event.
			var MyCustomElement = register("my-widget-stateful", [HTMLElement, CustomElement], {
				_private: 1,

				foo: 2,
				_setFooAttr: function (val) {
					this._set("foo", val);
				},

				preRender: function () {
					this.instanceProp = 3;
				},

				anotherFunc: function () {
				}
			});

			var w = new MyCustomElement({});
			w.observe(d.callback(function (oldValues) {
				assert.deepEqual(oldValues, {
					_private: 1,
					foo: 2
				});
			}));

			w._private = 11;
			w.foo = 22;
			w.instanceProp = 33;
			w.className = "foo";	// shouldn't cause notification as per CustomElement#_getProp()
		},

		"#findCustomElements": function () {
			register("test-ce-foo", [HTMLElement, CustomElement], {
				name: "",
				attr1: 0,
				attr2: 0
			});
			register("test-ce-bar", [HTMLElement, CustomElement], {
				name: "",
				attr1: 0,
				attr2: 0
			});
			register("test-ce-baz", [HTMLElement, CustomElement], {
				name: "",
				attr1: 1,
				attr2: 1
			});
			container.innerHTML = html;
			register.parse(container);

			assert.strictEqual(CustomElement.prototype.findCustomElements(container).length, 3);
			assert.strictEqual(
				CustomElement.prototype.findCustomElements(document.getElementById("threeWrapper")).length, 1);
		},

		"#attributeChangedCallback() etc.": {
			setup: function () {
				// TODO: need tabIndex in the prototype for Stateful#observe() to report changes
				var MyMixin = register.dcl(null, {
					// Mixin to workaround https://github.com/uhop/dcl/issues/9
					//tabIndex: "0"
				});
				MyCustomElement = register("my-ce-attribute-changed", [HTMLElement, CustomElement, MyMixin], {
					attributeChangedCallback: function (n, oldv, newv) {
						accCalls.push({
							name: n,
							oldVal: oldv,
							newVal: newv
						});
					}
				});
			},

			"basic": function () {
				var w = new MyCustomElement();
				container.appendChild(w);
				w.attachedCallback();

				var def = this.async();

				// Test setting attribute via setAttribute() calls attributeChangedCallback()
				accCalls = [];
				w.setAttribute("foo", "bar");
				setTimeout(def.rejectOnError(function () {
					if (accCalls[0] && accCalls[0].oldVal === "") {
						accCalls[0].oldVal = null;	// workaround inconsistent IE behavior
					}
					assert.deepEqual(accCalls, [{name: "foo", oldVal: null, newVal: "bar"}], "accCalls 1");

					accCalls = [];
					w.setAttribute("foo", "bar2");
					setTimeout(def.rejectOnError(function () {
						assert.deepEqual(accCalls, [{name: "foo", oldVal: "bar", newVal: "bar2"}], "accCalls 2");

						accCalls = [];
						w.removeAttribute("foo");
						setTimeout(def.callback(function () {
							if (accCalls[0] && accCalls[0].newVal === "") {
								accCalls[0].newVal = null;	// workaround inconsistent IE behavior
							}
							assert.deepEqual(accCalls, [{name: "foo", oldVal: "bar2", newVal: null}], "accCalls 3");
						}), 10);
					}), 10);
				}), 10);
			},

			"setting mirror property": function () {
				// Test that setting a mirror property like tabIndex calls both attributeChangedCallback()
				// and also triggers Object.observe() callback.
				// Test that attributeChangedCallback() called when attribute set indirectly via shadow property.
				// TODO: deliver() doesn't make this synchronous but maybe I could make it synchronous if deliver()
				// called MutationObserver.takeRecords().

				var w = new MyCustomElement();
				container.appendChild(w);
				w.attachedCallback();

				var def = this.async();

				var changedProps = [];
				w.observe(function (oldVals) {
					changedProps.push(oldVals);
				});

				accCalls = [];

				w.tabIndex = 1;

				setTimeout(def.callback(function () {
					if (accCalls[0] && accCalls[0].oldVal === "") {
						accCalls[0].oldVal = null;	// workaround inconsistent IE behavior
					}
					assert.deepEqual(accCalls, [{name: "tabindex", oldVal: null, newVal: "1"}],
						"attributeChangedCallback");


					if (changedProps[0] && changedProps[0].tabIndex === "") {
						changedProps[0].tabIndex = null;	// workaround inconsistent IE behavior
					}
					assert.deepEqual(changedProps, [{tabIndex: null}], "observe()");

					// TODO: change tabIndex again and check results
				}), 10);
			},


			// Test that setting the attribute via setAttribute() triggers refreshRendering()
			"set attribute with shadow property": function () {
				var w = new MyCustomElement();
				container.appendChild(w);
				w.attachedCallback();

				var def = this.async();

				// TODO: I wanted to test refreshRendering() but Invalidating not mixed into CustomElement.
				// So need tests in Widget too?
				var changedProps = [];
				w.observe(function (oldVals) {
					changedProps.push(oldVals);
				});

				accCalls = [];

				w.setAttribute("tabindex", "1");

				setTimeout(def.callback(function () {
					if (accCalls[0] && accCalls[0].oldVal === "") {
						accCalls[0].oldVal = null;	// workaround inconsistent IE behavior
					}
					assert.deepEqual(accCalls, [{name: "tabindex", oldVal: null, newVal: "1"}],
						"attributeChangedCallback");


					if (changedProps[0] && changedProps[0].tabIndex === "") {
						changedProps[0].tabIndex = null;	// workaround inconsistent IE behavior
					}
					assert.deepEqual(changedProps, [{tabIndex: null}], "observe()");

					// TODO: change tabIndex again and check results
				}), 10);

			}
		}
	});
});
