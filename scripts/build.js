#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const atImport = require("postcss-import")
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const globby = require('globby');
const nunjucks = require('nunjucks');
const postcss = require('postcss');
const uglifyJS = require('uglify-js');
const yaml = require('js-yaml');


var BASE_URL = '';

var DB = path.join('.', 'db');
var SRC = path.join('.', 'src');
var BUILD = path.join('.', 'build');
var CSS_BUILD_PATH = path.join(BUILD, 'css');
var JS_BUILD_PATH = path.join(BUILD, 'js');
var DIST = path.join('.', 'dist');
var STATIC_ROOT = path.join(DIST, 'static');
var CSS_DEST_PATH = path.join(STATIC_ROOT, 'css');
var JS_DEST_PATH = path.join(STATIC_ROOT, 'js');

var STATIC_URL = '/static/';

// make build directories
fs.mkdirsSync(CSS_BUILD_PATH, 0o755);
fs.mkdirsSync(JS_BUILD_PATH, 0o755);

// make dest directories
fs.mkdirsSync(CSS_DEST_PATH, 0o755);
fs.mkdirsSync(JS_DEST_PATH, 0o755);


function getTimestamp(date) {
    return Math.round(+date / 1000);
}


// make the css processor
var cssAutoprefixer = postcss([
    autoprefixer({ add: false, browsers: [] }),
    autoprefixer({
        browsers: [
            "last 2 version",
            "> 1%",
            "not ie < 11",
            "not last 2 ie_mob versions",
            "not last 2 bb versions"
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
var env = new nunjucks.Environment(new nunjucks.FileSystemLoader('./src/html/'));

function StaticExtension() {
    this.tags = ['static'];

    this.parse = (parser, nodes, lexer) => {
        var tok = parser.nextToken();
        var args = parser.parseSignature(null, true);
        parser.advanceAfterBlockEnd(tok.value);
        return new nodes.CallExtension(this, 'run', args);
    };

    this.run = (context, file) => {
        var filePath = path.join(SRC, file);
        var absFileUrl = `${BASE_URL}${STATIC_URL}${file}`;
        // if the file exists add a timestamp to bust caches
        if (fs.existsSync(filePath)) {
            var stat = fs.lstatSync(filePath);
            var timestamp = getTimestamp(stat.mtime);
            absFileUrl = `${absFileUrl}?v=${timestamp}`;
        }
        return absFileUrl;
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
        var ext = path.extname(name);
        var basename = path.basename(name, ext);
        var type = ext.slice(1);
        var find = this.finds[type];
        var lines = body().split(/\n/);
        var compress = [];
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
                compress.push(filePath);
            }
        });

        var view = context.ctx.view;
        if (! (view in COMPRESS)) {
            COMPRESS[view] = new Object(null);
        }
        COMPRESS[view][type] = {
            name: basename,
            files: compress
        };

        var outputFile = this.outputFile[type](basename);
        // if any file exists add a timestamp to bust caches
        var url = `${outputFile}?v=${compressTime}`;
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

env.addExtension('StaticExtension', new StaticExtension());
env.addExtension('CompressExtension', new CompressExtension());
env.addExtension('AutoprefixExtension', new AutoprefixExtension());

// data

function loadData(model, search="*") {
    if (search === null) {
        var files = globby.sync(path.join(DB, model, `${model}.yml`));
        if (files.length == 1) {
            return () => yaml.safeLoad(fs.readFileSync(files[0]));
        }
    } else {
        var files = globby.sync(path.join(DB, model, `${search}.yml`));
        return () => {
            var data = [];
            for (var i = 0, l = files.length; i < l; ++i) {
                var file = files[i];
                data.push(yaml.safeLoad(fs.readFileSync(file)));
            }
            return data;
        };
    }
    return null;
}

// lets make the views
function makeView(file, template, context) {
    var viewPath = path.join(DIST, file);
    fs.mkdirsSync(path.dirname(viewPath), 0o755);
    var contents = env.render(template, context);
    fs.writeFileSync(viewPath, contents);
}

var views = {
    'home': (config, view) => {
        var page = loadData('homepage', null);
        var logos = loadData('logo', '+([0-9])');

        var context = {
            config: config,
            view: view,
            logos: logos,
        };
        makeView('index.html', path.join('general', 'home.html'), context);
    },
    'story': [
        (pk, slug) => `${pk}/${slug}.html`,
        function*() {
            // TODO: do something
            yield [pk, slug];
        },
        (config, path, pk, slug, view) => {
            var context = {
                view: view,
                DEBUG: true,
            };
            makeView(path, path.join('story', 'detail.html'), context);
        }
    ]
};

var promises = [];

Object.keys(views).forEach(view => {
    if (view === 'story') return;
    var config = loadData('config', null);
    views[view](config, view);


    var compress = COMPRESS[view];

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
        fs.writeFileSync(path.join(JS_DEST_PATH, `${jsOpts.name}.js`), result.code);
    }
});

// move images to dist
promises.push(globby([path.join(SRC, 'images', '**', '*')]).then(paths => {
    paths.forEach(imagePath => {
        var newImagePath = imagePath.replace(SRC, STATIC_ROOT);
        fs.copySync(imagePath, newImagePath, {preserveTimestamps:true});
    });
}));

Promise.all(promises).then(() => {
    fs.remove(BUILD);
});


