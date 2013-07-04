define(["doh", "dojo/_base/declare", "../../_WidgetBase",  "../../mixins/Store",
	"dojo/store/Observable", "dojo/store/JsonRest", "dojo/store/Memory", "dojo/when"],
	function(doh, declare, _WidgetBase, Store, Observable, JsonRest, Memory, when){

	var C = declare("MyWidget", [_WidgetBase, Store]);

	doh.register("mixins.Store", [
		{
			timeout: 2000,
			name: "Error",
			runTest: function(t){
				var d = new doh.Deferred();
				var store = new C();
				var callbackCalled = false;
				store.on("query-error", function(){
					callbackCalled = true;
				});
				store.startup();
				store.set("store", new JsonRest({ target: "/" }));
				// we need to check before the timeout that query-error was called
				setTimeout(d.getTestCallback(function(){
					t.t(callbackCalled, "query-error callback");
				}), 1000);
				return d;
			}
		},

		{
			name: "Updates",
			timeout: 2000,
			runTest: function(t){
				var d = new doh.Deferred();
				var store = new C();
				var myData = [ { id: "foo", name: "Foo" }, { id: "bar", name: "Bar" } ];
				var callbackCalled = false;
				store.on("refresh-complete", function(){
					t.assertEqual(myData, store.get("items"));
					myStore.put({ id: "foo", name : "Foo2" });
					t.assertEqual([ { id: "foo", name: "Foo2" }, { id: "bar", name: "Bar" } ], store.get("items"));
					myStore.add({ id: "fb", name : "FB" });
					t.assertEqual( [ { id: "foo", name: "Foo2" }, { id: "bar", name: "Bar" }, { id: "fb", name: "FB" } ], store.get("items"));
					myStore.remove("bar");
					t.assertEqual([{ id: "foo", name: "Foo2" }, { id: "fb", name: "FB" } ], store.get("items"));
					callbackCalled = true;
				});
				store.startup();
				var myStore =  Observable(new Memory({ data: myData }));
				store.set("store", myStore);
				// we need to check before the timeout that refresh-complete was called
				setTimeout(d.getTestCallback(function(){
					t.t(callbackCalled, "refresh-complete callback");
				}), 1000);
				return d;
			}
		}
	]);
});
