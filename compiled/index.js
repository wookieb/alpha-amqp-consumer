"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ConnectionManager_1 = require("./ConnectionManager");
var Message_1 = require("./Message");
exports.Message = Message_1.default;
var Consumer_1 = require("./Consumer");
exports.Consumer = Consumer_1.default;
var ConnectionManager_2 = require("./ConnectionManager");
exports.ConnectionManager = ConnectionManager_2.default;
/**
 * Connects to AMQP server and returns instance of ConnectionManager
 *
 * @param url connection URL to AMQP broker. Should contain "heartbeat" query param.
 * @param [options]
 * @returns {Promise<ConnectionManager>}
 */
function connect(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const connectionManager = new ConnectionManager_1.default(url, options);
        yield connectionManager.connect();
        return connectionManager;
    });
}
exports.connect = connect;
