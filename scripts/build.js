#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const atImport = require("postcss-import")
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const deasync = require('deasync');
const globby = require('globby');
const md5 = require('md5');
const marked = require('marked');
const nunjucks = require('nunjucks');
const postcss = require('postcss');
const sharp = require('sharp');
const uglifyJS = require('uglify-js');
const uuidV4 = require('uuid/v4');
const yaml = require('js-yaml');

var promises = [];

var DB = path.join('.', 'db');
var SRC = path.join('.', 'src');
var BUILD = path.join('.', 'build');
var CSS_BUILD_PATH = path.join(BUILD, 'css');
var JS_BUILD_PATH = path.join(BUILD, 'js');
var DIST = path.join('.', 'dist');
var STATIC_ROOT = path.join(DIST, 'static');
var CSS_DEST_PATH = path.join(STATIC_ROOT, 'css');
var JS_DEST_PATH = path.join(STATIC_ROOT, 'js');
var THUMBS_DEST_PATH = path.join(STATIC_ROOT, 'thumbs');
var DEBUG_SRC_PATH = path.join(DIST, 'src');

var STATIC_URL = '/static/';

// make build directories
fs.mkdirsSync(CSS_BUILD_PATH, 0o755);
fs.mkdirsSync(JS_BUILD_PATH, 0o755);

// make dest directories
fs.mkdirsSync(CSS_DEST_PATH, 0o755);
fs.mkdirsSync(JS_DEST_PATH, 0o755);
fs.mkdirsSync(THUMBS_DEST_PATH, 0o755);


function getTimestamp(date) {
    return Math.round(+date / 1000);
}


function slugify(value, allowUnicode=false) {
    value = String(value)
    if (allowUnicode) {
        value = value.normalize('NFKC');
        value = value.replace(/[^\w\s-]/g, '').trim().toLowerCase();
        return new nunjucks.runtime.SafeString(value.replace(/[-\s]+/g, '-'));
    }
    value = value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
    value = value.replace(/[^\w\s-]/g, '').trim().toLowerCase();
    return new nunjucks.runtime.SafeString(value.replace(/[-\s]+/g, '-'));
}


// make the css processor
var cssAutoprefixer = postcss([
    autoprefixer({ add: false, browsers: [] }),
    autoprefixer({
        browsers: [
            "last 2 Chrome version",
            "last 2 Firefox version",
            "last 1 Safari version",
            "last 1 Edge version",
            "IE >= 11",
            "last 1 ChromeAndroid version",
            "last 2 iOS version"
        ]
    })
]);
var cssCompressor = postcss([
    atImport(),
    cssnano({
        safe: true,
        autoprefixer: false,
        discardComments: true,
        filterPlugins: false
    })
]);


// setup templates
var env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(SRC, 'html')));

function StaticExtension() {
    this.tags = ['static'];

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);
        return new nodes.CallExtension(this, 'run', args);
    };

    this.run = (context, file) => {
        if (context.ctx.config.DEBUG) {
            return `/src/${file}`;
        }
        var fileUrl = `${STATIC_URL}${file}`;
        var filePath = path.join(SRC, file);
        // if the file exists add a timestamp to bust caches
        if (fs.existsSync(filePath)) {
            var stat = fs.lstatSync(filePath);
            var timestamp = getTimestamp(stat.mtime);
            fileUrl = `${fileUrl}?v=${timestamp}`;
        }
        return fileUrl;
    };
}

var COMPRESS = new Object(null);

