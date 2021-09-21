/* eslint-env node */
const { Parser } = require('acorn');
const classFields = require('acorn-class-fields');

var ENV = require(process.cwd() + '/config/environment');
const fs = require('fs');

var baseURL, routerFound = false,
  fileData = '',
  routeArray = [];

const pathForRouterJS = 'app/router.js',
  currentDate = new Date();
const header =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

let nestedPath = [];
let ignoredPathObject = {};
let ignoreArry = []

if (ENV().sitemapAutogenerator !== undefined && ENV().sitemapAutogenerator.ignoreTheseRoutes !== undefined) { // Remove all / from ignoreTheseRoutes
  ignoredPathObject = ENV().sitemapAutogenerator.ignoreTheseRoutes;
  Object.keys(ignoredPathObject).map(function (key) {

    if (key.indexOf('/') > -1) {
      let newKey = key.replace(/\//g, "");
      ignoredPathObject[newKey] = ignoredPathObject[key];
      delete ignoredPathObject[key];
    } else {
      ignoreArry.push(key)
    }
  });
}

module.exports = {
  description: '',
  triggerSitemapBuilder: function (theURL) {
    baseURL = theURL;
    fs.readFile(pathForRouterJS, 'utf8', function (err, data) {
      if (err) return console.log('Encountered the following error:', err);
      let dataNew = data.slice(data.indexOf('Router.map'))
      let parseResults = Parser.extend(classFields).parse(dataNew, {
        sourceType: 'module',
      });

      let arrayToMap = parseResults.body;
      arrayToMap.map(function (item) { // Look for the Router object in the file -> i.e. Router.map(function()...
        if (item.type === "ExpressionStatement" && item.expression.callee.object.name === "Router") {
          routerFound = true;
          let innerArrayToMap = item.expression.arguments[0].body.body;
          isSingleOrNestedRoute()
          innerArrayToMap.map(function (item) { // Look for each this.route in Router.map
            isSingleOrNestedRoute(item.expression.arguments);
          });
        }
      });

      if (ENV().sitemapAutogenerator !== undefined && Array.isArray(ENV().sitemapAutogenerator.pathsOutsideEmberApp)) {
        ENV().sitemapAutogenerator.pathsOutsideEmberApp.forEach(function (path) {
          routeArray.push({
            completeRoute: '',
            path: path
          });
        });
      }

      if (routerFound === false) console.log('!!! sitemap-autogenerator could not find a Router object in your ember router.js file, process aborted!');
      else {
        // console.log(routeArray);
        writeToFile();
      }
    });
  },
};

function processPath(path, message) {
  if (!path.match(/\*/g) && !path.match(/\/\:/)) { // Exclude any route with ':' in the path (for route variable) and any route with '*' in the path
    // console.log(message, path);
    routeArray.push({
      completeRoute: combineAllPaths(nestedPath),
      path: checkForQuoteType(path)
    });
  }
}

function isSingleOrNestedRoute(itemExpressionArgument) {
  if (itemExpressionArgument === undefined) {
    routeArray.push({
      completeRoute: '',
      path: '/'
    });
  } else {
    if (itemExpressionArgument.length !== undefined) {

      if (itemExpressionArgument.length === 1) {
        processPath(itemExpressionArgument[0].value, '*** It\'s a simple route, no nesting, and no specified path ->');

      } else if (itemExpressionArgument.length === 2 && itemExpressionArgument[1].properties !== undefined && itemExpressionArgument[1].properties[0].key.name === "path") {
        processPath(itemExpressionArgument[1].properties[0].value.value, '*** It\'s a simple route with a specified path ->')
      } else if (itemExpressionArgument.length === 2 && itemExpressionArgument[1].properties === undefined && itemExpressionArgument[1].body.body.length === 0) {
        processPath(itemExpressionArgument[0].value, '*** It\'s a simple route, no nesting, and no specified path ->');

      } else if (itemExpressionArgument.length === 3 && itemExpressionArgument[1].properties !== undefined && itemExpressionArgument[1].properties[0].key.name === "path") {
        processPath(itemExpressionArgument[1].properties[0].value.value, '*** It\'s a simple route with a specified path ->')
        nestedPath.push(itemExpressionArgument[1].properties[0].value.value);
        // console.log('*** +++ Found a nested function with nested path name ->', itemExpressionArgument[1].properties[0].value.value);
        // console.log('nestedPath:', nestedPath);
        let itemExpressionArgumentToRecurse = itemExpressionArgument[2].body.body;
        itemExpressionArgumentToRecurse.map(function (item, index) {
          isSingleOrNestedRoute(item);
          if (index === itemExpressionArgumentToRecurse.length - 1) {
            nestedPath.pop();
          }
        });
      } else {
        if (itemExpressionArgument[1].type != undefined && itemExpressionArgument[1].type === "FunctionExpression") {

          nestedPath.push(itemExpressionArgument[0].value);
          // console.log('*** +++ Found a nested function with nested path name ->', itemExpressionArgument[0].value);
          // console.log('nestedPath:', nestedPath);
          let itemExpressionArgumentToRecurse = itemExpressionArgument[1].body.body;
          itemExpressionArgumentToRecurse.map(function (item, index) {

            isSingleOrNestedRoute(item);
            if (index === itemExpressionArgumentToRecurse.length - 1) {

              nestedPath.pop();
              // console.log('nestedPath:', nestedPath);
            }
          });
        }
      }
    } else { // Necessary for recursed routes
      if (itemExpressionArgument.expression.arguments.length === 1) {
        processPath(itemExpressionArgument.expression.arguments[0].value, '  *** It\'s a simple route, no nesting, and no specified path ->');
      } else if (itemExpressionArgument.expression.arguments.length === 2 && itemExpressionArgument.expression.arguments[1].properties !== undefined && itemExpressionArgument.expression.arguments[1].properties[0].key.name === "path") {
        // console.log('!!!', itemExpressionArgument.expression.arguments[1].properties[0].value.value);
        processPath(itemExpressionArgument.expression.arguments[1].properties[0].value.value, '  *** It\'s a simple route with a specified path ->');
      } else if (itemExpressionArgument.expression.arguments.length === 3 && itemExpressionArgument.expression.arguments[1].properties !== undefined && itemExpressionArgument.expression.arguments[1].properties[0].key.name === "path" && itemExpressionArgument.expression.arguments[2].body.body.length === 0) {
        // console.log('!!!', itemExpressionArgument.expression.arguments[1].properties[0].value.value);
        processPath(itemExpressionArgument.expression.arguments[1].properties[0].value.value, '  *** It\'s a simple route with a specified path ->');
      } else {

        if (itemExpressionArgument.expression.arguments[1].type === "FunctionExpression" && itemExpressionArgument.expression.arguments[1].body.body.length > 0) {
          nestedPath.push(itemExpressionArgument.expression.arguments[0].value);
          // console.log('*** +++ Found a nested function with nested path name ->', itemExpressionArgument.expression.arguments[0].value);
          // console.log('nestedPath:', nestedPath);
          let itemExpressionArgumentToRecurse = itemExpressionArgument.expression.arguments[1].body.body;
          itemExpressionArgumentToRecurse.map(function (item, index) {
            isSingleOrNestedRoute(item);
            if (index === itemExpressionArgumentToRecurse.length - 1) {
              nestedPath.pop();
              // console.log('nestedPath:', nestedPath);
            }
          });
        }
        else if (itemExpressionArgument.expression.arguments[1].type === "FunctionExpression" && itemExpressionArgument.expression.arguments[1].body.body.length === 0) {

          processPath(itemExpressionArgument.expression.arguments[0].value, '*** It\'s a simple route, no nesting, and no specified path ->');

        }
      }
    }
  }
}

function combineAllPaths(pathArray) {
  let path = "";
  pathArray.map(function (x, i) {
    if (i == 0) path += x;
    else path += "/" + x;
  });
  return path;
}

function writeToFile() {
  let changeFrequency, priority, showLog; // Look for custom values for 'changeFrequency' and 'defaultPriorityValue' in environment.js
  if (ENV().sitemapAutogenerator !== undefined) { // Check to see if user has created ENV "sitemap-autogenerator" in environment.js
    if (ENV().sitemapAutogenerator.changeFrequency !== undefined) changeFrequency = ENV().sitemapAutogenerator.changeFrequency;
    else changeFrequency = "daily";
    if (ENV().sitemapAutogenerator.defaultPriorityValue !== undefined) priority = ENV().sitemapAutogenerator.defaultPriorityValue;
    else priority = "0.5";
    if (ENV().sitemapAutogenerator.showLog !== undefined && ENV().sitemapAutogenerator.showLog === true) showLog = true;
    else showLog = false;
  } else {
    // console.log("\n! It looks like sitemap-autogenerator is installed but not properly configured. A default sitemap.xml will be created.\n! Please refer to the documentation regarding adding 'sitemap-autogenerator' to your ENV in environment.js file: https://www.npmjs.com/package/sitemap-autogenerator");
    changeFrequency = "daily";
    priority = "0.5";
    showLog = false;
  }

  routeArray.map(function (x, i) {
    let currentPriority = '0.9';
    let isIgnored = false;
    if (i == 0) {
      fileData += header; // Write the header
    } else {
      var regex = /\//g;
      let currentPath = routeArray[i].path;
      currentPriority = priority;
      ignoreArry.map(function (b, y) {
        if (ignoreArry[y] == currentPath){
          isIgnored = true;
        }
      });
    }

    if (ENV().sitemapAutogenerator === undefined || ENV().sitemapAutogenerator.ignoreTheseRoutes === undefined || isIgnored !== true) {
      fileData += ('\n  <url>\n    <loc>');
      writeToFileData(i, showLog, isIgnored);

      if (ENV().sitemapAutogenerator !== undefined && ENV().sitemapAutogenerator.customPriority !== undefined && ENV().sitemapAutogenerator.customPriority[currentPath] !== undefined) currentPriority = ENV().sitemapAutogenerator.customPriority[currentPath];

      fileData += ('</loc>\n    <lastmod>' + formatDate() + '</lastmod>\n    <changefreq>' + changeFrequency + '</changefreq>\n    <priority>' + currentPriority + '</priority>\n  </url>');
    } else {
      writeToFileData(i, showLog, isIgnored);
    }
  });
  fileData += ('\n</urlset>');

  let fileName = ENV()?.sitemapAutogenerator?.fileName ?? 'sitemap.xml';

  fs.writeFile(`public/${fileName}`, fileData, function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

function writeToFileData(i, showLog, isIgnored) {
  let isIgnoredMessage = '** Ignored path:';
  let pathString = baseURL
  if (routeArray[i].completeRoute !== "") {
    let routeString;
    if (routeArray[i].completeRoute.charAt(0) === "/") routeString = routeArray[i].completeRoute.substr(1);
    else routeString = routeArray[i].completeRoute;
    pathString += '/' + routeString;
  }
  if (routeArray[i].path !== "" && routeArray[i] !== "/") {
    let cleanedPath;
    if (routeArray[i].path.charAt(0) === "/") cleanedPath = routeArray[i].path.substr(1);
    else cleanedPath = routeArray[i].path;
    pathString += "/" + cleanedPath;
  }
  if (isIgnored === false) fileData += (pathString);
  if (showLog === true && isIgnored === false) console.log(pathString);
  else if (showLog === true && isIgnored === true) console.log(isIgnoredMessage, pathString);
}

function formatDate() {
  let date, year, month, day;
  day = currentDate.getDate(), month = currentDate.getMonth() + 1, year = currentDate.getFullYear();
  if (day < 10) day = '0' + day;
  if (month < 10) month = '0' + month;
  date = year + '-' + month + '-' + day;
  return date;
}

function checkForQuoteType(data) {
  // console.log('DATA:', data)
  if (data !== undefined && data.includes("'" || data.includes('"'))) {
    if (data.includes("'")) return data.match(/\'.*\'/)[0].replace(/'|"/g, "");
    else return data.match(/\".*\"/)[0].replace(/'|"/g, "");
  } else return data;
}
