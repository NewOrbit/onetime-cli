function controllers() {
    var inquirer = require('inquirer');
    var utils = require('../utils');
    var config = require('../config');
    var validation = require('../utils/validation');

    function buildFields(d) {
        return [
            {
                name: 'domain',
                message: 'Your ' + d + ' domain (e.g. mycompany):',
                validate: validation.identifier(true)
            },
            {
                name: 'email',
                message: 'Your ' + d + ' email:',
                validate: validation.email(true)
            },
            {
                type: 'password',
                name: 'password',
                message: 'Your ' + d + ' password:',
                validate: validation.required
            }
        ];
    }

    function prompt(d, done) {
        inquirer.prompt(buildFields(d), done);
    }

    function store(d, res) {
        config.set(d + '_domain', res.domain);
        config.set(d + '_email', res.email);
        config.set(d + '_password', res.password);
    }

    return {
        harvest: function () {
            prompt('Harvest', function (opts) {
                store('harvest', opts);
                config.set('_initialized', true);
                utils.log.succ('harvest is configured successfully.');
            });
        },

        tp: function () {
            prompt('Target Process', function (opts) {
                store('tp', opts);
                utils.log.succ('target process is configured successfully.');
            });
        }
    };
}

var cli = require('dastoor').builder;

cli.node('onetime.init')
    .help('initialize onetime');

cli.node('onetime.init.harvest', controllers.rebind('harvest'))
    .help('initialize harvest');

cli.node('onetime.init.tp', controllers.rebind('tp'))
    .help('initialize target process');
