var gen = require('../node_modules/kwbl-gen'); 
var amqp = require('../node_modules/amqp'); //rabbit mq

/* constructor for Consumer
 * var arrOfMsg - array of messages have to be receive
 */

var Consumer = function () {
    //this.arrOfMsg = []; 
    this.db  = require ('../src/CouchDb.js').CouchDb.getInstanceOfCouchDb();
}


/* Creates new doc from single message and adds it to Coach DB
 * Calls setAcknowledge function if success 
 *
 * @param string routingKey, object body, callSetAcknowlegeFunc - callback
 *
 */
Consumer.prototype.createDocAndAddToCouch = function (routingKey, body, callSetAcknowledgeFunc) {
    //create object for inserting
    var newDoc = {
        call_type: routingKey,
        call_id: body.call_id,    
        timestamp: body.timestamp, 
        created: gen.couchTimeStamp(),
        modified: gen.couchTimeStamp()
    }
    
   /*This function is callback and called from CouchDb obj.
    *
    * @param isInsertSuccess = true if inserting is successful
    * @param insertResultObj = obj returned from DB if insert is successful
    */
    function getInsertResult(isInsertSuccess, insertResultObj) {
        if (isInsertSuccess) {
            console.log("RoutingKey: '" + routingKey + "', call_id: '" + body.call_id + "'");
            console.log (insertResultObj);
            callSetAcknowledgeFunc();
        }
        else {
            this.logTheError ('createDocAndAddToCouch(): Inserting fails ');
        }
    }
    
    //inserting
    this.db.insert(newDoc, getInsertResult);
    
}

/* Listens and receives messages from queue
 * Calls another method to process every message
 */

Consumer.prototype.receiveAndProcessMsg = function () {
    var self = this;
    
    var conn = amqp.createConnection({host: '10-60-8-149-pure.kwebbl.dev'},
                                           {reconnect: false}
                                           );
    conn.on ('ready', function () {
        console.log('Connection is ready for reading');
    
        conn.queue('test_stud_queue1', {autoDelete: false}, function(queue){
            queue.bind('test_stud', 'call.*');
            console.log ('Start to listen...');
            
            //function receiveFromQueue() is callback for queue.subscribe
            //Declare function setAcknowlege() acknowledge
            var receiveFromQueue = function (message, headers, deliveryInfo, ack) {
                
                /* callback, set acknowledge for RabbitMQ
                 * is called from this.createDocAndAddToCouch()
                 */
                function setAcknowlege () {
                    ack.acknowledge();
                    console.log ('Acknowledge has been set');
                    console.log ('------------------------');
                }
                
                console.log("Have got a message");
                    
                //call the function to process message
                self.createDocAndAddToCouch(deliveryInfo.routingKey, message.playload, setAcknowlege);
            }  
            
            queue.subscribe({ack: true}, receiveFromQueue); 
        });
    });
}


//Consumer.prototype.setArrOfMsg  = function (elem){
//        this.arrOfMsg.push(elem);
//        return;
//    }

//return true
Consumer.prototype.logTheError = function(value) {
    console.log(value);
    return true;
}

exports.Consumer = Consumer;   
