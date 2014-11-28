var gen = require('../node_modules/kwbl-gen'); 
var amqp = require('../node_modules/amqp'); //rabbit mq
var util = require('../node_modules/util');

/* constructor for Consumer
 * @param type - which messages consumer works with: stop or start
 */

var Consumer = function (type) {
    //this.arrOfMsg = []; 
    this.db  = require ('../src/CouchDb.js').CouchDb.getInstanceOfCouchDb();
    this.typeOfAcceptedMsg = (type && (type == 'stop' || type == 'start')) ? type : 'both';
    this.REQUEUEAMOUNT = 2; //how many times message may be put back onto the same queue
    this.tryingToReadFromQueueAgain = false;
}


/* Creates new doc from single message and adds it to Coach DB
 * Calls setAcknowledge function if success 
 *
 * @param string routingKey, object bodyOfMsg, callSetAcknowlegeFunc - callback
 *
 */
Consumer.prototype.createDocAndAddToCouch = function (routingKey, bodyOfMsg, callSetAcknowledgeFunc) {

    var self = this;
    var startDoc;
    var resultOfQuery;
    
   /* This INSERT function is callback and called from CouchDb obj.
    *
    * @param isInsertSuccess = true if inserting is successful
    * @param insertResultObj = <object> returned from DB if insert is successful or <object> Error otherwise
    */
    function getInsertResult(isInsertSuccess, insertResultObj) {
        if (isInsertSuccess) {
            console.log (insertResultObj);
            callSetAcknowledgeFunc(true);
        }
        else {
            self.logTheError (insertResultObj);// selectResultObj includes an Error object
            callSetAcknowledgeFunc(false);
        }
    }
    
   /* This SELECT function is callback and called from CouchDb obj.
    *
    * @param isSelecttSuccess = true if selecting is successful
    * @param selectResultObj = obj returned from DB if select is successful (newStartStopDoc)
    * @stopMsg = obj regarded to selected newStartStopDoc (stopMsg and newStartStopDoc has the same call_id)
    */
    function getSelectResult(isSelectSuccess, selectResultObj, stopMsg) {
        if (isSelectSuccess) {
            //update doc with new fields
            self.db.insert(createStartStopDoc(selectResultObj, stopMsg), getInsertResult);
        }
        else if (selectResultObj.hasOwnProperty('call_id')) {
            var customError = { error: "NoDataFound",
                            description: "No start doc found", 
                            source: "Consumer.createDocAndAddToCouch.getSelectResult", //where error 
                            invokedLineNumber: 64,
                            mayBeSolved: ''}
            self.logTheError (customError);
            callSetAcknowledgeFunc(false);
            }
            else {
                self.logTheError (selectResultObj);// selectResultObj includes an Error object
            }
    }
    
   /* Merges start doc with stop info from stop message
    * Creates new doc (object) for DB updating
    * Calculates call duration
    *
    * @param startDocObj - the doc from Couch with start msg information
    * @param stopMsg - stop msg received from Rabbit
    */
    
    function createStartStopDoc (startDocObj, stopMsg) {
        var newStartStopDoc = startDocObj;
            
        var duration = stopMsg.timestamp.t - startDocObj.timestamp.t;
        newStartStopDoc.start = startDocObj.timestamp;
        newStartStopDoc.stop = stopMsg.timestamp;
        
        newStartStopDoc.call_type = 'call.start.stop';
        newStartStopDoc.duration = duration;
        newStartStopDoc.modified = gen.couchTimeStamp();    
        
        delete (newStartStopDoc.timestamp);
        
        return newStartStopDoc;
     }
    
    //method's body begins...

    if (!routingKey) {
        getInsertResult (false, {});
        return;
    }
    
    switch (routingKey) {
        case 'call.start': {
            //create object for inserting
            startDoc = {
                call_type: routingKey,
                call_id: bodyOfMsg.call_id,    
                timestamp: bodyOfMsg.timestamp, 
                created: gen.couchTimeStamp()
            }
            //inserting
            resultOfQuery = self.db.insert(startDoc, getInsertResult);
            if (resultOfQuery) self.logTheError (resultOfQuery);
            break;
        }
        case 'call.stop': {
            /** select doc with the same call_id
             * Should add closure to prevent context's lost */
            function callSelectStartDoc () {            
                resultOfQuery = self.db.selectStartDoc(bodyOfMsg, getSelectResult);
                if (resultOfQuery) self.logTheError (resultOfQuery);
            }
            setTimeout(callSelectStartDoc, 500);
            break;
        }
        /*case 'call.both':{
            //console.log('case call.both');
            self.logTheError('createDocAndAddToCouch(): type of message is not defined');
            break;
        }
        default: {
            self.logTheError('createDocAndAddToCouch(): type of message is incorrect or not defined');
            break;
        }*/
    }
    //return;
}

