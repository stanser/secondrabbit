var gen = require('../node_modules/kwbl-gen');
var util = require('../node_modules/util');
var REngError = require('./error.js');

/** @class BrokerStaticPrivat
* Contains subsidiary methods
*/

var BrokerStaticPrivat = {
    
    /** Calculates ammount of Object properties 
    * @param {object} obj - properties of this one will be calculated
    * @return {integer} length - ammount of properties
    */
    getObjectLength: function(obj) {
        var length = 0;
        var key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) length++;
        }
        return length;
    },
    
    
   /** Validates integer arguments; 
    * @param {object} obj - properties of this object will be validated
    * @param {array} defaulValues - matching default values
    * Tries to convert arguments to Integer, if fails takes default value 
    *
    * If ammount of obj's properties and default values array have different length
    * incoming obj becomes null
    */
    validateIntegerArguments: function(obj, defaultValues) {
        console.log('Validation ...');
        if (BrokerStaticPrivat.getObjectLength(obj) != defaultValues.length) {
            console.log('defineIntArguments: Accepted parameters have different length');
            obj = null;
            return;
        }
        var value;
        for (var prop in obj) {
            if (defaultValues.length === 0) {
                return obj;
            }
            value = defaultValues.shift();
            obj[prop] =  parseInt(obj[prop]);
            if (isNaN(obj[prop])) {
                obj[prop] = value;
                console.log ("  '%s' will be set by default", prop);
            }
            if (obj[prop] < 0) {
                obj[prop] = obj[prop] * (-1);
                console.log ("  '%s' will be convert to positive", prop);
            }
            //obj[prop] = ! isNaN(obj[prop]) ? obj[prop] : value;
        }
    },
    
    /** This is callback for setInterval function
    * @callback BrokerStaticPrivat~requestCallback
    * 
    * For each countAtOnce of calls prepares the pairs of start and stop messages (oCall)
    * (countAtOnce = ammount of messages are sent per 1 iteration)
    * Invokes 'send' function to send them to exchange.
    *
    * Sends invalid messages (1 oCall) for each countAtOnce of messages. 
    *
    * Stop sending if general countTotal is reached
    * (all iterations by countAtOnce msgs has been sent)
    */
    setSendingProcess: function(broker) {
        var counterOfIterations = 0;
        var numberOfIterations = broker.countOfCorrect / broker.countAtOnce; 
        return function () {
            //repeats sending by iterations while general ammount isn't reached
            if (counterOfIterations < numberOfIterations) {
                BrokerStaticPrivat.sendInLoop(broker, broker.countAtOnce); 
                counterOfIterations++;
            } else {
                clearInterval(broker.intervalId);
                console.log('--------------');
                console.log('Finished');
                BrokerStaticPrivat.stopConnection(broker);
            }
         }                                                                  
    },
        
    /** Invokes function 'send' in loop depending on what type of msgs should be created.
    * Invokes function to  
    * @param {object} broker - main instance
    * @param {integer} value - upper limit of loop indexes ~ 
    * ~ ammount of calls should be emulated by one iteration 
    * @param {typeOfMsg}  
    *
    * If typeOfMsg isn't specified send correct messages
    * If typeOfMsg is invalid return
    */
    sendInLoop: function(broker, value, typeOfMsg){
        //console.log('sendInLoop');
        if (!typeOfMsg) {
            for (var i = 0; i < value; i++){ 
                var messages = broker.setCall();
                BrokerStaticPrivat.send(broker.exchange, messages);
            }
        } else if (typeOfMsg === 'undefined_start' || typeOfMsg === 'negative_duration') {
            for (var i = 0; i < value; i++) { 
                var messages = broker.createInvalidCall(typeOfMsg);
                BrokerStaticPrivat.send(broker.exchange, messages);
            }  
        }
        console.log ('%s message(s) have been sent', value);
        return;        
    },
    
    /** Emulates 1 call ~ sends messages (one pair: start and stop) to exchange
    * @param {object} message ~ {call.start||call.stop: {payload: {...}} 
    */
    send: function(exchange, messages) {
        try {
            for (var key in messages) {
                //console.log ("routing = " + key + ", call_id = " + messages[key].payload.call_id);
                exchange.publish(key, 
                                 messages[key],
                                 {},
                                 BrokerStaticPrivat.onPublish(key, messages[key]));
            }
        } catch (e) {
            BrokerStaticPrivat.logTheError(e);
        }
    },
    
    /** This is callback for exchange.publish (if exchange is in confirm mode)
    * @callback BrokerStaticPrivat~requestCallback
    * 
    * @param {string} key - routingKey of message has been published
    * @param {object} val - matching body of message
    *
    * @return {function} - error handler
    * param {bool} isErrorOccured is the presense of an error. 
    *    true means an error occured
    *    false means the publish was successfull
    */

    onPublish: function(key, val) {
        return function(isErrorOccured) {
            if (isErrorOccured) {
               var errMsg = "message was not sent: routingKey = '" + key + "', body = " + JSON.stringify(val);
                var error = {description: errMsg};
                BrokerStaticPrivat.logTheError(error);
            }
        }
    },
    
    /** Stops connection with Rabbit MQ
    * @param {object} broker - the main instance
    */
    stopConnection: function(broker) {
        console.log("Disconnected");
        broker.connection.disconnect();
    },
    
    /** Creates a routing key for messages
    * @param {string} type === 'start' || 'stop'
    * @returns {string} key - routing key like 'call.start' || 'call.stop' || ''
    */
    makeRoutingKeyOfMsg: function (type) {
        var key = "";
        switch (type){
            case 'start': {
                key = "call.start";
                break;
            }
            case 'stop': {
                key = "call.stop";
                break;
            }
            default: {
                BrokerStaticPrivat.logTheError ( {
                    description: 'Invalid routing key was specified',
                    });
                key = '';
                break;
            }
        }
        return key;
    },
    
    /** Creates a payload part of message (see RabbitMQ Tutorial)
    * @param {string} callId
    * @param optional {integer} duration - call duration
    */
    
    makePayloadOfMsg: function(callId, duration) {
        var shift = duration ? duration * 1000 : 0;
        return {
                payload: { 
                    call_id:  callId, 
                    timestamp: gen.couchTimeStamp(shift)
                }
            };
    },
    
    /** Logs the error to console
    * @param {object} value - string to be logged
    */
    
    logTheError: function(value) {
        if (util.isError(value)) {
            console.log(value.stack) ;
        }
        else { /** custom error*/
            console.log('ERROR:', value.description);
        }
    }
}

module.exports = BrokerStaticPrivat;      
