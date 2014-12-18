var util = require('../node_modules/util');
var gen = require('../node_modules/kwbl-gen'); 
var REngError = require('./error.js');
/** @class ConsumerStatic
* @constructor
*
* Contains static method for Consumer
*/
var ConsumerStatic = {
    
    /** @method logAckInfo
    * @param {boolean} isAckTrue - defines if acknowledge should be set
    * @static
    * @returns {} nothing
    */
    logSubsidairyInfo: function(tag) {
        switch (tag) {
            case 'ack': console.log('Acknowledge has been set'); break;
            case 're_queue': console.log('Message will be moved to another queue'); break;
            case 'back_queue': console.log('Message has been put back into queue'); break;   
            default: console.log(tag);
         }
         console.log ('-------------');
    },
    
    /** @method getStartDoc
    * @static
    * Generates doc for Couch DB
    * @param {string} routingKey
    * @param {object} bodyOfMsg ~ message.payload
    * @return {object} startDoc - information about start of call
    */
    getStartDoc: function(routingKey, bodyOfMsg) {
        var startDoc = {
            call_type: routingKey,
            call_id: bodyOfMsg.call_id,    
            timestamp: bodyOfMsg.timestamp, 
            created: gen.couchTimeStamp()
        }
        //console.log(startDoc);
        return startDoc;
    },
    
    /** @method addRetryFields
    * @static
    * Adds to rabbit message new fields in case the message will put to retry queueu
    * @param {object} message - message received from Rabbit
    * @param {object} fieldSource - object contains the reason of resending message 
    */
    addRetryAttempt: function(message, fieldSource) {
        if (!message.payload.hasOwnProperty('retry')) {
            message.payload.retry = [];
        }
        var attempt = {
            date: new Date(),
            invalid: fieldSource.invalid,
            description: fieldSource.description
        }
        message.payload.retry.push(attempt);
    },
    
     /** @method checkTimestamp
    * Validates start message's timestamp property
    * @param {object} docStart - start message from db
    * @param {object} msgStop - stop message from Rabbit mq
    *
    * @return {object} validation if some issues exists or null otherwise
    *
    * validation.invalid === 'timestamp' if timstamp is missing
    * validation.invalid === 'duration' if duration is negative
    */
    checkTimestamp: function(docStart, msgStop) {
        var error;
        var optionError;

        // No timestamp property
        if (!docStart.hasOwnProperty('timestamp')) { 
            optionsError = {code: 'ITMSMP', 
                            invalid: 'timestamp', 
                            description: 'timestamp property is missed', 
                            location: 'ConsumerStatic.checkTimestamp'};
        } else if (!docStart.timestamp.hasOwnProperty('t')) { 
            // No timestamp.t property
            optionsError = {code: 'ITMSMP', 
                            invalid: 'timestamp.t', 
                            description: 'timestamp.t property is missed', 
                            location: 'ConsumerStatic.checkTimestamp'};
        } else { 
            // timestamp.t exists. checks duration 
            var duration = msgStop.timestamp.t - docStart.timestamp.t;
            if (duration < 0) { 
                optionsError = {code: 'IDUR', 
                                invalid: 'duration', 
                                description: 'duration is negative', 
                                location: 'ConsumerStatic.checkTimestamp'};
            } else {
                //timestamp & duration are correct
                return null;
            }
        }
        error = new REngError(optionsError);
        error.log();
        return error;
    },
    
    /** @method createStartStopDoc
    * Merges start doc with stop information from stop-message
    * Creates new doc {object} for COuchDb updating
    * Calculates call's duration
    *
    * @param {object} startDocObj - the doc from Couch with start msg information
    * @param {object} stopMsg - stop msg received from Rabbit
    *
    * @return {object} newStartStopDoc - merged doc for whole call
    */
    createStartStopDoc: function(startDocObj, stopMsg) {
        var newStartStopDoc = startDocObj;
            
        var duration = stopMsg.timestamp.t - startDocObj.timestamp.t;
        newStartStopDoc.start = startDocObj.timestamp;
        newStartStopDoc.stop = stopMsg.timestamp;
        
        newStartStopDoc.call_type = 'call.start.stop';
        newStartStopDoc.duration = duration;
        newStartStopDoc.modified = gen.couchTimeStamp();    
        
        delete (newStartStopDoc.timestamp);
        
        return newStartStopDoc;
     }, 
    
    
}

module.exports = ConsumerStatic;  