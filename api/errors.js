/**
 * ubicall parent object Error
 * @version 0.0.1
 * @module api/v1/util/errors
 * @exports .
 * @namespace Error
 */
function UbicallError() {

}
UbicallError.prototype = Error.prototype;

/**
 * return HTTP 501 error with message "Not Implemented"
 * @param resource - current resource url path
 * @return HTTP 501
 * @memberof Error
 */
function NotImplementedError(resource) {
    this.name = "NotImplementedError";
    this.status = 501;
    this.response = {};
    this.response.resource = resource;
    this.response.message = "Not Implemented";
}
NotImplementedError.prototype = UbicallError.prototype;

/**
 * return HTTP 400 error with message "Problems In Parsing" or "Problems parsing" + @param field
 * @param resource - current resource url path
 * @param field - field which has error
 * @return HTTP 400
 * @memberof Error
 */
function BadRequest(resource, field) {
    this.name = "BadRequest";
    this.status = 400;
    this.response = {};
    this.response.resource = resource;
    this.response.message = "Problems In Parsing";
    if (field) {
        this.response.message = "Problems parsing " + field;
        this.response.errors = [];
        this.response.errors.push({
            field: field,
            "code": "invalid_field_value"
        });
    }
}
BadRequest.prototype = UbicallError.prototype;

/**
 * return HTTP 422 error with message "Validation Failed"
 * @param resource - current resource url path
 * @param params - all missed params
 * @return HTTP 422
 * @memberof Error
 */
function MissedParams(resource, params) {
    this.name = "MissedParams";
    this.status = 422;
    this.response = {};
    this.response.resource = resource;
    this.response.message = "Validation Failed";
    this.response.errors = [];
    for (var i = 0; i < params.length; i++) {
        this.response.errors.push({
            field: params[i],
            "code": "missing_field"
        });
    }
}
MissedParams.prototype = UbicallError.prototype;

/**
 * return HTTP 403 error with message "Bad credentials"
 * @param origin - original error object
 * @param resource - current resource url path
 * @return HTTP 403
 * @memberof Error
 */
function Forbidden(origin, resource) {
    this.name = "Forbidden";
    this.status = 403;
    this.response = {};
    this.response.resource = resource;
    this.response.message = "Bad credentials";
}
Forbidden.prototype = UbicallError.prototype;

/**
 * return HTTP 404 error with message "Not Found"
 * @param origin - original error object
 * @param resource - current resource url path
 * @return HTTP 404
 * @memberof Error
 */
function NotFound(origin, resource) {
    this.name = "Not Found";
    this.status = 404;
    this.response = {};
    this.response.resource = resource;
    this.response.message = "Not Found";
}
NotFound.prototype = UbicallError.prototype;

/**
 * return HTTP 500 error with @param message or  "Unexpected Condition Was Encountered"
 * @param origin - original error object
 * @param resource - current resource url path
 * @param message - custom error message
 * @return HTTP 404
 * @memberof Error
 */
function ServerError(origin, resource, message) {
    this.name = "Server Error";
    this.status = 500;
    this.response = {};
    this.response.resource = resource;
    this.response.message = message || "Unexpected Condition Was Encountered";
}
ServerError.prototype = UbicallError.prototype;

/**
 * return HTTP 429 error with @param message or  "Rate limit exceeded"
 * @param origin - original error object
 * @param resource - current resource url path
 * @param message - custom error message
 * @return HTTP 429
 * @memberof Error
 */
function RateLimitExceededError(origin, resource, message) {
    this.name = "RateLimitExceeded Error";
    this.status = 429;
    this.response = {};
    this.response.resource = resource;
    this.response.message = message || "Rate limit exceeded";
}
RateLimitExceededError.prototype = UbicallError.prototype;

module.exports = {
    UbicallError: UbicallError,
    NotImplementedError: NotImplementedError,
    BadRequest: BadRequest,
    MissedParams: MissedParams,
    Forbidden: Forbidden,
    ServerError: ServerError,
    NotFound: NotFound,
    RateLimitExceededError: RateLimitExceededError
};