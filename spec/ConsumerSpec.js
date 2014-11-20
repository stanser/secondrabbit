var jas = require ('../node_modules/jasmine-node');
var ConsumerObj = require('../src/Consumer.js');

describe("Consumer", function() {
    beforeEach(function() {
        consumer = new ConsumerObj.Consumer();
        }); 
        
        it ("has db property", function () {
            expect(consumer.hasOwnProperty('db')).toBe(true);
        });
    
        it ("db property is object", function () {
            expect(consumer).toEqual(jasmine.any(Object));   
        });
    
        it ("createDocAndAddToCouch property", function () {
        expect(consumer.hasOwnProperty('createDocAndAddToCouch')).toBe(true);
        });
        
        /*it("", function() {
            spyOn(consumer, 'makeMsg').andCallThrough();
            var msg = consumer.makeMsg('start');
            var obj = msg[1].playload;
            var obj2 = {call_id:  'callId', timestamp: {}};
           
            expect(msg[0]).toBe('call.start');
            for (var prop in obj2) {
                expect(obj.hasOwnProperty(prop)).toBe(true);
            }
        });*/
        
    
 

})