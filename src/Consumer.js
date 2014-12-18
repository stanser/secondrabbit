/* TODO 
* Refactoring
* move repository to Kwebbl
* treaded start
* Broker: real starts and stops
* Consumer-start: business logic 
* Consumer-stop: selections, finance calculation, storage
* Presension of errors, errors' handling
* daemonization: forever js, monit script
*/
var amqp = require('../node_modules/amqp'); //rabbit mq
var config = require('../config');
var ConsumerStatic = require('./Consumer_static'); 
var REngError = require('./error.js');

/** Listener for RabbitMQ queues. 
* @class Consumer
* @constructor
* @param {string} type - which messages consumer works with: stop or start
* @return {} nothing
*
* @property {string} typeOfAcceptedMsg - the same as param 'type'
* @property {CouchDb} db - instance of database class
* @property {integer} REQUEUEAMOUNT - how many times invalid message will be put back
* @property {tryingToReadFromQueueAgain} - flag to define 
*     invalid message is under trying to be read again
* @property {amqp.connection} connection - connection with Rabbit MQ
* @property {amqp.exchange} exchange 
* @property {amqp.queue} queue - queue where messages are reading from
* @property {integer} reSendCounter - counter for putting message back 
*     onto the same queue
*/
var Consumer = function(type) {
    if (type !== 'stop' && type !== 'start') {
        var error = new REngError(null, 'Unknown type of messages');
        error.log();
        return;
    }
    this.typeOfAcceptedMsg = type;
    this.db  = require('../src/CouchDb.js').CouchDb.getInstanceOfCouchDb();
    this.REQUEUEAMOUNT = config.defaultConsumer.reQueueAmmount;
    this.connection = null;
    this.exchange = null;
    this.queue = null;
};

/** @method receiveMessage
* Listens and receives messages from queue 
* @return {} nothing
*/
Consumer.prototype.receiveMessage = function() {
    var self = this;
    var routingKey = 'call.' + self.typeOfAcceptedMsg; 
    var connection = amqp.createConnection(config.amqp.connection.options[0], 
                                     config.amqp.connection.options[1]);
    var queueName = config.amqp.queue.prefix + self.typeOfAcceptedMsg;
    
    connection.on ('ready', function () {
        console.log('Connection is ready');
        connection.queue(queueName, config.amqp.queue.options, function(queue) {
            self.connection = connection;
            self.queue = queue;
            queue.bind(config.amqp.exchange.name, routingKey);
            console.log('Start to listen...');
            console.log('...');
            var receiveFromQueue = self._receiveFromQueue();
            queue.subscribe({ack: true}, receiveFromQueue); 
        });
    });
};

/** @method _receiveFromQueue 
* @privat
* @callback Consumer~requestCallback for queue.subscribe
* @param {Consumer} consumer  - main instance
*
* @return {function} - closure with message's parameters
*    param {object} message: {payload: {...}}
* Invokes another method to process message has been received
*/
Consumer.prototype._receiveFromQueue = function () {
    self = this;
    return function(message, headers, deliveryInfo, ack) {
        console.log("Received " + deliveryInfo.routingKey + " message");
        console.log("call_id: " + message.payload.call_id);
        self.processMsg(deliveryInfo.routingKey, message, ack);
    }
};

/** @method processMsg
* Handles messages: process insertation or selection with CoachDb methods 
* Calls onCompletedProcess === setAcknowledge function when finished 
*
* @param {string} routingKey - type of messages are listened to
* @param {object} bodyOfMsg - body of message
* @param {object} ack - {object} ~ amqp.message.deliveryTag 
*      used to set acknowledge after message has been processed 
*
* errorResult === new {Error} if db.method returns error 
*/
Consumer.prototype.processMsg = function(routingKey, message, ack) {
    var self = this;
    var startDoc;
    var err;
    var onResult;
    
    switch (routingKey) {
        case 'call.start': {
            startDoc = ConsumerStatic.getStartDoc(routingKey, message.payload);
            onResult = self._onInsertResult(ack, routingKey, message); 
            self.db.insert(startDoc, onResult);
            break;
        }
        case 'call.stop': {
            function callSelectStartDoc() {    
                onResult =  self._onSelectResult(ack, routingKey, message);
                self.db.selectStartDoc(message.payload.call_id, onResult);
            }
            setTimeout(callSelectStartDoc, 400);
            break;
        }
        case 'rejected.call.stop':
        case 'rejected.call.start': 
        default: {
            var errorOptions = {code: 'IRTKY', 
                                invalid: 'routingKey', 
                                description: 'incorrect routing key specified', 
                                location: 'Consumer.processMsg'};
            var error = new REngError(errorOptions);
            error.log();
            break;
        }
    }
};

