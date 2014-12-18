var gen = require('../node_modules/kwbl-gen');
var amqp = require('../node_modules/amqp'); //rabbit mq
var BrokerStaticPrivat = require('./Broker_static_privat');
var config = require('../config');
var REngError = require('./error.js');

/** Broker
* @constructor
* 
* @param {object} options - includes parameters as following:
*
*    {integer} options.total - General ammount of calls have to be emulated
*        1 call includes 2 messages: 1 start and 1 stop
*    {integer} options.once - how many calls have to be emulated during 1 iteration
*    {integer} options.startLess - how many calls should be without start
*    {integer} options.negativeDuration - how many calls should have negativ duration
*    {integer} options.interval - in ms, interval for sending
*
* Invokes function to validate incoming parameters. 
* Defines default values.
*/
function Broker(options) {
    options = options ? options: BrokerStaticPrivat.getEmptyOptionsObject();
    
    var defaultValues = config.defaultBroker.values;
    BrokerStaticPrivat.validateIntegerArguments(options, defaultValues);
    
    var countOfInvalid = options.startLess + options.negativeDuration;
    
    var descriptionError;
    if (countOfInvalid > options.total) {
        descriptionError = 'total ammount (-t) is less than invalid calls (-s + -n)';
    } else if (options.once > options.total) {
        descriptionError = 'Total ammount (-t) is less than ammount for 1 portion (-o)'; 
    }
    if (descriptionError) {
        var optionsError;
        var error;
        optionsError = {
            code: 'BRINP', 
            invalid: 'input', 
            description: descriptionError, 
            location: 'Broker@constructor'
        };
        error = new REngError(optionsError);
        error.log('nostack');
        return;
    }
    this.countTotal = options.total;
    this.countAtOnce = options.once;
    this.countOfStartLess = options.startLess;
    this.countOfNegativeDuration = options.negativeDuration;
    this.interval = options.interval;

    //to simplify sending by portion
    countOfCorrect = this.countTotal - countOfInvalid;
    var reminder = countOfCorrect % this.countAtOnce;
    var difference = 0;
    if (reminder) {
        difference = this.countAtOnce - reminder;
        console.log ('  Total ammount of calls will increased by', difference);
    }
    
    this.countTotal = this.countTotal + difference;
    this.countOfCorrect = countOfCorrect + difference;
}


/** Prepares the pair of messages which emulates the Call 
* oCall = {call.*: {payload: {...}}} where * is 'start' or 'stop'
*
* oCall['call.start'] and oCall['call.stop'] have different timestamp. 
* Random duration defines interval between timestamps
*
* @returns {object} as described above
*/
Broker.prototype.setCall = function() {
    var oCall = {};
    var callId = gen.uuid();
    var duration =  gen.duration();

    var start_key = BrokerStaticPrivat.makeRoutingKeyOfMsg('start');
    oCall[start_key] = BrokerStaticPrivat.makePayloadOfMsg(callId);
    
    var stop_key = BrokerStaticPrivat.makeRoutingKeyOfMsg('stop');
    oCall[stop_key] = BrokerStaticPrivat.makePayloadOfMsg(callId, duration);
    
    return oCall;
}

/** Creates invalid messages inside call. 
* @param {string} mistake - 'negative_duration' || 'undefined_start' 
* Message is invalid if  
*   start.timestamp > stop.timestamp 
*   start = undefined (is absent: no specific call_id in database)
*
* Only start messages may be invalid. 
*
* @returns {object} oCall - pair of invalid messages (start and stop) 
* Returns null if wrong mistake was specified
*/
Broker.prototype.createInvalidCall = function(mistake) {
    var oCall = this.setCall();

    switch (mistake) {
        case 'negative_duration': {
            //makes duration negative: just adds to stop.timestamp some value (2000 ms)
            var stopDate = new Date(oCall['call.stop'].payload.timestamp.t);
            oCall['call.start'].payload.timestamp = gen.couchTimeStamp(stopDate, 2000); 
            break;
        }
        case 'undefined_start': {
            //changes call_id of start message
            oCall['call.start'].payload.call_id = 'undefined_call_id_' + gen.random(1000); 
            break;
        }
        default: {
            console.log ('unknown_mistake');
            return null;
        }
    }
    return oCall;
}

/** Establishes connection to Exchange   
* Invokes sending of messages.
*
* First of all sends invalid messages, then sends correct
*/
Broker.prototype.sendMsg = function() {
    var self = this;  
    connection = amqp.createConnection(config.amqp.connection.options[0], 
                                       config.amqp.connection.options[1]);

    connection.on ('ready', function () {
        console.log('connection is ready');
        console.log('--------------');
        connection.exchange(config.amqp.exchange.name, 
                            config.amqp.exchange.options,
                            function(exchange) {
            self.connection = connection;
            self.exchange = exchange;
            
            if (self.countOfStartLess) {
                console.log ('Sending calls without start...');
                BrokerStaticPrivat.sendInLoop (self, 
                                               self.countOfStartLess, 
                                               'undefined_start');
                console.log ('---');
            }
            if (self.countOfNegativeDuration) {
                console.log ('Sending calls with negative duration...');
                BrokerStaticPrivat.sendInLoop (self, 
                                               self.countOfNegativeDuration,
                                               'negative_duration');
                console.log ('---');
            }
            console.log ('Sending usual calls:');
            self.intervalId = setInterval (BrokerStaticPrivat.setSendingProcess(self),
                                           self.interval);
        });
    });
}

exports.Broker = Broker;     