var gen = require('../node_modules/kwbl-gen'); 
var amqp = require('../node_modules/amqp'); //rabbit mq
var connection = amqp.createConnection({host: '10-60-8-149-pure.kwebbl.dev'},
                                       {reconnect: false}
                                       ); 

/* constructor for Broker
* var countOfMsg -- general amount of messages have to be sent
* var portionOfMsg - how many messages have to be sent during 1 iteration (shold be even /2)
* var arrOfMsg - array of messages have to be sent
* var reminder: count/portion = reminder
*/

function Broker(countOfMsg, portionOfMsg) {
    
    //------portionOfMsg should be even number. Esle - decrease by 1.
    if (countOfMsg && portionOfMsg) {
        if (portionOfMsg%2) {
            portionOfMsg--;
        }
        var diff = countOfMsg%portionOfMsg;
        this.reminder = diff;
    }
    else {
        this.reminder = 0;
    }
    this.countOfMsg = countOfMsg || 10;
    this.portionOfMsg = portionOfMsg || 2;
    
    //------unused
    this.arrOfMsg = [];
}

// return type (start, stop or error)
Broker.prototype.checkTypeOfMsg = function(flag) {
    var type;
    if (flag == 'start' || flag == 'stop') {
        type = flag;
    } else {
        this.catchTheError ("Broker.checkTypeOfMsg(): Incorrect param for creating msg. Should be 'start', 'stop' or nothing for both");
        type = 'error';
    }
    return type;
};

//return true
Broker.prototype.catchTheError = function(value) {
    console.log(value);
    return true;
};

//prepare an array [routingKey, playload] for one message (start or stop)
/* Return array msg:
* msg[0] is 'call.start' or 'call.stop'
* msg[1] is object {playload: {call_id:  callId, 
                                 timestamp: {}
                                }
                      }
*
*/
Broker.prototype.makeMsg = function (flag) {
    var msg = [];
    var callId = gen.uuid();
    var type = this.checkTypeOfMsg(flag);
    switch (type){
        case 'start': {
            msg[0] = "call.start";
            break;
        }
        case 'stop': {
            msg[0] = "call.stop";
            break;
        }
        case 'error':    
        default: {
            this.catchTheError ("Broker.makeMsg(): Incorrect parametr for message. Should be 'start' || 'stop'");
        }
    }
    msg[1] = {playload: { 
                call_id:  callId, 
                timestamp: {}
                }
             }
    return msg;
}

//prepare the whole pair of messages for sending (incl. start and stop keys). 
//Set timestamps
/* pairMsg[0] = ['call.start', {playload: {...}}]
   pairMsg[1] = ['call.stop', {playload: {...}}]
*
* pairMsg.length = 2;
*
* pairMsg[0] and pairMsg[1] have different timestamp. Random duration defines interval between timestamps
*/
Broker.prototype.setPairOfMsg = function () {
    var pairMsg = [];
    var duration = {};
    pairMsg[0] = this.makeMsg('start');
    pairMsg[0][1]["playload"]["timestamp"] = gen.couchTimeStamp();
    
    pairMsg[1] = this.makeMsg('stop');
    duration = gen.duration();
    pairMsg[1][1]["playload"]["timestamp"] = gen.couchTimeStamp(duration*1000);
    return pairMsg;
}

/*
* send messages to Exchange    
*/
Broker.prototype.sendMsg = function () {
    
    var self = this;  
    var intervalId; 
    var numberOfIterations = (this.countOfMsg-this.reminder)/this.portionOfMsg; // how many iterations are needed
    var counterOfIterations = 0; //
    
    /* function interval(send)
    *
    * set intervals for sending messages
    * parameter: function's names 'send' and 'stopConnection' 
    */
    
    var intervalSending = function (send, stopConnection) {
        console.log ('Sending ' + self.countOfMsg + ' messages. ' + self.portionOfMsg + ' per one iteration');
        var intervalId = setInterval (callToSend(), 100);

        /* function callToSend(counter) ---> callback for setInterval
        * 
        * for each portion of messages prepare the pairs of start and stop messages (pairOfMsg)
        * (portion = ammount of messages are sending per 1 iteration)
        *
        * and call 'send' function to send them to exchange.
        *
        * Stop sending if general countOfMsg is reached
        * (all portions has been sent)
        */
        function callToSend() {
            //console.log('callToSend');
            
            //just call function 'send' in loop
            var sendingLoop = function(value){
                for (var i=0; i<value; i++){
                    var message = self.setPairOfMsg();
                    send(message);
                 }
            }
            return function () {
                //repeat sending by iterations while general ammount of iterations isn't reached
                if (counterOfIterations < numberOfIterations) {
                    sendingLoop (self.portionOfMsg/2); // portionOfMsg() return 2 messages
                    console.log (counterOfIterations + 1 + ') ' + self.portionOfMsg + ' messages have been sent');
                    
                    counterOfIterations++;
                }
                // if general ammount of iterations is reached check for reminder
                else {
                    if (self.reminder) {
                        
                        var isReminderNotEven = self.reminder%2 ? true : false; //is the reminder even?
                        
                        if (isReminderNotEven) {
                            sendingLoop (self.reminder/2-1);
                            var lastMessage = [];
                            lastMessage.push(self.setPairOfMsg()[0]);
                            //console.log(lastMessage);
                            send(lastMessage);
                        }
                        else {
                            sendingLoop (self.reminder/2);
                        }
                        
                        console.log (counterOfIterations + 1 + ') ' + self.reminder + ' messages have been sent');
                    }
                    clearInterval(intervalId);
                    console.log ('Finished');
                    stopConnection();
                    return true;
                }
                //counterOfIterations++;
             }                                                                  
        }
    }                                      
    
    connection.on ('ready', function () {                                                                                                                  
        console.log('connection.on is ready');
        //to set messages
        connection.exchange('test_stud', {autoDelete: false}, function(exchange) {   
            //sending to exchange pair of messages (start and stop)
            console.log('connection.exchange');
            
            /* Sends 2 messages (one pair with start and stop) to exchange directly
            *
            * accept an array[]['call.*', {playload: {...}} as parameter
            *
            */
            var send = function (messages) {
                for (var i=0; i<messages.length; i++) {
                    var msg = messages[i];
                    var f = exchange.publish(msg[0], msg[1]);
                    //console.log("send a message with routing key '" + msg[0] + "' and body '" + msg[1] + "'");
                }
                
            }
            
            /* Stop connection with rabbit
            *
            */
            var stopConnection = function () {
                console.log("disconnecting");
                //exchange.destroy(true);
                connection.disconnect();
                return true;
            }
            
            intervalSending(send, stopConnection);
            return;
            
            
        });
      return;
    });
    //connection.on ('end', function () {console.log ('connection.on.end')});
}

//console.log (connection);

exports.Broker = Broker;      

var broc = new Broker(2, 2);

broc.sendMsg();