'use strict';

const ConnectionManager = require('./src/ConnectionManager');

exports.connect = (url, options, callback) => {
    if (options instanceof Function) {
        callback = options;
        options = {};
    }
    const connection = new ConnectionManager(url, options);
    connection.connect((err) => {
        if (err) {
            callback && callback(err);
            return;
        }

        callback(null, connection);
    });
};

exports.ConnectionManager = ConnectionManager;