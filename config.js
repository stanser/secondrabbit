/* Default values for Broker instance.
*
* Array of 5 elements:
* arr[0] = {integer} total - General ammount of calls have to be emulated
*        1 call includes 2 messages: 1 start and 1 stop
* arr[1] = {integer} once - how many calls have to be emulated during 1 iteration
* arr[2] = {integer} startLess - how many calls should be without start
* arr[3] = {integer} negativeDuration - how many calls should have negativ duration
* arr[4] = {integer} interval - in ms, interval for sending
*/
var defaultBroker = {
    values: [12, 4, 0, 0, 100]
};

var amqp = { 
    connection: { 
        options: [
            {host: '10-60-8-149-pure.kwebbl.dev'}, //options object
            {reconnect: false} //custom options object
        ]
    },
    exchange: {
        name: 'test_stud',
        options: {
            autoDelete: false, 
            confirm: true
        } 
    },
    queue: {
        prefix: 'test_stud_queue_',
        options: {
            autoDelete: false
        }
    }    
};

var db = {
    url: 'http://couchdb-ha.kwebbl.dev:5984',
    name: 'test_a_studenyak'
};

var defaultConsumer = {
    reQueueAmmount: 2
};
    
var config = {
    defaultBroker: defaultBroker,
    defaultConsumer: defaultConsumer,
    amqp: amqp,
    db: db
}

module.exports = config;