/** @method _setAcknowledge
* @privat
* 
* @param {object} ack - {object} ~ amqp.message.deliveryTag 
* @return {} nothing
*/
Consumer.prototype._setAcknowledge = function(ack) {
    ack.acknowledge();
    ConsumerStatic.logSubsidairyInfo('ack');
};

/** @method onPublish
* Provides closure with parameters 
* 
* @param {string} key - routingKey of message has been published
* @param {object} val - matching body of message
*
* @return {function} - error handler
*/
Consumer.prototype._onPublish = function(key, val, ack) {
    /** @callback ConsumerStatic~onPublish
    * This is callback for exchange.publish (if exchange is in confirm mode)
    * 
    * @param {boolean} isErrorOccured is the presense of an error. 
    * true means an error occured
    * false means the publish was successfull
    * @return {} nothing
    */
    var self = this;
    return function(isErrorOccured) {
        if (!isErrorOccured) {
            self._setAcknowledge(ack);
            return;
        }
        var strNotice = util.format('routingKey = %s, body = %s', 
                                     key, JSON.stringify(val));
        var optionsError = {code: 'MSNPUB', 
                            invalid: 'publish', 
                            description: 'message was not sent to queue', 
                            source: 'Consumer._onPublish',
                            notice: strNotice};
        var error = new REngError(optionsError);
        error.log();
    }
},

/**
*
* @param {string} routingKey - type of messages are listened to
* @param {object} bodyOfMsg - body of message
* @param {object} ack - {object} ~ amqp.message.deliveryTag 
*/
Consumer.prototype._processReQueue = function(ack, routingKey, message) {
    //TODO do not erase
    /*var attemptIndex = message.payload.retry.length;
    if (message.payload.retry[attemptIndex].attempt.counter < self.REQUEUEAMOUNT) {
        self.queue.shift(true, true);
        return;
    } */
    var self = this;
    var attemptAmmount = message.payload.retry.length;
        
    //console.log('_processReQueue routingKey: %s', routingKey);
    //console.log('_attemptAmmount', attemptAmmount);
    
    if (attemptAmmount === 1) {
        routingKey = 'retry.' + routingKey; 
        self._sendToRetry(ack, routingKey, message);
    } else if (attemptAmmount < self.REQUEUEAMOUNT) {
        self._resendToRetry(ack, routingKey, message);
    } else {
        var checkPrefix = routingKey.search('retry');
        if (checkPrefix < 0) {
            routingKey = 'retry.' + routingKey;
        }
        routingKey = routingKey.replace('retry', 'rejected');
        self._sendToRejected(ack, routingKey, message); 
    }
}
    
Consumer.prototype._sendToRetry = function (ack, routingKey, message) {
    var self = this;
    var exchangeName = config.amqp.exchange.name;
    var exchangeOptions = config.amqp.exchange.options;
    var queuePrefix = config.amqp.queue.prefix;
    var queueOptions = config.amqp.queue.options;
    var connection = self.connection;
    
    connection.exchange(exchangeName, exchangeOptions, function(exchange) { 
        //TODO error handling if requeued msg publishing failed
        var onPublish = self._onPublish(routingKey, message, ack);
        exchange.publish(routingKey, 
                         message, 
                         {},
                         onPublish);
    });

    connection.queue(queuePrefix + 'retry', queueOptions, function(queue) {   
        queue.bind(exchangeName, 'retry.call.*');
    });
}
//TODO implement functionalitys
Consumer.prototype._resendToRetry = function (ack, routingKey, message) {
    var self = this;
    var attemptIndex = message.payload.retry.length - 1;
    ConsumerStatic.addRetryAttempt(message, message.payload.retry[attemptIndex]);
    self._sendToRetry(ack, routingKey, message);
    ConsumerStatic.logSubsidairyInfo('back_queue');
    
    //self.connection.queue(queueName, queueOptions, function(queue) {   
        //queue.shift(true, true); can't use because message was changed
    //}); 
}

