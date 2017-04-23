const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            {exchange: 'amqp.topic', pattern: 'some-subject'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );
    });