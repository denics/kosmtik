var util = require('util'),
    path = require('path'),
    fs = require('fs'),
    yaml = require('js-yaml'),
    StateBase = require('./back/StateBase.js').StateBase;

var Config = function () {
    StateBase.call(this);
    this.initOptions();
    this.initExporters();
    this.initLoaders();
    this.initStatics();
    this.loadConfig();
    for (var i = 0; i < this.plugins.length; i++) {
        this.registerPlugin(this.plugins[i]);
    }
    this.parseOptions();
    this.emit('loaded');
    this.on('server:init', this.attachRoutes.bind(this));
};

util.inherits(Config, StateBase);

Config.prototype.loadConfig = function () {
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
        configpath = path.join(home, '.config', 'kosmtik', 'config.yml'),
        config = {};
    try {
        config = fs.readFileSync(configpath, 'utf-8');
        config = yaml.safeLoad(config);
    } catch (err) {
        this.log('No usable config file found in', configpath);
    }
    var internals = [
        './plugins/base-exporters/index.js',
        './plugins/hash/index.js',
        './plugins/local-config/index.js'
    ];
    this.plugins = internals.concat(config.plugins || []);
};

Config.prototype.registerPlugin = function (name_or_path) {
    var Plugin, plugin;
    try {
        Plugin = require(name_or_path).Plugin;
    } catch (err) {
        this.log('Unable to load plugin', name_or_path);
        this.log(err);
        return;
    }
    this.log('Loading plugin from', name_or_path);
    new Plugin(this);
};

Config.prototype.initExporters = function () {
    this.exporters = {};
};

Config.prototype.registerExporter= function (format, path) {
    this.exporters[format] = path;
};

Config.prototype.initLoaders = function () {
    this.loaders = {};
    this.registerLoader('.mml', './back/loader/MML.js');
    this.registerLoader('.yml', './back/loader/YAML.js');
    this.registerLoader('.yaml', './back/loader/YAML.js');
};

Config.prototype.registerLoader = function (ext, name_or_path) {
    this.loaders[ext] = name_or_path;
};

Config.prototype.getLoader = function (ext) {
    if (!this.loaders[ext]) throw "Unkown project config type: " + ext;
    return require(this.loaders[ext]).Loader;
};

Config.prototype.initOptions = function () {
    this.opts = require("nomnom");
    this.commands = {};
    this.commands.project = this.opts.command('project').help('Load a project');
    this.commands.project.option('path', {
        position: 1,
        help: 'Project path to run at start.'
    });
    this.commands.plugins = this.opts.command('plugins');
    this.commands.plugins.option('list', {
        flag: true,
        help: 'Show installed plugins list'
    }).help('Manage plugins');
};

Config.prototype.parseOptions = function () {
    // Make sure to include all formats, even the ones
    // added by plugins.
    this.emit('parseopts');
    this.parsed_opts = this.opts.parse();
};

Config.prototype.initStatics = function () {
    this._js = [
        '/node_modules/leaflet/dist/leaflet.js',
        '/node_modules/Leaflet.FormBuilder/Leaflet.FormBuilder.js',
        '/src/front/Core.js',
        '/config/',
        './options/',
        '/src/front/Sidebar.js',
        '/src/front/FormBuilder.js',
        '/src/front/Map.js'
    ];
    this._css = [
        '/node_modules/leaflet/dist/leaflet.css',
        '/src/front/Sidebar.css',
        '/src/front/main.css'
    ];
};

Config.prototype.addJS = function (path) {
    this._js.push(path);
};

Config.prototype.addCSS = function (path) {
    this._css.push(path);
};

Config.prototype.toFront = function () {
    var options = {
        exportFormats: Object.keys(this.exporters)
    };
    this.emit('tofront', {options: options});
    return options;
};

Config.prototype.attachRoutes = function (e) {
    e.server.addRoute('/config/', this.serveForFront.bind(this));
};

Config.prototype.serveForFront = function (req, res) {
    res.writeHead(200, {
        "Content-Type": "application/javascript",
    });
    var tpl = "L.K.Config = %;";
    res.write(tpl.replace('%', JSON.stringify(this.toFront())));
    res.end();
};

Config.prototype.log = function () {
    console.warn.apply(console, Array.prototype.concat.apply(['[Core]'], arguments));
};

exports.Config = Config;