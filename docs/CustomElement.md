---
layout: default
title: delite/CustomElement
---

# delite/CustomElement

`delite/CustomElement` is a base class for non-visual custom elements, such as an element representing a data store.
It also serves as the base class for [Widget](Widget.md).

Behind the scenes, `delite/CustomElement` provides many of the features mentioned in the
[Introduction to delite and custom elements](customElements101.md).  In particular,
it parses attributes in declarative markup, for example converting:

```html
<my-widget numProp="123"></my-widget>
```

into:

```js
myWidget.numProp = 123;
```

It also provides common methods like `on()` and `destroy()`.

`delite/CustomElement` uses the function names from the Custom Elements specification,
`createdCallback()` and `attachedCallback()`, but does not provide the delite specific lifecycle methods
like `render()` and `postRender()`.  These are from [`Widget`](Widget.md).

In addition to calling `attachedCallback()`, `delite/CustomElement` makes sure to fire a non-bubbling 
`customelement-attached` event once the attached callback has been executed.

Finally, note that for performance reasons, delite does not set up document level listeners for DOM nodes
being attached / removed from the document.  Therefore, when creating CustomElement based elements programatically
and attaching them to the document, you need to call `attachedViewCallback()` manually, to ensure it's called even on 
browsers that do not natively support Custom Elements.
