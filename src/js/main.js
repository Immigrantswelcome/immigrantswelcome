(function() {

    homePageInit();

    function homePageInit() {
        if (! document.querySelector('body').classList.contains('home-page')) {
            return;
        }

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

        $('.stories__slides').on('init', function(slick) {
            var slides = this.querySelectorAll('.stories__slides__slide');
            slides.forEach(function(slide) {
                slide.style.display = 'block';
            });
        }).slick({
            autoplay: true,
            prevArrow: '.stories__arrows__arrow--prev',
            nextArrow: '.stories__arrows__arrow--next'
        });
    }
})();