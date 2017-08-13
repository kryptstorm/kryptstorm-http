"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Https;

var _express = require("express");

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require("body-parser");

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _cors = require("cors");

var _cors2 = _interopRequireDefault(_cors);

var _methodOverride = require("method-override");

var _methodOverride2 = _interopRequireDefault(_methodOverride);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; } /** External modules */


var defaultOptions = {
  isDebug: false,
  routes: { "/": { get: "x_http:index" } }
};
var _errorMessage = "Server encountered an error while trying to handle request";

function Https(options) {
  var server = (0, _express2.default)();

  /** Retrieve option */

  var _$merge = _lodash2.default.merge(defaultOptions, options),
      isDebug = _$merge.isDebug,
      routes = _$merge.routes;

  /** Init function */


  this.add("init:XHttp", function initXHttp(args, done) {
    var _this = this;

    /** This module is depend on kryptstorm-service */
    if (!this.has("init:XService")) {
      return done(new Error("[kryptstorm-http] is depend on [kryptstorm-service]"));
    }

    /** Init express server with default config */
    server.use((0, _methodOverride2.default)("X-HTTP-Method-Override"));
    server.use((0, _cors2.default)({ methods: ["GET", "POST"] }));
    server.use(_bodyParser2.default.json());
    server.use(_bodyParser2.default.urlencoded({ extended: true }));

    /** Mapping the routes */
    var _routes = _prepareRoutes(routes);
    /** Register route to express */
    _lodash2.default.each(_routes, function (route, url) {
      /** Register each method [get, post, put, delete] */
      _lodash2.default.each(route, function (pattern, method) {
        server[method](url, function (req, res, next) {
          return _this.XService$.act(pattern, _preparePayload(req, res)).then(function (_ref) {
            var _ref$errorCode$ = _ref.errorCode$,
                errorCode$ = _ref$errorCode$ === undefined ? "ERROR_NONE" : _ref$errorCode$,
                _ref$message$ = _ref.message$,
                message$ = _ref$message$ === undefined ? "" : _ref$message$,
                _ref$data$ = _ref.data$,
                data$ = _ref$data$ === undefined ? {} : _ref$data$;

            /** If errorCode$ is not equal to ERROR_NONE, response error code and error message */
            if (errorCode$ !== "ERROR_NONE") {
              return res.json({ errorCode: errorCode$, message: message$ });
            }

            /** Return JSON */
            return res.json({
              errorCode: errorCode$,
              data: data$
            });
          }).catch(next);
        });
      });
    });

    /** Handle 404 error */
    server.use(function (req, res, next) {
      return res.status(404).json({
        errorCode: "ERROR_NOT_FOUND",
        message: "The requested URL [" + req.url + "] was not found on this server"
      });
    });

    /** Handle system error */
    server.use(function (err, req, res, next) {
      var httpCode = 500,
          errorResponse = { errorCode: "ERROR_SYSTEM", message: _errorMessage };

      if (isDebug) {
        errorResponse.message = err.message, errorResponse.errors = err.stack;
      }

      return res.status(httpCode).json(errorResponse);
    });

    return done();
  });

  /** Default route */
  this.add("x_http:index", function xHttpIndex(args, done) {
    return done(null, { data$: { hello: "world!" } });
  });

  return { name: "XHttp", exportmap: { server: server } };
}

/** Prepare routes */
var _prepareRoutes = function _prepareRoutes(routes) {
  var _routes = {};
  if (!_lodash2.default.isObject(routes) || _lodash2.default.isEmpty(routes)) return _routes;

  _lodash2.default.each(routes, function (route, url) {
    if (!url) return;
    /** Short syntax */
    if (_lodash2.default.isString(route)) return _routes[url] = { get: route };

    _routes[url] = {};
    /** Full syntax */
    if (route.get) _routes[url].get = route.get;
    if (route.post) _routes[url].post = route.post;
    if (route.put) _routes[url].put = route.put;
    if (route.delete) _routes[url].delete = route.delete;
    return true;
  });

  return _routes;
};

/** Prepare payload to put to seneca */
var _preparePayload = function _preparePayload(req, rest) {
  var _req$query = req.query,
      query = _req$query === undefined ? {} : _req$query,
      _req$body = req.body,
      body = _req$body === undefined ? {} : _req$body,
      _req$params = req.params,
      params = _req$params === undefined ? {} : _req$params,
      method = req.method;
  var _req$locals = req.locals,
      locals = _req$locals === undefined ? {} : _req$locals;

  var _limit = query._limit,
      _page = query._page,
      _sort = query._sort,
      _query$_accessToken = query._accessToken,
      _accessToken = _query$_accessToken === undefined ? "" : _query$_accessToken,
      _query$_refreshToken = query._refreshToken,
      _refreshToken = _query$_refreshToken === undefined ? "" : _query$_refreshToken;

  var _locals$authorization = locals.authorization,
      authorization = _locals$authorization === undefined ? {} : _locals$authorization;


  var _payload = {};

  /** Get JWT from header or query */
  var accessToken = req.get("X-Auth-Access-Token");
  var refreshToken = req.get("X-Auth-Refresh-Token");
  _payload.accessToken = !_lodash2.default.isString(accessToken) ? _accessToken : "";
  _payload.refreshToken = !_lodash2.default.isString(refreshToken) ? _refreshToken : "";

  /** Authorization */
  if (authorization) _payload.authorization = authorization;

  /** Bind _payload */
  switch (method) {
    case "POST":
      _payload.attributes = _lodash2.default.isObject(body) ? body : {};
      break;
    case "GET":
      _payload.query = _preapreQuery(query, ["_limit", "_page", "_sort", "_token"]);
      _payload.sort = _prepareSort(_sort);
      _payload.params = _lodash2.default.isObject(params) ? params : {};
      _lodash2.default.assign(_payload, _preparePagination(_limit, _page));
      break;
    case "PUT":
      _payload.params = _lodash2.default.isObject(params) ? params : {};
      _payload.attributes = _lodash2.default.isObject(body) ? body : {};
      break;
    case "DELETE":
      _payload.params = _lodash2.default.isObject(params) ? params : {};
      break;
  }

  return _payload;
};

/** Prepare query */
var _preapreQuery = function _preapreQuery() {
  var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var excludeFields = arguments[1];

  /** Return empty object if query have invalid type */
  if (!_lodash2.default.isObject(query) || _lodash2.default.isEmpty(query)) {
    return {};
  }
  /** Return full query data if excludeFields is not an array or is empty */
  if (_lodash2.default.isEmpty(excludeFields) || !_lodash2.default.isArray(excludeFields)) return query;

  return _lodash2.default.omit(query, excludeFields);
};

/** Prepare sort */
var _prepareSort = function _prepareSort(sort) {
  if (!_lodash2.default.isString(sort) || !sort) sort = "id";
  return _lodash2.default.reduce(sort.split(","), function (_sort, field) {
    if (field[0] !== "-") return _lodash2.default.assign(_sort, _defineProperty({}, field, 1));
    return _lodash2.default.assign(_sort, _defineProperty({}, field.substr(1), -1));
  }, {});
};

/** Prepare pagination */
var _preparePagination = function _preparePagination(limit, page) {
  var p = { limit: 20, offset: 0 };
  limit = parseInt(limit, 10);
  page = parseInt(page, 10);

  if (_lodash2.default.isNumber(limit) && limit > 0) {
    p.limit = limit;
  }
  if (_lodash2.default.isNumber(page) && page > 0) {
    p.offset = (page - 1 < 0 ? page : page - 1) * limit;
  }
  return p;
};