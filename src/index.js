#! /usr/bin/env node
require('./utils/_ext');
require('./inquirer-extensions');

require('console.table');
var utils = require('./utils');

// update notifier
var updateNotifier = require('update-notifier');
updateNotifier({ pkg: require('../package.json') }).notify();

// start the cli app
var config = require('./config');
var Runner = require('dastoor').Runner;

var args = process.argv.splice(2);
var app = require('./commands');

function ensureConfig(node) {
    if (config.isInitialized) return;
    if (!node.$controller) return;
    if (node.path === 'onetime.init.harvest') return;

    utils.log();
    utils.log.err('onetime is not initialized.');
    utils.log();
    utils.log('please run:');
    utils.log.chalk('green', '    onetime init harvest');
    utils.log();
    utils.log('also optionally run:');
    utils.log.chalk('green', '    onetime init tp');
    utils.log();
    process.exit(0);
}

var runner = new Runner({
    errorLog: utils.log.err,
    helpLog: function () {
        var args = Array.prototype.slice.call(arguments);
        utils.log.chalk.apply(utils, ['green'].concat(args));
    },
    localArgs: config.locals
});

runner.onNodeStarting(ensureConfig);
runner.run(app, args);
