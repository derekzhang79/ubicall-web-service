var when = require("when");
var mongoose = require("mongoose");
var logSchema = require("./mongo/models/log");
var limitExceededSchema = require("./mongo/models/limitExceeded");
var reportsSchema = require("./mongo/models/report");
var helper = require("./helper");
var aggregate = require("./aggregate");
var settings = require("../../settings");
var log = require("../../log");

var $log, $limitExceeded, $report;

/**
 * @param request instance of ./models/ubicall_log/log
 **/
function logRequest(request) {
    return when.promise(function(resolve, reject) {
        var req = new $log(request);
        req.save(function(err, doc) {
            if (err) {
                return reject(err);
            }
            return resolve(doc);
        });
    });
}


module.exports = {
    init: function(_settings) {
        return when.promise(function(resolve, reject) {
            settings = _settings;
            var _host = settings.log.mongo.external_ip;
            var _port = settings.log.mongo.external_port;
            if (!process.env.db_env || process.env.db_env === "internal") {
                _host = settings.log.mongo.internal_ip;
                _port = settings.log.mongo.internal_port;
            }
            var uri = "mongodb://" + _host + ":" + _port + "/" + settings.log.mongo.database;
            var options = {
                db: {
                    native_parser: true
                },
                server: {
                    poolSize: 5
                },
                user: settings.log.mongo.username || "",
                pass: settings.log.mongo.password || ""
            };
            var conn = mongoose.createConnection(uri, options, function(err) {
                if (err) {
                    log.info("unable to connectto DB => %s:%s:%s", settings.log.mongo.database, _host, _port);
                    log.info("%s", err.toString());
                    return reject(err);
                }
                log.info("connected successfully to DB => %s:%s:%s", settings.log.mongo.database, _host, _port);

                // why => http://stackoverflow.com/a/12807133
                $log = conn.model("log", logSchema, "log");
                $limitExceeded = conn.model("limit", limitExceededSchema, "limit");
                $report = conn.model("report", reportsSchema, "report");
                return resolve(aggregate.init(conn));

            });
        });
    },
    logFakeRequests: function() {
        var promises = [];
        for (var i = 0; i < 100; i++) {
            promises.push(logRequest(helper.getFakeRequest()));
        }
        return when.all(promises);
    },
    /**
     * @param request instance of ./models/ubicall_log/log
     **/
    logRequest: logRequest,
    limitExceeded: function(licence_key, path, limit) {
        return when.promise(function(resolve, reject) {
            var __lex = new $limitExceeded({
                licence_key: licence_key,
                url: path,
                max_limit: limit
            });
            __lex.save(function(err, doc) {
                if (err || !doc) {
                    return reject(err || "no doc found !!");
                }
                return resolve(doc.toObject());
            });
        });
    },
    clearLog: function() {
        return when.promise(function(resolve, reject) {
            $log.remove({}, function(err, done) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    },
    clearReport: function() {
        return when.promise(function(resolve, reject) {

        });
    },
    aggregateLogs: aggregate.aggregateLogs
};