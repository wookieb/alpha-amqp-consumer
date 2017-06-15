const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            (message) => {
                // do something with message
            },
            {exchange: 'amqp.topic', pattern: 'some-subject'}
        );
    });