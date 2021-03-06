/**
 * call main functionality
 * @version 0.0.1
 * @module api/v1/call
 * @exports .
 * @namespace call
 */
var when = require("when");
var request = require("request");
var validator = require("validator");
var settings = require("../../settings");
var storage = require("../../storage");
var log = require("../../log");
var infra = require("../../infra");
var NotImplementedError = require("../errors").NotImplementedError;
var BadRequest = require("../errors").BadRequest;
var MissedParams = require("../errors").MissedParams;
var Forbidden = require("../errors").Forbidden;
var ServerError = require("../errors").ServerError;
var NotFound = require("../errors").NotFound;

/**
 * helper function used to sumbit demo call by calling storage.scheduleDemoCall
 * and call external api to generate static call file and call you back
 * @param {Array} call -call Array that contain call attributes
 * @memberof call
 * @private
 */
function __scheduleDemo(call) {
    return when.promise(function(resolve, reject) {
        return storage.scheduleDemoCall(call).then(function(demoCall) {
            var options = {
                url: "http://" + settings.infra.clientServer.mobile_voice_server.external_ip + "/generate/new_call/callfile/generate_file.php",
                method: "GET",
                qs: {
                    extension: call.sip,
                    time: call.time
                }
            };
            request(options, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    return resolve(demoCall);
                } else {
                    return reject(error);
                }
            });
        }).otherwise(function(error) {
            return reject(error);
        });
    });
}


/**
 * schedule call for mobile client which has avalid device_token
 * _if this client has demo flag equal zero it will submit demo call otherwise it will submit regular call_
 * @see [api/v1/utils/midware#callExtract](middleware.html#.callExtract)
 * @param {Object} req.ubi.call - call extracted by [api/v1/utils/midware#callExtract](middleware.html#.callExtract)
 * @throws {@link ServerError} if req.ubi.call.device_token not exist
 * @throws {@link ServerError} if __scheduleDemo failed
 * @return HTTP 200 if your call submitted successfully
 * @example
 * // returns {message: "call scheduled successfully", call: XXXX }
 * // returns {message: "demo call scheduled successfully", call: XXXX }
 * POST /sip/call
 * @memberof API
 */
function createSipCall(req, res, next) {

    var call = req.ubi.call;

    storage.getDevice(call.device_token).then(function(device) {
        storage.getClient(call.license_key).then(function(client) {
            if (client.demo === 0) { // schedule demo call if client demo flag is ZERO
                call.sip = device.sip;
                __scheduleDemo(call).then(function(dCall) {
                    return res.status(200).json({
                        message: "demo call scheduled successfully",
                        call: dCall.id
                    });
                }).otherwise(function(error) {
                    return next(new ServerError(error, req.path));
                });
            } else { //schedule regualr call if client exist and has demo flag with value other than zero
                storage.scheduleCall(call).then(function(call) {
                    return res.status(200).json({
                        message: "call scheduled successfully",
                        call: call.id
                    });
                }).otherwise(function(error) {
                    return next(new ServerError(error, req.path));
                });
            }
        }).otherwise(function(error) {
            return next(new Forbidden(error, req.path));
        });
    }).otherwise(function(error) {
        return next(new ServerError(error, req.path));
    });
}

/**
 * schedule regular call for phone client
 * @see [ai/v1/utils/midware#callExtract](middleware.html#.callExtract)
 * @param {Object} req.ubi.call - call extracted by [api/v1/utils/midware#callExtract](middleware.html#.callExtract)
 * @throws {@link ServerError} if storage.scheduleCall failed
 * @return TTP status 200 if your call submitted successfully
 * @example
 * // returns {message: "call scheduled successfully", call: XXXX }
 * // returns {message: "demo call scheduled successfully", call: XXXX }
 * POST /web/call
 * @memberof API
 */
function createWebCall(req, res, next) {

    var call = req.ubi.call;

    storage.scheduleCall(call).then(function(call) {
        return res.status(200).json({
            message: "call scheduled successfully",
            call: call.id
        });
    }).otherwise(function(error) {
        return next(new ServerError(error, req.path));
    });
}

