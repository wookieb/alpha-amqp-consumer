const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            {queue: 'example-queue'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );
    });