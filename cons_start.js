var ConsumerSrc = require('./src/Consumer.js');
var cons_start = new ConsumerSrc.Consumer('start');
//cons_start.processMsg('call.start', 'test');
cons_start.receiveMessage('start');


/*var REngError = require('./src/error.js');
var err = new REngError('ICI', 
                         'call_id', 
                         'call_id not found in database', 
                         'CouchDb.selectStartDoc');
err.log();*/
