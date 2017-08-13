/** External modules */
import Express from "express";
import BodyParser from "body-parser";
import Cors from "cors";
import MethodOverride from "method-override";
import _ from "lodash";

const defaultOptions = {
  isDebug: false,
  routes: { "/": { get: "x_http:index" } }
};
const _errorMessage =
  "Server encountered an error while trying to handle request";

export default function Https(options) {
  let server = Express();

  /** Retrieve option */
  const { isDebug, routes } = _.merge(defaultOptions, options);

  /** Init function */
  this.add("init:XHttp", function initXHttp(args, done) {
    /** This module is depend on kryptstorm-service */
    if (!this.has("init:XService")) {
      return done(
        new Error("[kryptstorm-http] is depend on [kryptstorm-service]")
      );
    }

    /** Init express server with default config */
    server.use(MethodOverride("X-HTTP-Method-Override"));
    server.use(Cors({ methods: ["GET", "POST"] }));
    server.use(BodyParser.json());
    server.use(BodyParser.urlencoded({ extended: true }));

    /** Mapping the routes */
    const _routes = _prepareRoutes(routes);
    /** Register route to express */
    _.each(_routes, (route, url) => {
      /** Register each method [get, post, put, delete] */
      _.each(route, (pattern, method) => {
        server[method](url, (req, res, next) =>
          this.XService$
            .act(pattern, _preparePayload(req, res))
            .then(
              ({ errorCode$ = "ERROR_NONE", message$ = "", data$ = {} }) => {
                /** If errorCode$ is not equal to ERROR_NONE, response error code and error message */
                if (errorCode$ !== "ERROR_NONE") {
                  return res.json({ errorCode: errorCode$, message: message$ });
                }

                /** Return JSON */
                return res.json({
                  errorCode: errorCode$,
                  data: data$
                });
              }
            )
            .catch(next)
        );
      });
    });

    /** Handle 404 error */
    server.use((req, res, next) => {
      return res.status(404).json({
        errorCode: "ERROR_NOT_FOUND",
        message: `The requested URL [${req.url}] was not found on this server`
      });
    });

    /** Handle system error */
    server.use((err, req, res, next) => {
      let httpCode = 500,
        errorResponse = { errorCode: "ERROR_SYSTEM", message: _errorMessage };

      if (isDebug) {
        (errorResponse.message = err.message), (errorResponse.errors =
          err.stack);
      }

      return res.status(httpCode).json(errorResponse);
    });

    return done();
  });

  /** Default route */
  this.add("x_http:index", function xHttpIndex(args, done) {
    return done(null, { data$: { hello: "world!" } });
  });

  return { name: "XHttp", exportmap: { server } };
}

/** Prepare routes */
const _prepareRoutes = routes => {
  let _routes = {};
  if (!_.isObject(routes) || _.isEmpty(routes)) return _routes;

  _.each(routes, (route, url) => {
    if (!url) return;
    /** Short syntax */
    if (_.isString(route)) return (_routes[url] = { get: route });

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
const _preparePayload = (req, rest) => {
  const { query = {}, body = {}, params = {} } = req;
  const { _limit, _page, _sort, _accessToken = "", _refreshToken = "" } = query;
  let _payload = {};

  /** Bind _payload */
  switch (method) {
    case "POST":
      _payload.attributes = _.isObject(body) ? body : {};
      break;
    case "GET":
      _payload.query = _preapreQuery(query, [
        "_limit",
        "_page",
        "_sort",
        "_accessToken",
        "_refreshToken"
      ]);
      _payload.sort = _prepareSort(_sort);
      _payload.params = _.isObject(params) ? params : {};
      _.assign(_payload, _preparePagination(_limit, _page));
      break;
    case "PUT":
      _payload.params = _.isObject(params) ? params : {};
      _payload.attributes = _.isObject(body) ? body : {};
      break;
    case "DELETE":
      _payload.params = _.isObject(params) ? params : {};
      break;
  }

  return _payload;
};

/** Prepare query */
const _preapreQuery = (query = {}, excludeFields) => {
  /** Return empty object if query have invalid type */
  if (!_.isObject(query) || _.isEmpty(query)) {
    return {};
  }
  /** Return full query data if excludeFields is not an array or is empty */
  if (_.isEmpty(excludeFields) || !_.isArray(excludeFields)) return query;

  return _.omit(query, excludeFields);
};

/** Prepare sort */
const _prepareSort = sort => {
  if (!_.isString(sort) || !sort) sort = "id";
  return _.reduce(
    sort.split(","),
    (_sort, field) => {
      if (field[0] !== "-") return _.assign(_sort, { [field]: 1 });
      return _.assign(_sort, { [field.substr(1)]: -1 });
    },
    {}
  );
};

/** Prepare pagination */
const _preparePagination = (limit, page) => {
  const p = { limit: 20, offset: 0 };
  limit = parseInt(limit, 10);
  page = parseInt(page, 10);

  if (_.isNumber(limit) && limit > 0) {
    p.limit = limit;
  }
  if (_.isNumber(page) && page > 0) {
    p.offset = (page - 1 < 0 ? page : page - 1) * limit;
  }
  return p;
};
