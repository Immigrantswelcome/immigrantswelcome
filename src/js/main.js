(function() {

    autosize(document.querySelectorAll('textarea'));

    homePageInit();
    storyPageInit();
    overlaysInit();

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

        if ($slides.children().length > 1) {
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

    function overlaysInit() {
        var $overlay = $('#overlay');

        var $overlayTrigger = $('#overlay_trigger');
        $overlayTrigger.overlay({
            close: '.overlay__close',
            mask: {
                color: '#000',
                opacity: 0.4
            },
            onClose: function() {
                signupThanks.classList.remove('overlay__thanks--show');
                signupStory.classList.remove('overlay__story--show');
            }
        });
        var signupStory = document.querySelector('.overlay__story');
        var signupThanks = document.querySelector('.overlay__thanks--signup');
        var storyThanks = document.querySelector('.overlay__thanks--story');

        var storyDialogButton = document.querySelector('.overlay__thanks__story');

        storyDialogButton.addEventListener('click', function() {
            var addStoryEvent = function() {
                signupThanks.removeEventListener('transitionend', addStoryEvent);
                signupThanks.classList.remove('overlay__thanks--show');
                signupThanks.classList.remove('overlay__thanks--hide');

                signupStory.classList.add('overlay__story--hide');
                signupStory.classList.add('overlay__story--show');
                setTimeout(function() {
                    signupStory.classList.remove('overlay__story--hide');
                }, 0);
            };

            signupThanks.addEventListener('transitionend', addStoryEvent);
            signupThanks.classList.add('overlay__thanks--hide');
        });

        function addStoryDone() {
            var doneStoryEvent = function() {
                signupStory.removeEventListener('transitionend', doneStoryEvent);
                signupStory.classList.remove('overlay__story--show');
                signupStory.classList.remove('overlay__story--hide');

                storyThanks.classList.add('overlay__thanks--hide');
                storyThanks.classList.add('overlay__thanks--show');
                setTimeout(function() {
                    storyThanks.classList.remove('overlay__thanks--hide');
                }, 0);
            };

            signupStory.addEventListener('transitionend', doneStoryEvent);
            signupStory.classList.add('overlay__story--hide');
        }

        var storyForm = $('.overlay__story__form').eq(0);

        storyForm.parsley().on('form:success', function() {
            storyForm.osdi({
                immediate: true,
                done: function(data, textStatus, jqXHR) {
                    var inputs = storyForm.get(0).querySelectorAll('input');
                    for (var i = 0, l = inputs.length; i < l; ++i) {
                        inputs[i].value = '';
                    }
                    addStoryDone();
                },
                fail: function(jqXHR, textStatus, errorThrown) {
                    //TODO: console.log('fail');
                }
            });
        }).on('form:submit', function() {
            return false;
        });

        if (document.querySelector('body').classList.contains('home-page')) {
            var signUpForm = $('.signup__form').eq(0);

            signUpForm.parsley().on('form:success', function() {
                signUpForm.osdi({
                    immediate: true,
                    done: function(data, textStatus, jqXHR) {
                        var inputs = signUpForm.get(0).querySelectorAll('input');
                        for (var i = 0, l = inputs.length; i < l; ++i) {
                            inputs[i].value = '';
                        }
                        signupThanks.classList.add('overlay__thanks--show');
                        $overlayTrigger.click();
                    },
                    fail: function(jqXHR, textStatus, errorThrown) {
                        //TODO: console.log('fail');
                    }
                });
            }).on('form:submit', function() {
                return false;
            });

            var addStoryButton = document.querySelector('button.stories__cta');

            addStoryButton.addEventListener('click', function() {
                signupStory.classList.add('overlay__story--show');
                $overlayTrigger.click();
            });
        }

        if (document.querySelector('body').classList.contains('story-page')) {
            var addStoryButton = document.querySelector('button.story__main__actions__action');

            addStoryButton.addEventListener('click', function() {
                signupStory.classList.add('overlay__story--show');
                $overlayTrigger.click();
            });
        }
    }
})();