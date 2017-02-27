# Description

Text that sizes automatically based on parent width.

# Version

2.0.0

# Usage

```
ResponsiveText(title, arguments);
```

Arguments:

- `relSize=0.5`: The modifier that is a multiple of the parent width.
- `minSize=16`: The minimum size allowed.
- `maxSize=32`: The maximum size allowed.
- `attribute='font-size'`: The attribute to affect.

Instance Methods:

- `resize`: Trigger a manual resize.

Static Methods:

- `each`: Create a reponsive text object for each element in passed in `NodeList`.
- `resizeAll`: Trigger a manual resize of all ResponsiveText elements.

# Example

```
var title = document.querySelector('.title');
ResponsiveText(title, 0.0428, 18, 24);
ResponsiveText(title, 0.0535, 20, 30, 'line-height');

var allTitles = document.querySelectorAll('.all-titles');
ResponsiveText.each(allTitles, 0.0428, 18, 24);

ResponsiveText($('.default_title'));

var optionTitle = document.querySelector('.option_title');
ResponsiveText(optionTitle, {
    relSize: 0.0535,
    minSize: 20,
    maxSize: 30,
    attribute: 'line-height'
});

optionTitle.ResponsiveText.resize();

ResponsiveText.resizeAll();
```