/**
 * get call with id @param call_id
 * @param {Object} req.params - request params object
 * @param {Integer} req.params.call_id - call_id to mark as done
 * @throws {@link NotFound} if no call found with @param call_id
 * @return HTTP status 200 if call found and returned successfully
 * @example
 * //returns {call: {id:"xx",agent:"xxx"}}
 * GET /call/:call_id
 * @memberof API
 */
function getDetail(req, res, next) {
    var call_id = req.params.call_id;
    storage.getCallDetail(req.user, call_id).then(function(call) {
        return res.status(200).json({
            call: call
        });
    }).otherwise(function(error) {
        return next(new NotFound(error, req.path));
    });
}

/**
 * process call from queue with id @param queue_id it will reset call if error occur in infrastructure servers
 * @see [api/v1/utils/midware#isAuthenticated](middleware.html#.isAuthenticated)
 * @param {Object} req.params - request params object
 * @param req.params.queue_id - queue_id where we fetch the call
 * @param req.params.queue_slug - slug of queue name
 * @param {Object} req.user - current authenticated user
 * @param req.user.x-rtmp-session - your rtmp session to call you back
 * @throws {@link MissedParams} if @param req.params.queue_id not found
 * @throws {@link MissedParams} if @param req.params.queue_slug not found
 * @throws {@link MissedParams} if @param req.user.x-rtmp-session not found
 * @return HTTP status 200 if your call fetched successfully from queue
 * @example
 * // returns {message: "call updated successfully",call: {id:"xx",agent:"xxx"}}
 * GET /call/queue/:queue_id/:queue_slug
 * @memberof API
 */
function call(req, res, next) {
    var queue_id = req.params.queue_id;
    var queue_slug = req.params.queue_slug;
    if (!queue_id) {
        return next(new MissedParams(req.path, ["queue_id"]));
    }
    if (!queue_slug) {
        return next(new MissedParams(req.path, ["queue_slug"]));
    }
    if (!req.user.rtmp) {
        return next(new MissedParams(req.path, ["x-rtmp-session"]));
    }
    storage.getCall(req.user, queue_id, queue_slug).then(function(call) {
        res.status(200).json(call);
        infra.call(call, req.user).otherwise(function(error) {
            call.status = settings.call.status.retry;
            call.failure_cause = settings.call.reset_code;
            call.failure_cause_txt = error.toString();
            storage.markCallFail(call).otherwise(function(error) {
                log.error("error : %s", error, {
                    path: req.path
                });
            });
        });
    }).otherwise(function(error) {
        return next(new NotFound(error, req.path));
    });
}

/**
 * mark call with id @param call_id as done
 * @see [api/v1/utils/midware#isAuthenticated](middleware.html#.isAuthenticated)
 * @param {Object} req.params - request params object
 * @param {Integer} req.params.call_id - call_id to mark as done
 * @param {Object} req.body - request body object
 * @param {Integer} req.body.duration - how long this call take place @default **0**
 * @throws {@link NotFound} if no call found with @param call_id
 * @throws {@link Forbidden} if call with @param call_id has is_agent other than req.user.id
 * @throws {@link ServerError} if storage.markCallFail failed
 * @return HTTP status 200 if your call state updated successfully
 * @example
 * // returns {message: "call updated successfully",call: {id:"xx",agent:"xxx"}}
 * PUT /call/:call_id/done
 * @memberof API
 */
function done(req, res, next) {
    var details = {};
    details.duration = req.body.duration || req.headers["x-call-duration"] || 0;
    var call_id = req.params.call_id;
    storage.getCallDetail(req.user, call_id).then(function(call) {
        if (call.id_agent !== req.user.id || call.status !== settings.call.status.progress) {
            return next(new Forbidden({
                message: "you do not has call with id " + call_id
            }, req.path));
        }
        call.duration = details.duration;
        storage.markCallDone(call).then(function(call) {
            return res.status(200).json({
                message: "call updated successfully",
                call: call
            });
        }).otherwise(function(error) {
            return next(new ServerError(error, req.path));
        });
    }).otherwise(function(error) {
        return next(new NotFound(error, req.path));
    });
}

