define(["doh/main", "../../Stateful", "dojo/_base/declare"], function(doh, Stateful, declare){

	doh.register("tests.Stateful", [
		function getSetWatch(t){
			var clz = declare(Stateful, {
					foo: 3
				}),
				s = new clz;
			doh.is(3, s.foo);
			var watching = s.watch("foo", function(name, oldValue, value){
				doh.is("foo", name);
				doh.is(3, oldValue);
				doh.is(4, value);
				doh.is(4, s.foo);
			});
			s.foo = 4;
			doh.is(4, s.foo);
			watching.remove();
			s.foo = 5;
			doh.is(5, s.foo);
		},
		function removeWatchHandle(t){
			var clz = declare(Stateful, {
					foo: 3
				}),
				s = new clz,
				watched = false;

			var watching = s.watch("foo", function(){
				t.f(watched);
				watched = true;
			});
			s.foo = 4;
			watching.remove();
			s.foo = 5;
		},
		function removeWatchHandleTwice(t){
			var clz = declare(Stateful, {
					foo: 3
				}),
				s = new clz,
				assertions = 0;

			var watching = s.watch("foo", function(){
				assertions++;
			});
			var watching2 = s.watch("foo", function(){
				assertions++;
			});
			s.foo = 4;
			watching.remove();
			watching.remove();
			s.foo = 5;

			t.is(3, assertions, "assertions");
		},
		function setHash(t){
			var clz = declare(Stateful, {
					foo: 0,
					bar: 0
				}),
				s = new clz(),
				fooCount = 0,
				handle = s.watch('foo', function () {
					fooCount++;
				});
			s.set({
				foo: 3,
				bar: 5
			});
			doh.is(3, s.foo);
			doh.is(5, s.bar);
			doh.is(1, fooCount);

			var clz2 = declare(Stateful, {
					foo: 0,
					bar: 0
				}),
				s2 = new clz2();
			s2.set(s);
			doh.is(3, s2.foo);
			doh.is(5, s2.bar);
			// s watchers should not be copied to s2
			doh.is(1, fooCount);
			handle.remove();
		},
		function wildcard(t){
			var clz = declare(Stateful, {
					foo: 0,
					bar: 0
				}),
				s = new clz();
			s.set({
				foo: 3,
				bar: 5
			});
			var wildcard = 0;
			var foo = 0;
			s.watch(function(){
				wildcard++;
			});
			s.watch("foo", function(){
				foo++;
			});
			s.foo = 4;
			s.bar = 6;
			doh.is(2, wildcard);
			doh.is(1, foo);
		},
		function accessors(t){
			var StatefulClass1 = declare(Stateful,{
				foo: 0,
				bar: 0,
				baz: "",

				_getFooAttr: function(){
					return this._fooAttr - 1;
				},

				_setBarAttr: function(value){
					this._set("bar", value + 1);
				}
			});

			var attr1 = new StatefulClass1();
			attr1.foo = 4;
			attr1.bar = 2;
			attr1.baz = "bar";

			t.is(3, attr1.foo, "attr1.foo getter works");
			t.is(3, attr1.bar, "attr1.bar setter works");
			t.is("bar", attr1.baz, "attribute set properly");
		},
		function paramHandling(t){
			var StatefulClass2 = declare(Stateful, {
				foo: null,
				bar: 5,

				_setFooAttr: function(value){
					this._set("foo", value);
				},
				_setBarAttr: function(value){
					this._set("bar", value);
				}
			});

			var attr2 = new StatefulClass2({
				foo: function(){
					return "baz";
				},
				bar: 4
			});

			t.is("function", typeof attr2.foo, "function attribute set");
			t.is("baz", attr2.foo(), "function has proper return value");
			t.is(4, attr2.bar, "attribute has proper value");
		},
		function _set(t){
			var output = [];
			var StatefulClass4 = declare(Stateful, {
				foo: null,
				bar: null,

				_setFooAttr: function(value){
					this._set("bar", value);
					this._set("foo", value);
				},
				_setBarAttr: function(value){
					this._set("foo", value);
					this._set("bar", value);
				}
			});

			var attr4 = new StatefulClass4();
			attr4.watch("foo", function(name, oldValue, value){
				output.push(name, oldValue, value);
			});
			attr4.watch("bar", function(name, oldValue, value){
				output.push(name, oldValue, value);
			});
			attr4.foo = 3;
			t.is(3, attr4.bar, "value set properly");
			attr4.bar = 4;
			t.is(4, attr4.foo, "value set properly");
			t.is(["bar", null, 3, "foo", null, 3, "foo", 3, 4, "bar", 3, 4], output);
		},
		// serialize test commented out because:
		//		1. won't print values in prototype like foo
		//		2. prints _fooAttr shadow value that's supposed to be hidden
		/*
		function serialize(t){
			var StatefulClass5 = declare(Stateful, {
				foo: null,
				_setFooAttr: function(value){
					this._set("foo", value + "baz");
				}
			});

			var obj = new StatefulClass5({
				foo: "bar"
			});

			t.is('{"foo":"barbaz"}', JSON.stringify(obj), "object serializes properly");
		}
		*/

		function subclasses1(){
			// Test when superclass and subclass are declared first, and afterwards instantiated
			var SuperClass = declare(Stateful, {
				foo: null,
				bar: null
			});
			var SubClass = declare(SuperClass, {
				bar: 5
			});

			var sub = new SubClass();
			var fooWatchedVal;
			sub.watch("foo", function(prop, o, n){
				fooWatchedVal = n;
			});
			var barWatchedVal;
			sub.watch("bar", function(prop, o, n){
				barWatchedVal = n;
			});
			sub.foo = 3;
			doh.is(3, fooWatchedVal, "foo watch() on SubClass");
			sub.bar = 4;
			doh.is(4, barWatchedVal, "bar watch() on SubClass");

			var sup = new SuperClass();
			var superFooWatchedVal;
			sup.watch("foo", function(prop, o, n){
				superFooWatchedVal = n;
			});
			var superBarWatchedVal;
			sup.watch("bar", function(prop, o, n){
				superBarWatchedVal = n;
			});
			sup.foo = 5;
			doh.is(5, superFooWatchedVal, "foo watch() on SuperClass");
			sup.bar = 6;
			doh.is(6, superBarWatchedVal, "bar watch() on SuperClass");
			doh.is(3, fooWatchedVal, "SubClass listener on foo not called");
			doh.is(4, barWatchedVal, "SubClass listener on bar not called");
		},

		function subclasses2(){
			// Test when superclass is declared and instantiated, then subclass is declared and use later
			var output = [];
			var SuperClass = declare(Stateful, {
				foo: null,
				bar: null
			});
			var sup = new SuperClass();
			var superFooWatchedVal;
			sup.watch("foo", function(prop, o, n){
				superFooWatchedVal = n;
			});
			var superBarWatchedVal;
			sup.watch("bar", function(prop, o, n){
				superBarWatchedVal = n;
			});
			sup.foo = 5;
			doh.is(5, superFooWatchedVal, "foo watch() on SuperClass");
			sup.bar = 6;
			doh.is(6, superBarWatchedVal, "bar watch() on SuperClass");

			var customSetterCalled;
			var SubClass = declare(SuperClass, {
				bar: 5,
				_setBarAttr: function(val){
					// this should get called even though SuperClass doesn't have a custom setter for "bar"
					customSetterCalled = true;
					this._set("bar", val);
				}
			});
			var sub = new SubClass();
			var fooWatchedVal;
			sub.watch("foo", function(prop, o, n){
				fooWatchedVal = n;
			});
			var barWatchedVal;
			sub.watch("bar", function(prop, o, n){
				barWatchedVal = n;
			});
			sub.foo = 3;
			doh.is(3, fooWatchedVal, "foo watch() on SubClass");
			sub.bar = 4;
			doh.is(4, barWatchedVal, "bar watch() on SubClass");
			doh.t(customSetterCalled, "SubClass custom setter called");

			doh.is(5, superFooWatchedVal, "SuperClass listener on foo not called");
			sup.bar = 6;
			doh.is(6, superBarWatchedVal, "SuperClass listener on bar not called");
		}
	]);

});
