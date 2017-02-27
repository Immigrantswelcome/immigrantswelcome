#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const nunjucks = require('nunjucks');
const yaml = require('js-yaml');


var SRC = path.join('.', 'src');
var DIST = path.join('.', 'dist');

fs.mkdirsSync(DIST, 0o755);

const globby = require('globby');

var indexes = globby.sync(path.join(DIST, '**', 'index.html'));

var config = yaml.safeLoad(fs.readFileSync(path.join('db', 'config', 'config.yml')));

if (config.DEBUG) {
    config.baseURL = 'http://localhost:3000';
}

if (config.baseURL[config.baseURL.length - 1] === '/') {
    config.baseURL = config.baseURL.slice(0, -1);
}

var env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(SRC, 'html')));

var preExclude = ['/'];
var postExclude = ['/story/'];

indexes.forEach(index => {
    var url = index.replace('dist', '').replace('\\', '/').replace('index.html', '');
    if (preExclude.indexOf(url) !== -1) {
        return;
    }

    url = url.split('/').slice(0, -2).join('/') + '/';

    if (postExclude.indexOf(url) !== -1) {
        return;
    }

    var contents = env.render('redirect.html', {
        redirect: `${config.baseURL}${url}`
    });
    fs.writeFileSync(index, contents);
});