/**
 * mark call with id @param call_id as failed , which it will be retried if failed times is less than fail"s limit
 * @see [api/v1/utils/midware#isAuthenticated](middleware.html#.isAuthenticated)
 * @param {Object} req.params - request params object
 * @param {Integer} req.params.call_id - call_id to mark as failed
 * @param {Object} req.body - request body object
 * @param {Integer} req.body.error - why this call failed @default **unable to contact client**
 * @throws {@link NotFound} if no call found with @param call_id
 * @throws {@link Forbidden} if call with @param call_id has id_agent other than req.user.id
 * @throws {@link ServerError} if storage.markCallFail failed
 * @return HTTP status 200 if your call state updated successfully
 * @example
 * //returns {message: "call updated successfully",call: {id:"xx",agent:"xxx"}}
 * PUT /call/:call_id/failed
 * @memberof API
 */
function failed(req, res, next) {
    var details = {};
    details.error = req.body.error || req.headers["x-call-error"] || "unable to contact client";
    var call_id = req.params.call_id;
    storage.getCallDetail(req.user, call_id).then(function(call) {
        if (call.id_agent !== req.user.id || call.status !== settings.call.status.progress) {
            return next(new Forbidden({
                message: "you do not has call with id " + call_id
            }, req.path));
        }
        call.failure_cause = settings.call.failure_code;
        call.failure_cause_txt = details.error;
        if (call.retries > settings.call.retry_till) {
            call.status = settings.call.status.failure;
        } else {
            call.status = settings.call.status.retry;
        }
        storage.markCallFail(call).then(function(call) {
            return res.status(200).json({
                message: "call updated successfully",
                call: call
            });
        }).otherwise(function(error) {
            return next(new ServerError(error, req.path));
        });
    }).otherwise(function(error) {
        return next(new NotFound(error, req.path));
    });
}

/**
 * cancel call with id @param call_id
 * @param {Object} req.params - request params object
 * @param {Integer} req.params.call_id - call_id to cancel
 * @throws {@link MissedParams} if @param call_id is undefined
 * @throws {@link ServerError} if storage.cancelCall failed
 * @return HTTP 200 if your call canceled successfully
 * @example
 * //returns {message: "call canceled successfully"}
 * DELETE /call/:call_id
 * @memberof API
 */
function cancel(req, res, next) {
    var call_id = req.params.call_id;
    if (!call_id) {
        return next(new MissedParams(req.path, "call_id"));
    }
    storage.cancelCall(call_id).then(function() {
        return res.status(200).json({
            message: "call canceled successfully"
        });
    }).otherwise(function(error) {
        return next(new ServerError(error, req.path));
    });

}
/**
 * submit feedback for call with id @param call_id
 * @param {Object} req.params - request params object
 * @param {Integer} req.params.call_id - call_id to submit feedback
 * @param {Object} req.body - request body object
 * @param {String} req.body.feedback - body param to specify feedback message and override @param feedback_text
 * @param {String} req.body.feedback_text - body param to specify feedback message
 * @throws {@link MissedParams} if @param req.params.call_id is undefined
 * @throws {@link MissedParams} if @param req.body.feedback and @param req.body.feedback_text
 * @throws {@link ServerError} if storage.feedback failed
 * @return HTTP status 200 - if feedback submmitted successfully
 * @example
 * // returns {message: "feedback sent successfully"}
 * POST /call/:call_id/feedback
 * PUT /call/:call_id/feedback
 * @memberof API
 */
function submitFeedback(req, res, next) {
    var feedback = {};
    var missingParams = [];

    feedback.call_id = req.params.call_id || missingParams.push("call_id");
    feedback.feedback = feedback.feedback_text = req.body.feedback || req.body.feedback_text || missingParams.push("feedback");

    if (missingParams.length > 0) {
        return next(new MissedParams(req.path, missingParams));
    }

    storage.feedback(feedback).then(function(feedback) {
        return res.status(200).json({
            message: "feedback sent successfully"
        });
    }).otherwise(function(error) {
        return next(new ServerError(error, req.path));
    });

}

