var CouchDb = (function () {
 
    // Instance stores a reference to the Singleton CouchDb
    var instanceOfCouchDb;
    
    function initializeInstance() {
        // Singleton
        // Private methods and variables
        var nano   = require('nano')('http://10-60-8-119-couchdb.kwebbl.dev:5984');
        var db     = nano.use('a_studenyak');
        var ResultArray = [];
        return {

            // Public methods and variables
            insertingResultArray: ResultArray,
                
            //---example
            publicMethodShowThis: function() {
                console.log( "I am publicMethod" );
                console.log( this );
            },
            
            
            insert: function (doc) {
                //console.log (this.getDbRef());
                db.insert(doc, {}, function(err, result) {
                    if (!err) {
                        //console.log (result);
                        insertingResultArray.push(result);
                        return result;    
                    }
                    else {
                        return err;
                    }
                });
            },
            
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
