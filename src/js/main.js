(function() {

    autosize(document.querySelectorAll('textarea'));

    homePageInit();
    storyPageInit();

    function homePageInit() {
        if (! document.querySelector('body').classList.contains('home-page')) {
            return;
        }

        var heroTitle = document.querySelector('.hero__title');
        ResponsiveText(heroTitle, {
            relSize: 0.0633,
            minSize: 38,
            maxSize: 52
        });

        ResponsiveText(heroTitle, {
            relSize: 0.0833,
            minSize: 50,
            maxSize: 64,
            attribute: 'line-height'
        });

        var logosTitle = document.querySelector('.logos__title');
        ResponsiveText(logosTitle, {
            relSize: 0.0467,
            minSize: 28,
            maxSize: 36
        });

        ResponsiveText(logosTitle, {
            relSize: 0.07,
            minSize: 42,
            maxSize: 56,
            attribute: 'line-height'
        });

        $('.signup__form').osdi();

        var grid = document.querySelector('.logos__grid');
        if (grid !== null) {
            var extendButton = document.querySelector('.logos__grid-expand');
            extendButton.addEventListener('click', function() {
                grid.classList.add('logos__grid--reveal');
            });

            var gridChildren = grid.children;
            var gridChildrenOrder = [];
            var gridChildrenIndexes = [];

            // get indexes
            for (var i = 0, l = gridChildren.length; i < l; ++i) {
                gridChildrenIndexes.push(i);
            }

            // randomize indexes
            for (var i = gridChildrenIndexes.length; i > 0; i--) {
                var selection = Math.random() * i | 0;
                var index = gridChildrenIndexes.splice(selection, 1)[0];
                gridChildrenOrder.push(gridChildren[index]);
            }

            // reorder children
            for (var i = 0, l = gridChildrenOrder.length; i < l; ++i) {
                var child = gridChildrenOrder[i];
                grid.appendChild(child);
            }

            // transition in
            grid.addEventListener('reveal', function() {
                for (var i = 0, l = gridChildren.length; i < l; ++i) {
                    setTimeout(function(index) {
                        gridChildren[index].classList.add('logos__grid__logo--show');
                    }.bind(null, i), i * 65);
                }
            });

            new ScrollReveal({
                elements: [grid],
                cacheLayout: true,
                offset: 0,
            });
        }

        var $slides = $('.stories__slides');

        if ($slides.length > 1) {
            $slides.on('init', function(slick) {
                var slides = this.querySelectorAll('.stories__slides__slide');
                slides.forEach(function(slide) {
                    slide.style.display = 'block';
                });
            }).slick({
                autoplay: true,
                prevArrow: '.stories__arrows__arrow--prev',
                nextArrow: '.stories__arrows__arrow--next'
            });
        } else {
            document.querySelectorAll('.stories__arrows__arrow').forEach(function(element) {
                element.style.display = 'none';
            });
        }
    }


    function storyPageInit() {
        if (! document.querySelector('body').classList.contains('story-page')) {
            return;
        }

        var mainTitle = document.querySelector('.story__main__title');
        ResponsiveText(mainTitle, {
            relSize: 0.0633,
            minSize: 32,
            maxSize: 36
        });

        ResponsiveText(mainTitle, {
            relSize: 0.0833,
            minSize: 46,
            maxSize: 56,
            attribute: 'line-height'
        });
    }
})();