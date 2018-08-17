function controller(t) {
    var utils = require('../../utils');
    var harvest = require('../../api/harvest')();
    var tp = require('../../api/tp')();
    var base = require('./_base');

    function pauseAndLog(e, done) {
        if (e.running) {
            utils.log('    Stopping timer on harvest...');
            harvest.TimeTracking.toggleTimer({ id: e.id }, function (err) {
                if (err) return utils.log.err(err);
                utils.log.succ('  Done.');
                logTime(e, done);
            });
        }
        else {
            utils.log('    Time is already stopped.');
            logTime(e, done);
        }
    }

    function logTime(e, done) {
        if (!tp || !(e.tp_task && e.tp_task.id) && !(e.tp_user_story && e.tp_user_story.id) || !e.hours) return done();

        var isBug = e.tp_task && e.tp_task.type === 'bug';
        var isTask = !isBug && e.tp_task;
        var getResource;

        utils.log('    Logging time on target process...');

        if (isBug) {
            getResource = tp.getBug(e.tp_task.id);
        } else if (isTask) {
            getResource = tp.getTask(e.tp_task.id);
        } else {
            getResource = tp.getStory(e.tp_user_story.id);
        }

        getResource.then(function (result) {
            if (isBug) {
                return tp.getIssueTimeTo(result.Project.Id).then(function (value) {
                    return {
                        tpResult: result,
                        issueTimeToValue: value.items[0].issueCFRaw
                    };
                });
            }

            return {
                tpResult: result
            };
        }).then(function (result) {
            // configured to not log bug-time at all
            if (isBug && result.issueTimeToValue === 'none') {
                utils.log.chalk('red', '    System is configured NOT to log bug times AT ALL.');
                return done(false);
            }

            if (isBug) {
                utils.log('    Bugs are configured to be logged against: ' + result.issueTimeToValue);
            }

            base.captureTimeRemaining(e.hours, result.tpResult, function (remain) {

                var tpdata = {
                    description: e.notes || '-',
                    spent: e.hours,
                    remain: remain,
                    date: new Date(e.created_at).toJSON()
                };

                function logTime_us(cb) {
                    // bugs may be without user-story
                    var isUserStory = result.tpResult.ResourceType === 'UserStory';
                    if (!isUserStory && !result.tpResult.UserStory) {
                        utils.log.chalk('red', '    This ' + result.tpResult.ResourceType + ' is not associated with a user-story. -- ignored');
                        return cb(false);
                    }

                    var userStoryId = isUserStory ? result.tpResult.Id : result.tpResult.UserStory.Id;

                    var tpusdata;
                    if (isUserStory) {
                        utils.log('    Logging time on the user story...');
                        tpusdata = {
                            description: 'time spent on user story #' + userStoryId,
                            spent: e.hours,
                            date: new Date(e.created_at).toJSON()
                        };
                    } else {
                        utils.log('    Logging bug time on the user story...');
                        tpusdata = {
                            description: 'time spent on bug #' + e.tp_task.id,
                            spent: e.hours,
                            date: new Date(e.created_at).toJSON()
                        };
                    }

                    tp.addTime(userStoryId, tpusdata)
                        .then(function () {
                            utils.log('    ' + tpdata.spent + 'h is logged on target process against user story #' + userStoryId);
                            cb(true);
                        }, function (err) {
                            utils.log.err(err);
                        });
                }

                function logTime_task(cb) {
                    tp.addTime(e.tp_task.id, tpdata)
                        .then(function () {
                            utils.log('    ' + tpdata.spent + 'h is logged on target process against ' + e.tp_task.type + ' #' + e.tp_task.id);
                            cb(true);
                        }, function (err) {
                            utils.log.err(err);
                        });
                }

                // if not bug, time is always on task
                if (isTask) {
                    return logTime_task(done);
                }
                else if (isBug) {
                    if (result.issueTimeToValue === 'Issue') {
                        return logTime_task(done);
                    }
                    else if (result.issueTimeToValue === 'User story') {
                        return logTime_us(done);
                    }
                } else {
                    return logTime_us(done);
                }
            });
        }, function (err) {
            utils.log.err('An error occured while fetching task from target process.' + err);
        });
    }

    function finish(e, done) {
        if (!e) return utils.log.err('No timer could be found.');
        if (e.finished) return utils.log.err('This time is already marked as finished.');

        utils.log('❯ finishing time:', e.id);
        pauseAndLog(e, function (finishEntry) {
            if (!e.tp_task && !e.tp_user_story) {
                utils.log('    Time is not associated with a target-process task.');
                return done();
            }

            if (!finishEntry) {
                return done();
            }
            
            utils.log('    Marking time as finished on harvest...');
            var model = {
                id: e.id,
                notes: e.full_notes + '\n' + harvest.prefixes.finishedPrefix
            };
            harvest.TimeTracking.update(model, function (err) {
                if (err) return utils.log.err(err);
                utils.log.succ('  Done.');
                done();
            });
        });
    }

    function finishAll(list) {
        var item = list.pop();
        if (!item) return;
        finish(item, function () {
            finishAll(list);
        });
    }

    var d = t.d || t.date;
    var offset = +(t.o || t.offset);
    if (!d && offset) d = new Date().addDays(-offset);
    base.selectTime(d, function (i) {
        return !i.finished;
    }, finishAll, t.all);
}

require('dastoor').builder
    .node('onetime.time.finish', {
        terminal: true,
        controller: controller
    })
    .help({
        description: 'finish a timesheet',
        options: [{
            name: '-d, --date',
            description: 'date of the timesheet. e.g. 2015-07-01'
        },
        {
            name: '-o, --offfset',
            description: 'date offset relative to today. e.g. 1 for yesterday'
        }, {
            name: '--all',
            description: 'finished all unfinished times'
        }]
    });
