function ScrollReveal(options) {
    this.bindThis();

    var defaultOptions = {
        cacheLayout: false,
    };

    options = $.extend(defaultOptions, options);

    this.cacheLayout = options.cacheLayout;
    this.offset = options.offset;

    this.elementObjs = [];
    for (var i = 0; i < options.elements.length; ++i) {
        var element = options.elements[i];
        this.elementObjs.push({
            element: element,
        });
    }

    if (this.cacheLayout) {
        window.addEventListener('resize', this.calculateLayouts);
        window.addEventListener('load', this.calculateLayouts);
        this.calculateLayouts();
    }

    window.addEventListener('scroll', this.scroll);
    window.addEventListener('load', this.scroll);
    this.scroll();
}

ScrollReveal.prototype.bindThis = function() {
    this.scroll = this.scroll.bind(this);
    this.calculateLayouts = this.calculateLayouts.bind(this);
};

ScrollReveal.prototype.calculateLayouts = function() {
    for (var i = 0; i < this.elementObjs.length; ++i) {
        var elementObj = this.elementObjs[i];
        this.calculateLayout(elementObj);
    }
};

ScrollReveal.prototype.calculateLayout = function(elementObj) {
    elementObj.top = elementObj.element.getBoundingClientRect().top + window.pageYOffset;
};

ScrollReveal.prototype.scroll = function() {
    var windowBottom = window.pageYOffset + window.innerHeight;

    var check = function(elementObj) {
        if (!this.cacheLayout) {
            this.calculateLayout(elementObj);
        }

        if (windowBottom > elementObj.top + this.offset) {
            var element = elementObj.element;
            var revealEvent = new Event('reveal', {bubbles: true});
            element.dispatchEvent(revealEvent);
            element.classList.add('scroll-reveal--show');

            // Once elements are animated in we don't need to keep checking them
            return true;
        } else {
            return false;
        }
    }.bind(this);

    ScrollReveal.eachDelete(check, this.elementObjs);

    if (this.elementObjs.length === 0) {
        window.removeEventListener('scroll', this.scroll);
    }
};

// Calls f for each item in xs and if f returns true then remove the item from xs
ScrollReveal.eachDelete = function(f, xs) {
    var length = xs.length;
    var i = 0;

    while (i < length) {
        var x = xs[i];
        var shouldDelete = f(x);

        if (shouldDelete) {
            xs.splice(i, 1);
            --length;
        } else {
            ++i;
        }
    }
};
