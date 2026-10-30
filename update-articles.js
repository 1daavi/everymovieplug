#!/usr/bin/env node
// Retired: news and article tiles are now built (with page 1, 2, 3 ... navigation) by build-listings.js.
// This stub keeps old commands working.
console.log("update-*.js is replaced by build-listings.js - running it now.");
process.argv.splice(2, 0, ...(/news/.test(__filename) ? ["--only=news"] : ["--only=articles"]));
require("./build-listings.js");