function CompressExtension() {
    this.tags = ['compress'];

    this.finds = {
        css: new RegExp('href="([^"]*?)"', 'g'),
        js: new RegExp('src="([^"]*?)"', 'g'),
    };

    this.outputFile = {
        css: basename => `/static/css/${basename}.css`,
        js: basename => `/static/js/${basename}.js`,
    };

    this.outputTemplate = {
        css: url => `<link rel="stylesheet" type="text/css" href="${url}" />`,
        js: url => `<script src="${url}"></script>`,
    };

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks('endcompress');
        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = (context, name, body) => {
        if (context.ctx.config.DEBUG) {
            return new nunjucks.runtime.SafeString(
                body().replace(new RegExp(STATIC_URL, 'g'), path.join('/', SRC, '/')));
        }
        var ext = path.extname(name);
        var basename = path.basename(name, ext);
        var type = ext.slice(1);


        if (! (name in COMPRESS)) {
            COMPRESS[name] = new Object(null);
        }

        if (type in COMPRESS[name]) {
            // we already rendered this block
            var blockdata = COMPRESS[name][type];
            return new nunjucks.runtime.SafeString(this.outputTemplate[type](blockdata.url));
        }

        var find = this.finds[type];
        var lines = body().split(/\n/);
        var files = [];
        var compressTime = 0;
        lines.forEach(line => {
            var match = null;
            while((match = find.exec(line))) {
                var file = match[1];
                var filePath = file.replace(STATIC_URL, path.join(SRC, '/'));
                if (fs.existsSync(filePath)) {
                    var stat = fs.lstatSync(filePath);
                    var timestamp = getTimestamp(stat.mtime);
                    if (timestamp > compressTime) {
                        compressTime = timestamp;
                    }
                }
                files.push(filePath);
            }
        });

        var outputFile = this.outputFile[type](basename);
        // if any file exists add a timestamp to bust caches
        var url = `${outputFile}?v=${compressTime}`;

        COMPRESS[name][type] = {
            name: basename,
            files: files,
            url: url
        };

        // deploy the compressed url
        return new nunjucks.runtime.SafeString(this.outputTemplate[type](url));
    };
}

function AutoprefixExtension() {
    this.tags = ['autoprefix'];

    this.regex = new RegExp('href="([^"]*?)"', 'g');

    this.outputTemplate = url => `<link rel="stylesheet" type="text/css" href="${url}" />`;

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks('endautoprefix');
        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = (context, body) => {
        if (context.ctx.config.DEBUG) {
            return new nunjucks.runtime.SafeString(body());
        }
        var lines = body().split(/\n/);
        var output = [];
        lines.forEach(line => {
            var match = null;
            while((match = this.regex.exec(line))) {
                var file = match[1];
                var filePath = file.replace(STATIC_URL, path.join(SRC, '/'));
                if (fs.existsSync(filePath)) {
                    var result = cssAutoprefixer.process(fs.readFileSync(filePath));
                    var url = path.join(CSS_BUILD_PATH, filePath);
                    fs.mkdirsSync(path.dirname(url), 0o755);
                    fs.writeFileSync(url, result.css);
                    output.push(this.outputTemplate(url));
                }
            }
        });

        return new nunjucks.runtime.SafeString(output.join('\n'));
    };
}

function SpacelessExtension() {
    this.tags = ['spaceless'];

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();

        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks('endspaceless');

        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = (context, body) => {
        return new nunjucks.runtime.SafeString(body().replace(/\s+/g, ' ').replace(/>\s</g, '><'));
    };
}

function CommentExtension() {
    this.tags = ['comment'];

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();

        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks('endcomment');

        parser.advanceAfterBlockEnd();

        return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = (context, body) => {
        return '';
    };
}

env.addExtension('StaticExtension', new StaticExtension());
env.addExtension('CompressExtension', new CompressExtension());
env.addExtension('AutoprefixExtension', new AutoprefixExtension());
env.addExtension('SpacelessExtension', new SpacelessExtension());
env.addExtension('CommentExtension', new CommentExtension());

env.addFilter('marked', str => new nunjucks.runtime.SafeString(marked(str)));

env.addFilter('strip_marked', str => {
    var tokens = marked.lexer(str.trim());
    var strip = []
    tokens.forEach(token => {
        if (token.hasOwnProperty('text')) {
            strip.push(token.text.trim());
        }
    });
    return new nunjucks.runtime.SafeString(strip.join(''));
});

env.addFilter('possessive', str => {
    if (str === null || str === undefined) {
        return '';
    }
    if (str.endsWith('s')) {
        return `${str}'`;
    }
    return `${str}'s`;
});

