const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            {queue: 'example-queue'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );

        manager.consume(
            {queue: 'example-queue-2'},
            (message) => {
                return Promise.resolve('test')
            }
        );
    });