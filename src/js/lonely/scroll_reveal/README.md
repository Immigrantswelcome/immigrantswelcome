# Description

Add a CSS class to elements once the page scroll has reached them.


# Version

1.2.1


# Usage

```
new ScrollReveal(options);
```

Options:

- `elements`: An array of DOM Nodes reveal
- `offset`: Reveal elements when the bottom of the window reaches the element top plus `offset`
- `cacheLayout` (default `false`): Avoid recalculating elements' positions on every scroll event. With this set positions are recalculated only on `load` and `resize`. To manually recalculate call the `calculateLayouts` method.

# Events

Attach to the `reveal` event to get notified when an element is about to be revealed. This event is
a bubbling event.

# Example

```
new ScrollReveal({
    elements: document.querySelectorAll('.scroll-reveal'),
    offset: 150,
});
```