var THUMBS = new Set();

env.addFilter('thumbnail', (imageUrl, size, kwargs) => {
    var area = typeof kwargs === 'undefined' ? null : kwargs.area || null;
    var sizes = size.split('x');

    var width = parseInt(sizes[0]) || null;
    var height = parseInt(sizes[1]) || null;

    var hash = md5(`${imageUrl}:${size}`);
    var name = `${hash}${path.extname(imageUrl)}`;
    var savePath = path.join(THUMBS_DEST_PATH, name);
    var date = null;
    if (fs.existsSync(savePath)) {
        date = fs.lstatSync(savePath).mtime;
    } else {
        date = new Date();
        var imagePath = path.join(SRC, imageUrl);
        var image = sharp(imagePath);

        var imgWidth = width;
        var imgHeight = height;

        if (area !== null) {
            // desync getting the metadata
            var metadata = null;
            image.metadata().then(res => {
                metadata = res;
            });
            deasync.loopWhile(() => metadata === null);

            imgWidth = metadata.width;
            imgHeight = metadata.height;

            // Area should be under `area`, should be less than the max dimensions
            // This is to make the images look relatively the same size, so no one logo overwhelms
            var i = 0;
            var aspect = imgHeight / imgWidth;
            while (imgWidth * imgHeight > area || (imgWidth > width && imgHeight > height)) {
                imgWidth -= 1;
                imgHeight = Math.round(imgWidth * aspect);
                i += 1;
                if (i === 1000) {
                    throw 'Image resizing took way too long';
                }
            }
        }

        // async is fine here
        promises.push(image
            .resize(imgWidth, imgHeight)
            .max()
            .withoutEnlargement()
            .toFile(savePath));
    }

    THUMBS.add(savePath);

    return `${STATIC_URL}thumbs/${name}?v=${getTimestamp(date)}`;
});