/**
helper function to map day from Number to STRING
* example: 0 ---> day_6
*/
function map_day(day) {
    var strDay = "";
    if (day === 0) {
        strDay = "day_6";
    } else if (day === 1) {
        strDay = "day_0";
    } else if (day === 2) {
        strDay = "day_1";
    } else if (day === 3) {
        strDay = "day_2";
    } else if (day === 4) {
        strDay = "day_3";
    } else if (day === 5) {
        strDay = "day_4";
    } else if (day === 6) {
        strDay = "day_5";
    }
    return strDay;
}
/**
 * Gets the working hours of admin and whether the day is available or not
 * @param zone Time zone {Number} send to server to match the UTC server time
 * @param queue_id {Number} used to get count of queues of calls with status "RETRY" or "CANCELED"
 * @return HTTP status 200 - if minutes sent successfully
 * @return HTTP status 200 - if not open yet
 * @return HTTP status 200 - if day off
 * @throws {@link ServerError} if storage.getAdmin or storage.getHours failed
 * @throws {@link NotFound} if storage.getHours failed to return working hours using admin.id
 * @example
 * // returns {message: "successful","remaining":47.03625,"waiting":315}
 * // returns {message: "closed","starts":9:00,"ends":17:00}
 * // returns {message: "day off"}
 * GET /workinghours/:zone/:queue
 * @memberof API
 */
function _workingHours(req, res, next) {
    var queue, waiting, flag, offset, day_start, day_end, start_time;
    var license_key = req.user.licence_key;
    var time_zone = req.params.zone;
    var queue_id = req.params.queue;
    var d = new Date();
    console.log(d);
    var utc_time = new Date().getTime(); //utc time in milliseconds
    var day = new Date().getDay(); //returns day in number
    storage.getAdmin(license_key).then(function(admin) {
        var _id = admin.id;
        var today = map_day(day);
        storage.getHours(_id).then(function(result) {
            var flag = result[today];
            var offset = result.time_zone_offset;
            var day_start = result[today + "_start"];
            console.log(day_start);
            var day_end = result[today + "_end"];
            console.log(day_end);
            if (flag === 1) {
                day_start = day_start.split(":");
                day_end = day_end.split(":");
                var hours_start = day_start[0];
                var hours_end = day_end[0];
                var minutes_start = day_start[1];
                var minutes_end = day_end[1];
                minutes_start = Number(minutes_start);
                var utc_start = Number(hours_start) - offset;
                console.log("starts at", utc_start);
                var utc_end = Number(hours_end) - offset;
                //change to milliseconds
                var start = new Date();
                start.setHours(utc_start);
                start.setMinutes(minutes_start);
                var end = new Date();
                end.setHours(utc_end);
                end.setMinutes(minutes_end);
                if (utc_time > start) {
                    if (end > utc_time) { //check on end
                        var milliseconds = end - utc_time;
                        var min = milliseconds / (1000 * 60);
                        storage.getQueueCallsCount(queue_id).then(function(count) {
                            res.status(200).json({
                                message: "successful",
                                remaining: min,
                                waiting: count * 5 //assuming average call is 5 minutes
                            });
                        });
                    } else {
                        start = utc_start;
                        start = start - Number(time_zone);
                        console.log(start);
                        if (start > 23) {
                            start = start - 23;
                            start = 0 + start;
                        }
                        end = utc_end - Number(time_zone);
                        if (end > 23) {
                            end = end - 23 - 1;
                            end = 0 + end;
                        }
                        start = start + ":" + day_start[1];
                        end = end + ":" + day_end[1];
                        res.status(200).json({
                            message: "closed",
                            starts: start,
                            ends: end
                        });
                    }

                } else {
                    start = utc_start;
                    start = start - Number(time_zone);
                    console.log(start);
                    if (start > 23) {
                        start = start - 23 - 1;
                        start = 0 + start;
                    }
                    end = utc_end;
                    end = end - Number(time_zone);
                    if (end > 23) {
                        end = end - 23 - 1;
                        end = 0 + end;
                    }
                    start = start + ":" + day_start[1];
                    end = end + ":" + day_end[1];
                    res.status(200).json({
                        message: "closed",
                        starts: start,
                        ends: end
                    });
                }
            } else {
                res.status(200).json({
                    message: "day off",
                });
            }
        }).otherwise(function(err) {
            return next(new NotFound(err, req.path));
        });
    }).otherwise(function(err) {
        return next(new ServerError(err, req.path));
    });
}

module.exports = {
    createSipCall: createSipCall,
    createWebCall: createWebCall,
    getDetail: getDetail,
    call: call,
    cancel: cancel,
    done: done,
    failed: failed,
    submitFeedback: submitFeedback,
    _workingHours: _workingHours
};