/* Listens and receives messages from queue
 * Calls another method to process every message
 * 
 */

Consumer.prototype.receiveAndProcessMsg = function () {
    var self = this;
    var reSendToQueueCounter = 0;

    /** if correct type wasn't defined.... */
    if (self.typeOfAcceptedMsg == 'both') {
        self.logTheError( { error: "TypeError",
                            description: "Type of accepted messages is not defined", 
                            source: "Consumer.receiveAndProcessMsg", //where error 
                            invokedLineNumber: 141,
                            mayBeSolved: 'Consumer.constructor'});
        return;
    }
        
    var msgType = 'call.' + self.typeOfAcceptedMsg; 
    var conn = amqp.createConnection({host: '10-60-8-149-pure.kwebbl.dev'},
                                       {reconnect: false}
                                       );
    var queueName = 'test_stud_queue_' + self.typeOfAcceptedMsg;
    conn.on ('ready', function () {
        console.log('Connection is ready for reading');
            conn.queue( queueName, {autoDelete: false}, function(queue){
                try {
                    queue.bind('test_stud', msgType);
                    console.log ('Start to listen...');
                    queue.subscribe({ack: true}, receiveFromQueue); 

                    //receiveFromQueue() is callback for queue.subscribe
                    var receiveFromQueue = function (message, headers, deliveryInfo, ack) {

                        /** Function definition setAcknowlege ()
                         * Callback, sets acknowledge for RabbitMQ
                         * Is called from this.createDocAndAddToCouch()
                         *
                         * @param isProcessMsgSuccess - bool, defines if acknowledge should be sent to Rabbit
                         */
                        function setAcknowlege (isProcessMsgSuccess) {
                            if (isProcessMsgSuccess ) { /** if processing of message was successful */
                                ack.acknowledge();
                                console.log ('Acknowledge has been set');
                                console.log ('------------------------');
                            }
                            else { /** else: try to resend to the same queue some times*/
                                if (reSendToQueueCounter < self.REQUEUEAMOUNT) {
                                    queue.shift(true, true);
                                    reSendToQueueCounter++;
                                    console.log ('Message was put back onto queue');
                                    console.log ('------------------------');
                                    self.tryingToReadFromQueueAgain = true; /** is true when msg is putting back*/
                                }
                                else { /** then send rejected message to another queue */
                                    console.log ('Message has been rejected. Will send to another queue');
                                    self.tryingToReadFromQueueAgain = false; /** is false when msg is sending to another queue*/
                                    processReQueue();
                                }
                            }
                        }
                        
                        /**  Function definition processReQueue().
                        * Moves rejected message onto special queue "test_stud_queue_rejected"
                        * New routin key looks like "rejected.call.*" where * = stop||start 
                        */
                        
                        function processReQueue() {
                            conn.exchange('test_stud', {autoDelete: false}, function(exchange) { 
                                conn.queue('test_stud_queue_rejected', {autoDelete: false}, function(queue){   
                                    var rejectedMsgType = 'rejected.'+ deliveryInfo.routingKey;
                                    queue.bind('test_stud', 'rejected.call.*');
                                    
                                    console.log('rejectedMsgType: ' + rejectedMsgType );
                                    exchange.publish(rejectedMsgType, message);
                                    
                                    setAcknowlege(true);
                                });
                            });
                        }
                        console.log("Have got a " + msgType + " message:");
                        console.log(message);
                        
                        //call the function to process message                
                        self.createDocAndAddToCouch(msgType, message.playload, setAcknowlege);
                    }  
                }
                catch (e) {
                    self.logTheError (e);
                }
            });
        });
}

/*
*
*
*
*/
Consumer.prototype.validateCallProperties = function (doc){
    var issuesOfCall = [];
    
   { call_type: '',
   call_id: '',
   created: { t: 0 },
   start: { t: 0 },
   stop:  { t: 0 },
   duration: 0
   }
    if (!doc.hasOwnProperty('call_type')) {
        issuesOfCall.push
    }
}

/* 
* Logs the error
*
*/
Consumer.prototype.logTheError = function(value) {
    if (this.tryingToReadFromQueueAgain) return; /** don't log error if putting back onto queue repeats */
    
    if (util.isError(value)) {
        console.log(util.inspect (value)) ;
    }
    else { /** custom error*/
        console.log('ERROR: ' + value.description);
        console.log('Was invoked in ' + value.source + ' :: ' + value.invokedLineNumber);
        if (value.mayBeSolved) console.log('Ma be solved in ' + value.mayBeSolved);
    }
    return;
}

exports.Consumer = Consumer;   
