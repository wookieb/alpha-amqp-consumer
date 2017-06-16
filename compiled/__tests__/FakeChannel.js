"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class FakeChannel {
    publish() { }
    consume() { }
    assertQueue() { }
    assertExchange() { }
    bindExchange() { }
    bindQueue() { }
    cancel() { }
    ack() { }
    reject() { }
    nack() { }
}
exports.FakeChannel = FakeChannel;
