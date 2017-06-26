"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Message_1 = require("./Message");
exports.Message = Message_1.default;
var Consumer_1 = require("./Consumer");
exports.Consumer = Consumer_1.default;
var ConsumerManager_1 = require("./ConsumerManager");
exports.ConsumerManager = ConsumerManager_1.default;
const ConsumerManager_2 = require("./ConsumerManager");
function connect(url, options) {
    return ConsumerManager_2.default.connect(url, options);
}
exports.connect = connect;
