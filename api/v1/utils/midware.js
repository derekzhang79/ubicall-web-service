/**
 * api shared middleware
 * @version 0.0.1
 * @module api/v1/utils/midware
 * @exports .
 * @namespace middleware
 */
var when = require("when");
var validator = require("validator");
var settings = require("../../../settings");
var NotImplementedError = require("../../errors").NotImplementedError;
var BadRequest = require("../../errors").BadRequest;
var MissedParams = require("../../errors").MissedParams;
var Forbidden = require("../../errors").Forbidden;
var ServerError = require("../../errors").ServerError;
var NotFound = require("../../errors").NotFound;
var log = require("../../../log");

/**
 * middleware to check if your request has @param x-rtmp-session
 * @param {Object} req.headers - request params object
 * @param {Object} req.headers.x-rtmp-session - rtmp session
 * @throws {@link MissedParams} if @param req.params.x-rtmp-session is undefined
 * @memberof middleware
 */
function ensureRTMP(req, res, next) {
    req.user.rtmp = req.headers["x-rtmp-session"] || req.params["x-rtmp-session"] || req.query["x-rtmp-session"];
    if (!req.user.rtmp) {
        return next(new MissedParams(req.path, ["x-rtmp-session"]));
    }
    next();
}

/**
 * middleware to check if your request has @param call_id
 * @param {Object} req.params - request params object
 * @param {Object} req.params.call_id - call_id request param
 * @throws {@link MissedParams} if @param req.params.call_id is undefined
 * @memberof middleware
 */
function isCallExist(req, res, next) {
    var call_id = req.params.call_id;
    if (!call_id) {
        return next(new MissedParams(req.path, "call_id"));
    }
    req.ubi = req.ubi || {};
    req.ubi.call_id = req.params.call_id;
    next();
}

/**
 * extract call attributes from request body
 * @param {Object} req.body - request body object
 * @param {integer} req.body.caller_type - flag to distinguish how actual call will acquired {iphone : 0 , android : 1 , web : 2 , phone : 3}, will extracted form req.client if not sent
 * @param {integer} req.body.sip - your phone number , virtual which generated from /sip/account or /web/account APIs or your real phone number if you will recieve un voip call
 * @param {integer} req.body.queue - what queue id you like to submit your call
 * @param {UID} req.body.device_token - your mobile device_token, not required if you use web client
 * @param {Object} req.body.call_data - json object contain your call meta info @default **NULL**
 * @param {UID} req.body.longitude - your location longitude and it grabbed automatically @default **NULL**
 * @param {UID} req.body.latitude - your location latitude and it grabbed automatically @default **NULL**
 * @param {String} req.body.address - your location address and it grabbed automatically  @default **NULL**
 * @param {Date} req.body.time - time you like to call you , if not existed you will be called using FIFO algorithm (this may changed in next releases)  @default **NULL**
 * @todo check if req.body.call_data is valid json if exist
 * @throws {@link MissedParams} if @param req.body.caller_type is missing
 * @throws {@link MissedParams} if @param req.body.sip is missing
 * @throws {@link MissedParams} if @param req.body.device_token is missing and your client is mobile.
 * @throws {@link BadRequest} if @param req.body.json is not valid
 * @memberof middleware
 */
function callExtract(req, res, next) {

    var call = {};
    var missingParams = [];
    call.caller_type = req.body.caller_type;
    if(!call.caller_type){
      switch (req.user.appid) {
        case "ubicall-mob-ios":
          call.caller_type = "0";
          break;
        case "ubicall-mob-android":
          call.caller_type = "1";
          break;
        case "ubicall-widget":
          call.caller_type = "2";
          break;
        default:
          call.caller_type = missingParams.push("caller_type");
      }
    }
    call.sip = req.body.phone || req.body.sip || req.body.voiceuser_id || missingParams.push("phone");
    call.queue = req.params.queue_id || req.body.queue || req.body.queue_id || req.body.qid || missingParams.push("queue_id");
    call.license_key = req.user.licence_key || missingParams.push("license_key");

    // if this is mobile call then device_token is critical parameter otherwise it not so important
    if (call.caller_type === 0 || call.caller_type === 1) {
        call.device_token = req.body.device_token || missingParams.push("device_token");
    } else {
        call.device_token = req.body.device_token;
    }
    //TODO check if call.call_data is valid json if exist
    call.call_data = req.body.json || req.body.call_data || req.body.form_data;
    call.longitude = req.body.longitude || req.body.long;
    call.latitude = req.body.latitude || req.body.lat;
    call.address = req.body.address;
    call.time = req.body.time || req.body.call_time;

    if (missingParams.length > 0) {
        return next(new MissedParams(req.path, missingParams));
    }

    if (call.time && !validator.isAfter(call.time)) {
        return next(new BadRequest(req.path, "call_time"));
    }
    req.ubi = {};
    req.ubi.call = call;
    next();
}

module.exports = {
    ensureRTMP: ensureRTMP,
    isCallExist: isCallExist,
    callExtract: callExtract
};
