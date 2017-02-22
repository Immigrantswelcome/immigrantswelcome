# Initial Setup

`npm install`


# Icons

If you have an icon `twitter.svg` that is 64x64 pixels you can use it as follows:

1. Put the SVG at `static/icons/twitter.svg`.
2. Run `npm run build` to generate the SVG sprite. Alternatively, if `npm run watch` is running you can skip this step.
3. Include the icon in a template with:

```
<svg width="64" height="64">
    <use xlink:href="{% static 'icon_sprite/sprite.svg' %}#twitter"></use>
</svg>
```


# CSS Hot Reloading

1. Run `npm run watch`.
2. Open [http://localhost:3000]().

Now, whenever you make a change to a CSS file it will show on the page without reloading the page.

If you want to watch files outside of `static/css` for changes, add them to the `browser-sync` command in `scripts/watch`.