var ObfuscateEmail = (() => {
    /*
        Given a string representing an email address,
        returns a mailto link with rot13 JavaScript obfuscation.
    */
    var replace = /@|\./gm;
    var replaceDict = {'@': '\\100', '.': '\\056'};
    var ROT13 = s => s.replace(
        /[a-zA-Z]/g, c => String.fromCharCode((c<='Z'?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26));

    var template = new nunjucks.Template(
        `<a {% if css_class %}class="{{ css_class }}" {% endif %}id="{{ anchor_id }}"></a><script>!function(a){function r(s){return s.replace(/[a-zA-Z]/g,function(c){return String.fromCharCode((c<='Z'?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26)})}a.removeAttribute('id');a.setAttribute('href',r('znvygb:{{ email }}'));a.setAttribute('data-znvygb',a.getAttribute('href').substr(7));{% if script_set_text %}a.innerHTML=r('{{ script_set_text }}');{% endif %}a.parentElement.removeChild(a.nextElementSibling)}(document.getElementById('{{ anchor_id }}'))</script>`,
        new nunjucks.Environment(null, { autoescape: false }));

    function ObfuscateEmail(autoescape, email, link_text, css_class) {
        this.autoescape = autoescape ? nunjucks.lib.escape : a => a;
        this.email = this.obfuscate(email);
        this.link_text = link_text || '';
        css_class = css_class || '';
        this.css_class = this.autoescape(css_class);
    }

    ObfuscateEmail.prototype.rot13Encode = function(clear) {
        return ROT13(clear);
    };

    ObfuscateEmail.prototype.obfuscate = function(text) {
        /* escape the text then sub @ and . then encode with rot13 */
        return this.rot13Encode(this.autoescape(text).replace(
            replace, match => replaceDict[match]));
    };

    ObfuscateEmail.prototype.getContext = function() {
        /* make a context */
        var script_set_text = '';
        if (this.link_text === '') {
            script_set_text = this.email;
        } else {
            script_set_text = this.obfuscate(this.link_text);
        }

        return {
            'anchor_id': uuidV4(),
            'css_class': this.css_class,
            'email': this.email,
            'script_set_text': script_set_text
        };
    };

    ObfuscateEmail.prototype.render = function() {
        return new nunjucks.runtime.SafeString(template.render(this.getContext()));
    }

    return ObfuscateEmail;
})();

env.addFilter('obfuscate_email', (email, link_text, css_class) => {
    var obfuscate = new ObfuscateEmail(env.opts.autoescape, email, link_text, css_class);
    return obfuscate.render();
});

env.addFilter('build_absolute_uri', path => {
    return `${config.baseURL}${path}`;
});

env.addFilter('lb2pr', str => {
    if (str === null || str === undefined) {
        return '';
    }
    return new nunjucks.runtime.SafeString(`<p>${str.replace(/(\r\n|\n)+/g, '</p><p>')}</p>`);
});

env.addFilter('image_metadata', imageUrl => {
    var imagePath = path.join(SRC, imageUrl);
    var image = sharp(imagePath);
    var metadata = null;
    image.metadata().then(res => {
        metadata = res;
    });
    deasync.loopWhile(() => metadata === null);
    return metadata;
});
// data

function loadData(model, search="*", url=null) {
    if (search === null) {
        var files = globby.sync(path.join(DB, model, `${model}.yml`));
        if (files.length == 1) {
            return () => {
                var data = yaml.safeLoad(fs.readFileSync(files[0]));
                if (url !== null) {
                    data.url = url.bind(data);
                }
                return data;
            };
        }
    } else {
        var files = globby.sync(path.join(DB, model, `${search}.yml`));
        return () => {
            var data = [];
            for (var i = 0, l = files.length; i < l; ++i) {
                var file = files[i];
                var datum = yaml.safeLoad(fs.readFileSync(file));
                var ext = path.extname(file);
                datum.pk = path.basename(file, ext);
                if (url !== null) {
                    datum.url = url.bind(datum);
                }
                data.push(datum);
            }
            return data;
        };
    }
    return null;
}

var config = loadData('config', null)();

if (config.DEBUG) {
    config.baseURL = 'http://localhost:3000';
}

if (config.baseURL[config.baseURL.length - 1] === '/') {
    config.baseURL = config.baseURL.slice(0, -1);
}

// lets make the views
var SITEMAP = [];
function makeView(file, template, context, sitemap=true) {
    var viewPath = path.join(DIST, file);
    fs.mkdirsSync(path.dirname(viewPath), 0o755);
    var contents = env.render(template, Object.assign(
        {}, context, {
            config: config
        }
    ));
    fs.writeFileSync(viewPath, contents);
    if (sitemap) {
        SITEMAP.push('/' + file.replace('\\', '/').replace('index.html', ''));
    }
}

var htmlPaths = {
    'home': () => 'index.html',
    'storyRedirect': story => path.join('story', story.pk, 'index.html'),
    'story': story => path.join(
        'story', story.pk, slugify(story.slug || story.title).val.slice(0, 50), 'index.html'),
    '404': () => '404.html',
    'banner': () => path.join('banner', 'index.html')
};

function url(view, page) {
    return '/' + htmlPaths[view](page).replace('\\', '/').replace('index.html', '');
}

function featured(itemsFunc) {
    return () => {
        var items = itemsFunc();
        if (items !== null) {
            items.sort((a, b) => a.featured !== b.featured);
        }
        return items;
    };
}

var views = {
    'home': () => {
        var page = loadData('homepage', null, function() {
            return url('home', this);
        });
        var logos = loadData('logo', '+([0-9])');
        var stories = loadData('story', '+([0-9])', function() {
            return url('story', this);
        });

        var context = {
            page: page(),
            logos: logos,
            stories: featured(stories)
        };
        makeView(htmlPaths.home(), path.join('general', 'home.html'), context);
    },
    'storyRedirect': () => {
        var stories = loadData('story', '+([0-9])', function() {
            return url('story', this);
        })();
        for (var i = 0, l = stories.length; i < l; ++i) {
            var story = stories[i];
            var context = {
                redirect: story.url(),
            };
            makeView(htmlPaths.storyRedirect(story), path.join('redirect.html'), context, false);
        }
    },
    'story': () => {
        var stories = loadData('story', '+([0-9])', function() {
            return url('story', this);
        })();
        for (var i = 0, l = stories.length; i < l; ++i) {
            var story = stories[i];
            var context = {
                page: story,
            };
            if (l > 1) {
                context.next = url('story', stories[i + 1] || stories[0]);
                context.prev = url('story', stories[i - 1] || stories[stories.length - 1]);
            }
            makeView(htmlPaths.story(story), path.join('story', 'detail.html'), context);
        }
    },
    '404': () => {
        makeView(htmlPaths['404'](), path.join('404.html'), {}, false);
    },
    'banner': () => {
        makeView(htmlPaths.banner(), path.join('general', 'banner.html'), {}, false);
    }
};


// needs to go before views are made
if (config.DEBUG) {
    try {
        fs.symlinkSync(path.resolve(SRC), DEBUG_SRC_PATH, 'dir');
    } catch(err) {};
}


//make views
Object.keys(views).forEach(view => {
    views[view]();
});


//make sitemap
var sitemapStr = ['<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
SITEMAP.forEach(function(url) {
    sitemapStr.push(`<url><loc>${config.baseURL}${url}</loc></url>`);
});
sitemapStr.push(`</urlset>`)
promises.push(fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemapStr.join('')));


// compress statics
if (! config.DEBUG) {
    Object.keys(COMPRESS).forEach(name => {
        var compress = COMPRESS[name];

        if ('css' in compress) {
            // process the css
            var cssOpts = compress.css;
            var imports = [];
            var cssPaths = cssOpts.files;
            cssPaths.forEach(cssPath => {
                if (fs.existsSync(cssPath)) {
                    imports.push(`@import "${cssPath}";`);
                }
            });
            promises.push(
                cssCompressor.process(imports.join(''))
                .then(result => {
                    fs.writeFileSync(path.join(CSS_DEST_PATH, `${cssOpts.name}.css`), result.css);
                })
            );
        }

        if ('js' in compress) {
            // process the js
            var jsOpts = compress.js;
            var jsPaths = jsOpts.files;
            var result = uglifyJS.minify(jsPaths);
            promises.push(fs.writeFile(path.join(JS_DEST_PATH, `${jsOpts.name}.js`), result.code));
        }
    });
}

// move images to dist
var imagePaths = [path.join(SRC, 'images', '**', '*'), path.join(SRC, 'icon_sprite', '**', '*')];
promises.push(globby(imagePaths).then(paths => {
    paths.forEach(imagePath => {
        var newImagePath = imagePath.replace(SRC, STATIC_ROOT);
        fs.copySync(imagePath, newImagePath, {preserveTimestamps:true});
    });
}));

// favicon stuff
promises.push(fs.copySync(
    path.join(SRC, 'images', 'favicons', 'favicon.ico'),
    path.join(DIST, 'favicon.ico'), {preserveTimestamps:true}))
promises.push(fs.copySync(
    path.join(SRC, 'images', 'favicons', 'browserconfig.xml'),
    path.join(DIST, 'browserconfig.xml'), {preserveTimestamps:true}))

// clean thumbnails
promises.push(globby(path.join(THUMBS_DEST_PATH, '*')).then(paths => {
    paths.forEach(thumbPath => {
        if (! THUMBS.has(thumbPath)) {
            fs.remove(thumbPath);
        }
    });
}));

// move robots.txt to dist
var robotsStr = env.render('robots.txt', {config: config});
promises.push(fs.writeFile(path.join(DIST, 'robots.txt'), robotsStr));

// move jquery fallback to dist
promises.push(fs.copy(
    path.join(SRC, 'vendor', 'jquery'),
    path.join(STATIC_ROOT, 'vendor', 'jquery'),
    {preserveTimestamps:true}));

Promise.all(promises).then(() => {
    fs.removeSync(BUILD);

    if (! config.DEBUG) {
        fs.mkdirsSync(DEBUG_SRC_PATH);
    }
});


