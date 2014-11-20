var gen = require('../node_modules/kwbl-gen'); 
var amqp = require('../node_modules/amqp'); //rabbit mq

/* constructor for Consumer
 * var arrOfMsg - array of messages have to be receive
 */

var Consumer = function () {
    this.arrOfMsg = []; 
    this.db  = require ('../src/CouchDb.js').CouchDb.getInstanceOfCouchDb();
}


/* Creates new doc from single message and adds it to Coach DB
 *
 * @param string routingKey, body object
 *
 * return true if success
 */
Consumer.prototype.createDocAndAddToCouch = function (routingKey, body) {
    //create object for inserting
    var newDoc = {
        call_type: routingKey,
        call_id: body.call_id,    
        timestamp: body.timestamp, 
        created: gen.couchTimeStamp(),
        modified: gen.couchTimeStamp()
    }
    //console.log (newDoc);
    //console.log (this.db);
    
    //inserting
    var insertResult = this.db.insert(newDoc);
    setTimeout ( function () { console.log ('insertResult'); 
                              console.log (insertResult);
                             }, 0);
    
    if (insertResult && insertResult.ok) {
        return true;
    }
    else {
        //this.logTheError ("Errors during couch insering. Message wasn't stored");
        return false;
    }
}

/* Listen and receive messages from queue
 * Call another method to process every message
 */

Consumer.prototype.receiveAndProcessMsg = function () {
    var self = this;
    
    var conn = amqp.createConnection({host: '10-60-8-149-pure.kwebbl.dev'},
                                           {reconnect: false}
                                           );
    conn.on ('ready', function () {
        console.log('connection.on is ready');
    
        conn.queue('test_stud_queue1', {autoDelete: false}, function(queue){
            queue.bind('test_stud', 'call.*');
            console.log ('Start to reading...');
            
            // function receiveFromQueue() is callback for queue.subscribe
            var receiveFromQueue = function (message, headers, deliveryInfo, ack) {
                try {
                    console.log("Have got a message. RoutingKey: '" + deliveryInfo.routingKey + "' call_id: '" + message.playload.call_id + "'");
                    //self.setArrOfMsg({
                    //  routingKey:   deliveryInfo.routingKey,
                    //  message: message.playload
                    //});
                    
                    //call the function to process message
                    self.createDocAndAddToCouch(deliveryInfo.routingKey, message.playload);
                }
                catch (e){
                    console.log(e); 
                }
            }  
            
            queue.subscribe(receiveFromQueue); 

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
