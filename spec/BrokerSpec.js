var jas = require ('../node_modules/jasmine-node');

//------------
//node_modules/jasmine-node/bin/jasmine-node ---> node-jasmine module's location
//------------

var BrokerObj = require('../src/Broker.js');


//Create a test object, an instance of Broker
//var broker = new BrokerObj.Broker(100, 10);
  
describe("Broker", function() {
    beforeEach(function() {
        broker = new BrokerObj.Broker();
    });           
    
    it ("should be an Object", function () {
        expect(broker).toEqual(jasmine.any(Object));   
    });
    
    it("should have defined countOfMsg and portionOfMsg (custom or default)", function() {
        expect(broker.countOfMsg).toEqual(jasmine.any(Number));
        expect(broker.portionOfMsg).toEqual(jasmine.any(Number));
    });
    
    it("should have countOfMsg = 10 and portionOfMsg = 2 by default", function() {
        var broker2 = new BrokerObj.Broker(); 
        expect(broker2.countOfMsg).toBe(10);
        expect(broker2.portionOfMsg).toBe(2);
    }); 
    
    it("portionOfMsg becomes even number (decreased by 1). Broker(37, 13): countOfMsg=37, portionOfMsg=12, reminder=1", function() {
        var broker3 = new BrokerObj.Broker(37, 13); 
        expect(broker3.countOfMsg).toBe(37);
        expect(broker3.portionOfMsg).toBe(12);
        expect(broker3.reminder).toBe(1);
    }); 
    
    it("should have integer countOfMsg and portionOfMsg ", function() {
        //var broker2 = new BrokerObj.Broker(99.5, 4.2);
        expect(parseInt(broker.portionOfMsg)).toBe(broker.portionOfMsg);
        expect(parseInt(broker.countOfMsg)).toBe(broker.countOfMsg);
    });
    
    //deprecated
    xit("should have arrOfMsg[] of 'countOfMsg' elements", function() {
        var arr = [];
        expect(broker.arrOfMsg).toEqual(jasmine.any(Object));
    });
    
    
        //deprecated
        xit("checkTypeOfMsg() may be called with string args 'stop' or 'start'", function() {
            spyOn(broker, 'checkTypeOfMsg');
            broker.checkTypeOfMsg();
            expect(broker.checkTypeOfMsg).toHaveBeenCalledWith(jasmine.any(String));
        });

        it("checkTypeOfMsg() may be called with 'start', 'stop' or () for both. Else -> catch an ERROR", function() {
            spyOn(broker, 'catchTheError');
            //If parameter is 'stop' or 'start' test will get a failure. 
            //If else test will be passed because catchTheError() will be calles
            broker.checkTypeOfMsg('sdf');
            expect(broker.catchTheError).toHaveBeenCalled();
        });

        it("makeMsg() may be called with string args 'stop' or 'start'.  Else -> catch an ERROR", function() {
            spyOn(broker, 'catchTheError');
            //If parameter is 'stop' or 'start' test will get a failure. 
            //If else test will be passed because catchTheError() will be calles
            broker.makeMsg(13);
            expect(broker.catchTheError).toHaveBeenCalled();
        });
    
        it("makeMsg() should return an Array like ['<string>', {<object>}]", function() {
            spyOn(broker, 'makeMsg').andCallThrough();
            var f = broker.makeMsg('start');
            expect(f).toEqual(jasmine.any(Object));
            expect(f[1]).toEqual(jasmine.any(Object));
            expect(f[0]).toEqual(jasmine.any(String));
        });

        it("makeMsg() should return correct Array", function() {
            spyOn(broker, 'makeMsg').andCallThrough();
            var msg = broker.makeMsg('start');
            var obj = msg[1].playload;
            var obj2 = {call_id:  'callId', timestamp: {}};
           
            expect(msg[0]).toBe('call.start');
            for (var prop in obj2) {
                expect(obj.hasOwnProperty(prop)).toBe(true);
            }
        });
    
        
    

});

    
    /*it('shows asynchronous test', function() {
        setTimeout(function() {
            expect('second').toEqual('second');
            asyncSpecDone();
        }, 1); 
        expect('first').toEqual('first');
        asyncSpecWait();
    });

    it('shows asynchronous test node-style', function(done) {
        setTimeout(function() {
            expect('second').toEqual('second');
            // If you call done() with an argument, it will fail the spec
            // so you can use it as a handler for many async node calls
            done();
        }, 1);
        expect('first').toEqual('first');
    });*/