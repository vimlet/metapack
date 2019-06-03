const promisify = require("util").promisify;
const fs = require("fs");
const exists = promisify(fs.exists);
const rimraf = require("rimraf");
const path = require("path");
const glob = require("@vimlet/commons-glob");

module.exports = async config => {
  for (var key in config.output) {
    if (config.output[key].clean) {
      key = config.inputBase ? path.join(config.inputBase, key) : key;
      var fullPath = config.outputBase ? path.join(config.outputBase, key.replace("**", "").replace(/\\/g, "/")) : key.replace("**", "").replace(/\\/g,"/");      
      if (fullPath.indexOf("{{hash}}") < 0) {
        if (await exists(fullPath)) {
          rimraf.sync(fullPath);
        }
      } else {
        fullPath = fullPath.replace("{{hash}}", "**").replace(/\\/g, "/");   
        var files = await glob.files(fullPath);
        files.forEach(element => {          
          rimraf.sync(element.file);
        });
  
      }
    }
  }
};