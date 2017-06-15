"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
class ResultContext {
    retry(delay) {
        assert.ok(this.retryTopology, 'You must set "retryTopology" before using retry');
        assert.ok(delay > 0, 'Delay must be greater than 0');
        this.channel.publish(this.retryTopology.exchange.pre, this.consumer.queue, this.message.content, Object.assign({}, this.message.properties, { expiration: delay }));
        this.reject(false);
    }
}
exports.ResultContext = ResultContext;
