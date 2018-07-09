import * as amqp from 'amqplib';

export default class Message {


    constructor(public readonly message: amqp.Message, public readonly queue: string) {
    }

    get content() {
        return this.message.content;
    }

    get properties(): amqp.MessageProperties {
        return this.message.properties;
    }

    get headers(): amqp.MessagePropertyHeaders {
        return this.message.properties.headers;
    }

    get exchange() {
        return this.message.fields.exchange;
    }

    get routingKey() {
        return this.message.fields.routingKey;
    }

    get fields(): amqp.MessageFields {
        return this.message.fields;
    }
}