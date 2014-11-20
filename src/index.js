//var BrokerObj = require('../src/Broker.js');
//var broc = new BrokerObj.Broker(200, 30);
//broc.sendMsg();

var ConsumerObj = require ('../src/Consumer.js');
var cons = new ConsumerObj.Consumer();

cons.receiveAndProcessMsg();

//var CouchDb = require ('../src/CouchDb.js').CouchDb.getInstanceOfCouchDb();

//console.log (CouchDb.getDbRef());

//var db = CouchDb.getInstanceOfCouchDb();

//CouchDb.publicMethodShowThis();



