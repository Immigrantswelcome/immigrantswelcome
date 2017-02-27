var ResponsiveText = (function() {
    var collection = [];
    var hyphenCharacter = /-([a-z])/g;

    function camelCase(hyphenCase) {
        return hyphenCase.replace(hyphenCharacter, function (match) {
            return match[1].toUpperCase();
        });
    }

    function extend(obj1, obj2) {
        Object.keys(obj2).forEach(function(key) {
            var val = obj2[key];
            if (typeof val !== 'undefined') {
                if (['string', 'number', 'array', 'boolean'].indexOf(typeof val) === -1) {
                    extend(obj1[key] || {}, val);
                } else {
                    obj1[key] = val;
                }
            }
        });
        return obj1;
    }


    function ResponsiveText(element, options) {
        // act like a factory if called without new
        if (this === window || typeof this === 'undefined') {
            var args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
            return new (Function.prototype.bind.apply(ResponsiveText, [null].concat(args)));
        }

        this.element = element.nodeType ? element : element[0];

        var overrideOpts;
        if (typeof options === 'object') {
            overrideOpts = options;
        } else {
            overrideOpts = {
                relSize: arguments[1],
                minSize: arguments[2],
                maxSize: arguments[3],
                attribute: arguments[4]
            };
        }

        var opts = {
            relSize: 0.5,
            minSize: 16,
            maxSize: 32,
            attribute: 'font-size'
        };

        extend(opts, overrideOpts);

        this.bindThis();

        this.parent = this.element.parentNode;
        this.maxWidth = parseInt(
            this.parent.style.maxWidth || getComputedStyle(this.parent).maxWidth);
        this.relSize = opts.relSize;
        this.minSize = opts.minSize;
        this.maxSize = opts.maxSize;
        this.attribute = opts.attribute;

        collection.push(this.resize);

        window.addEventListener('load', this.resize);
        window.addEventListener('resize', this.resize);

        if (this.element.hasOwnProperty('ResponsiveText')) {
            if (this.attribute in this.element.ResponsiveText) {
                this.element.ResponsiveText[this.attribute].destroy();
            }
        } else {
            this.element.ResponsiveText = new Object(null);
        }

        this.element.ResponsiveText[this.attribute] = this;
        this.resize();
    }

    ResponsiveText.prototype.bindThis = function() {
        this.resize = this.resize.bind(this);
    };

    ResponsiveText.prototype.resize = function() {
        var parentWidth = this.parent.offsetWidth;
        var size = this.maxSize;

        if (! this.maxWidth || parentWidth < this.maxWidth) {
            size = Math.ceil(parentWidth * this.relSize);
        }

        this.element.style[camelCase(this.attribute)] = (
            Math.max(Math.min(size, this.maxSize), this.minSize) + 'px');
    };

    ResponsiveText.prototype.destroy = function() {
        window.removeEventListener('load', this.resize);
        window.removeEventListener('resize', this.resize);
        var index = collection.indexOf(this.resize);
        if (index > -1) {
            collection.splice(index, 1);
        }
        delete this.element.ResponsiveText[this.attribute];
        if (this.element.ResponsiveText.length === 0) {
            delete this.element.ResponsiveText;
        }
    };

    ResponsiveText.each = function() {
        var args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
        var elements = args.shift();
        for (var i = 0, l = elements.length; i < l; ++i) {
            ResponsiveText.apply(window, [elements[i]].concat(args));
        }
    };

    ResponsiveText.resizeAll = function() {
        for (var i = 0, l = collection.length; i < l; ++i) {
            collection[i]();
        }
    };

    return ResponsiveText;
})();
