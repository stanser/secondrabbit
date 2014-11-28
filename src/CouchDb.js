var CouchDb = (function () {
 
    // Instance stores a reference to the Singleton CouchDb
    var instanceOfCouchDb;
    
    function initializeInstance() {
        // Singleton
        // Private methods and variables
        var nano   = require('nano')('http://10-60-8-119-couchdb.kwebbl.dev:5984');
        var db     = nano.use('a_studenyak');
        return {

            // Public methods and variables
                
            //---example
            publicMethodShowThis: function() {
                console.log( "I am publicMethod" );
                console.log( this );
            },
            
           /* Inserts into CouchDB
            * Calls callback when finished
            * @param doc - an object is needed to be inserted
            * @param callback - function name
            *
            * Returns <object> Error if is used without callback           
            */
            insert: function (doc, callback) {
                var processResult = callback || null; 
                try {
                    if (!processResult) throw new Error ("No callback for insert", "CouchDb.insert", 29);
                    db.insert(doc, {}, function(err, result) {
                        if (!err) {
                            processResult (true, result);
                        }
                        else {
                            processResult (false, err);
                        }
                    });
                }
                catch (e) {
                    return e;
                }
            },
            
           /* Selects start doc by the call_id
            * @param stopMsg - an object received from RabbitMQ
            * @param callback - function name
            * 
            * Returns <object> Error if is used without callback 
            */
            selectStartDoc: function (stopMsg, callback) {
                var processResult = callback || null;
                var design = "calls";
                var view = "selectCallId";
                var startMsg;
                try {
                    //if callback isn't defined return error
                    if (!processResult) throw new Error ("No callback for select", "CouchDb.select", 62);

                    console.log('call_id from stop message: ' + stopMsg.call_id);

                    // body includes general info + rows with result
                    db.view(design, view, {key: stopMsg.call_id, include_docs: true}, function(err, body) {
                        if (!err) { 
                            if (body.rows.length > 0) { 
                              /*
                               * use the first doc only even if another exists
                               */
                                startMsg = body.rows[0].doc;
                                console.log("call_id from DB startDoc: " + startMsg.call_id);
                                processResult (true, startMsg, stopMsg); //startMsg has found
                                }
                            else {
                                //No rows selected
                                startMsg = {call_id: 'not found'};
                                processResult (false, startMsg, stopMsg); //no startMsg for existing stopMsg 
                            }
                        }
                        else {
                            //Error during selecting
                            processResult (false, err, stopMsg); //error during selecting
                        }
                    });
                }
                catch (e) {
                    return e;
                }        
            },
            
            //reference for db object
            getDbRef: function () {
                return db;
            }
        }
    }
    return {
        // Get the Singleton CouchDb instance if one exists
        // or create one if it doesn't
        getInstanceOfCouchDb: function () {
            if ( !instanceOfCouchDb ) {
                instanceOfCouchDb = initializeInstance();
            }
            return instanceOfCouchDb;
        }
    };

})();

exports.CouchDb = CouchDb;
