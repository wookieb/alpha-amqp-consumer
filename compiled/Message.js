"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(message, queue) {
        this.message = message;
        this.queue = queue;
    }
    get content() {
        return this.message.content;
    }
    get properties() {
        return this.message.properties;
    }
    get headers() {
        return this.message.properties.headers;
    }
    get exchange() {
        return this.message.fields.exchange;
    }
    get routingKey() {
        return this.message.fields.routingKey;
    }
    get fields() {
        return this.message.fields;
    }
}
exports.default = Message;
