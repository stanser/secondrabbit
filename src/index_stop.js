var ConsumerObj = require ('../src/Consumer.js');
var cons_stop = new ConsumerObj.Consumer('stop');
cons_stop.receiveAndProcessMsg();