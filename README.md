# Alpha AMQP Consumer

Library for reliable message consumption via AMQP protocol.

Features:
* Automatically reconnects and restores channels for consumers
* Super easy to use
* Ability to stop/resume consumption
* Supports queue <-> exchange binding
* Supports queue assertion
* Maintains counter of ongoing consumptions which helps implement [graceful app shutdown](examples/graceful-shutdown.js)
* Easy debugging with [debug](https://www.npmjs.com/package/debug) module


## Table of contents
* [Install](#install)
* [Usage](#usage)
* [API](#api)
    + [Brief API introduction](#brief-api-introduction)
* [Debugging](#debugging)
  
## Install
```bash
npm install alpha-amqp-consumer
```

## Usage

```javascript
const connect = require('alpha-amqp-consumer');

connect('amqp://localhost')
    .then(manager => {
        manager.consume(
            {queue: 'example-queue'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );
    }); 

```

Usage with promises
```javascript

// (...)

manager.consume(
    {queue: 'example-queue'},
    () => {
        // message will be automatically ACK-ed after 1s
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }
);
// (...)

```

## API
See special [API declaration file](API.d.ts) and [examples directory](./examples).

### Brief API introduction
First, you need to create an instance of ConnectionManager responsible for connection and channel initialization.

```javascript
const connect = require('alpha-amqp-consumer').connect;

connect('amqp://localhost?heartbeat=10')
    .then((connectionManager) => {
        // ready to go!    
    })
```

Now you can start creating instances of Consumer class that takes care about consuming queue or binding to an exchange and then consuming.

```javascript
const connect = require('alpha-amqp-consumer').connect;

connect('amqp://localhost?heartbeat=10')
    .then((connectionManager) => {
    
        // consuming a queue
        // ConnectionManager.prototype.consume returns an intance of Consumer
        
        // All created consumers are also stored in connectionManager.consumers array
        const queueConsumer = connectionManager.consume({
            queue: 'some-queue'
        }, (message) => {
            
            message instanceof Message; // simple wrapper for amqp.Message with few additional getters
            
            // consumer will ACK message when promise gets resolved
            // or rejects the message if promise gets rejected
            return new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        });
    
        // Creates new queue and binds to given exchange
        const queueForExchangeConsumer = connectionManager.consume({
            exchange: 'amqp.topic',
            pattern: 'some-routing-key'
        }, (message, ack, reject) => {
            // manually ACK-ing a message
            setTimeout(ack, 1000);
        });
    })
```


## Debugging
Run your app with DEBUG env variable. See [debug package docs](https://www.npmjs.com/package/debug) for more details.
```bash
DEBUG=alpha-amqp-consumer:* node app.js
``` 