const clean = require("./clean");
const transform = require("./transform");
const copy = require("./copy");
const late = require("./late");
const glob = require("@vimlet/commons-glob");
const path = require("path");

module.exports.build = async config => {
  if (!("log" in config) || config.log) {
    console.log("Build started...");
  }
  config = setupConfig(config);
  await clean(config);
  let sorted = sort(config);
  await processSorted(config, sorted.sorted);
  await build(config, sorted.unsorted);
  console.log("Build completed at: " + getTime());
};

// @function buildSingle (public) [Build single file which has been modified. Used at watch mode] @param config @param filePath
module.exports.buildSingle = function (config, filePath) {
  filePath = path.relative(config.inputBase, filePath).replace(/\\/g, "/");
  var matches = [];
  for (var outputKey in config.output) {
    if (!Array.isArray(config.output[outputKey])) {
      var inputs = config.output[outputKey].input;
      matchSingleConfig(inputs, matches, filePath, outputKey);
    } else {
      config.output[outputKey].forEach(function (cOut) {
        var inputs = cOut.input;
        matchSingleConfig(inputs, matches, filePath, outputKey);
      });
    }
  }
  var newOutput = {};
  matches.forEach(match => {
    if (config.output[match]) {
      newOutput[match] = config.output[match];
    }
  });
  config.output = newOutput;
  module.exports.build(config);
};

// @function matchSingleConfig (private) [Check whether an input match with modified file] @param inputs @param matches @param filePath @param outputKey
function matchSingleConfig(inputs, matches, filePath, outputKey) {
  for (var inputKey in inputs) {
    if (typeof inputs[inputKey] === "object" &&
      !Array.isArray(inputs[inputKey]) && "watch" in inputs[inputKey]) {
      if (glob.match(filePath, inputs[inputKey].watch).length > 0) {
        matches.push(outputKey);
      }
    } else if (glob.match(filePath, inputKey).length > 0) {
      matches.push(outputKey);
    }
  }
}

// @function processSorted (private) [Build sorted elements] @param config @param sorted
async function processSorted(config, sorted) {
  for (var key in sorted) {
    await build(config, sorted[key]);
  }
}

async function build(config, objs) {
  let hashes = {};
  let processOutputPromises = [];
  // Process copy and transform actions in order.
  objs.forEach(obj => {
    var isCopy = obj.outPath.endsWith("**");
    if (isCopy) {
      processOutputPromises.push(copy.process(config, obj));
    } else {
      processOutputPromises.push(transform.process(config, obj, hashes));
    }
  });
  // Flatten results nested arrays
  let processOutputResults = (await Promise.all(processOutputPromises))
    .reduce((prev, current) => {
      if (Array.isArray(current)) {
        current.map(result => {
          prev.push(result);
        });
      } else {
        prev.push(current);
      }
      return prev;
    }, []);
  // Finally process late actions (hash-parse and write)
  await late.process(processOutputResults, hashes, config);
}

// @funciton setupConfig (private)
function setupConfig(config) {
  config.hashLength = "hashLength" in config ? config.hashLength : 7;
  config.outputBase = "outputBase" in config ? config.outputBase : "";
  config.inputBase = "inputBase" in config ? config.inputBase : "";
  config.clean = "clean" in config ? config.clean : false;
  config = queryParam(config);
  return config;
}

// @function querParam (private) [Manage query param in outputs]
function queryParam(config) {
  var output = {};
  for (var key in config.output) {
    var query = key.split("?");
    if (query.length > 1) {
      try {
        output[query[0]] = setOutput(config.output[key]);
        var param = query[1].split("&");
        param.forEach(element => {
          setParam(element, output[query[0]]);
        });
      } catch (e) {
        console.log("Error parsing query param at: " + key);
      }
    } else {
      output[key] = setOutput(config.output[key]);
    }
  }
  config.output = output;
  return config;
}

// @function setOutput (private) [Set output config from inputs. Handle array, string or object]
function setOutput(output) {
  if (typeof output === 'object' && !Array.isArray(output)) {
    return output;
  } else {
    if (Array.isArray(output)) {
      var res = output.map(element => {
        if (typeof element === 'string') {
          var current = {
            input: {}
          };
          current.input[element] = true;
          return current;
        }
        return element;
      });
      return res;
    } else {
      var res = {
        input: {}
      };
      res.input[output] = true;
      return res;
    }
  }
}

// @function setParam (private) [Set up query params into element config] @param param @param obj [Output object]
function setParam(param, obj) {
  var split = param.split("=");
  if (split[0] && split[1]) {
    switch (split[0]) {
      case "clean":
        var value = split[1] === "true" ? true : false;
        setParamKey(obj, split[0], value);
        break;
      case "parse":
        var value = split[1] === "true" ? true : false;
        setParamKey(obj, split[0], value);
        break;
      default:
        setParamKey(obj, split[0], split[1]);
        break;
    }
  }
}

// @function setParamKey (private) [Set up single param into element config] @param obj [Output object] @param key [Param key] @param value
function setParamKey(obj, key, value) {
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    if (!(key in obj)) {
      obj[key] = value;
    }
  } else if (Array.isArray(obj)) {
    obj = obj.map(element => {
      if (typeof element === 'object') {
        if (!(key in element)) {
          element[key] = value;
        }
      }
      return element;
    });
  }
}

function sort(config) {
  var sorted = {};
  var unsorted = [];
  Object.keys(config.output).forEach(element => {
    if (typeof config.output[element] === 'object' && !Array.isArray(config.output[element])) {
      config.output[element].outPath = element;
      if ("order" in config.output[element]) {
        var currentOrder = parseInt(config.output[element].order);
        config.output[element].outPath = element;
        if (sorted[currentOrder]) {
          sorted[currentOrder].push(config.output[element]);
        } else {
          sorted[currentOrder] = [config.output[element]];
        }
      } else {
        unsorted.push(config.output[element]);
      }
    } else if (Array.isArray(config.output[element])) {
      config.output[element].forEach(e => {
        e.outPath = element;
        if ("order" in e) {
          var currentOrder = parseInt(e.order);
          if (sorted[currentOrder]) {
            sorted[currentOrder].push(e);
          } else {
            sorted[currentOrder] = [e];
          }
        } else {
          unsorted.push(e);
        }
      });
    }
  });
  return {
    sorted: sorted,
    unsorted: unsorted
  };
}

// @function getTime (private) [Return current time]
function getTime() {
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = today.getFullYear();
  var hours = today.getHours();
  if (hours < 10) {
    hours = "0" + hours;
  }
  var minutes = today.getMinutes();
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  var seconds = today.getSeconds();
  if (seconds < 10) {
    seconds = "0" + seconds;
  }
  today = dd + '/' + mm + '/' + yyyy + "/" + hours + ":" + minutes + ":" + seconds;
  return today;
};