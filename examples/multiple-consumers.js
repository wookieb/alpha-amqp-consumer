const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            (message) => {
                // do something with message
            },
            {queue: 'example-queue'}
        );

        manager.consume(
            (message) => {
                return Promise.resolve('test')
            },
            {queue: 'example-queue-2'},
        );
    });