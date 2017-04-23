import * as amqp from 'amqplib';

export interface MessageFields {
    readonly consumerTag: string,
    readonly deliveryTag: number,
    readonly redelivered: boolean,
    readonly exchange: string,
    readonly routingKey: string
}

export default class Message {


    constructor(public readonly message: amqp.Message, public readonly queue: string) {
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

    get fields(): MessageFields {
        return this.message.fields;
    }
}