/** @method _sendToRejected
* @privat 
* @param {string} routingKey
* @param {object} message: object like {payload: {...}} 
* @param {object} ack - object used to set acknowledge
* @return {} nothing
*
* Moves rejected message onto special queue 
* New routingKey looks like "rejected.call.*" where * = stop|start 
*/
Consumer.prototype._sendToRejected = function(ack, routingKey, message) {
    var self = this;
    var exchangeName = config.amqp.exchange.name;
    var exchangeOptions = config.amqp.exchange.options;
    var queuePrefix = config.amqp.queue.prefix;
    var queueOptions = config.amqp.queue.options;
    var connection = self.connection;
    
    console.log ('_sendToRejected');
    connection.exchange(exchangeName, exchangeOptions, function(exchange) { 
        //TODO error handling if requeued msg publishing failed
        var onPublish = self._onPublish(routingKey, message, ack);
        exchange.publish(routingKey, 
                         message, 
                         {}, 
                         onPublish);
    });
    
    connection.queue(queuePrefix + 'rejected', queueOptions, function(queue) {   
        queue.bind(exchangeName, 'rejected.call.*');
    });
};

/** @method _onInsertResult - closes parameters for callback
* @privat
* 
* @param {object} ack - object used to set acknowledge
* @param {string} routingKey
* @param {object} message: object like {payload: {...}} 
*
* @returns {function} - callback 
*/
Consumer.prototype._onInsertResult = function(ack, routingKey, message) {
    /** @callback Consumer~_onInsertResult
    * Processes the result of insertation, used for CouchDb instance 
    * @param {object} insertResult - result of insert (if success) or null otherwise
    * @param {object} insertError - null (if success) or error object
    * @return {} nothing
    */
    self = this;
    return function(insertError, insertResult) {
        if (insertResult) {
            console.log(insertResult);
            self._setAcknowledge(ack);
        } else {
            //ConsumerStatic.logTheError(insertError);
            ConsumerStatic.addRetryAttempt(message, insertError);
            self._processReQueue(ack, routingKey, message);
        }
    }
};

/** @method _onSelectResult 
* @param {object} ack - object used to set acknowledge
* @param {string} routingKey
* @param {object} message: object like {payload: {...}} 
*
* @returns {function} - callback 
*/
Consumer.prototype._onSelectResult = function(ack, routingKey, message) {
    /** @callback Consumer~_onSelectResult 
    * Processes the result of selection, used for CouchDb instance
    * @param {object} selectError - new Error if selecting was failed
    * @param {object} selectResult - result of selection (if success) or null otherwise
    *        if no data found: selectResult === {call_id: ''} (empty string)
    * Processes validation to specify invalid parameters of messages. 
    * Later these invalid messages will be put onto another queue (rejected)
    */
    var self = this;
    return function(selectError, selectResult) {
        var validation;
        //no start message
        if (selectError) {
            //ConsumerStatic.logTheError(err);
            selectError.log();
            ConsumerStatic.addRetryAttempt(message, selectError);
            ConsumerStatic.logSubsidairyInfo('re_queue');
            self._processReQueue(ack, routingKey, message);
            return;
        }

        validation = ConsumerStatic.checkTimestamp(selectResult, message.payload); 

        if (validation) {
            ConsumerStatic.addRetryAttempt(message, validation);
            ConsumerStatic.logSubsidairyInfo('re_queue');
            self._processReQueue(ack, routingKey, message, validation);
        } else {
            var docCall = ConsumerStatic.createStartStopDoc(selectResult, message.payload);
            var onResult = self._onInsertResult(ack, routingKey, message);
            self.db.insert(docCall, onResult);
        }
    }
};

exports.Consumer = Consumer;