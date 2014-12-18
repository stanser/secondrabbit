var REngError = require('./error.js');
var CouchDb = (function () {
 
    // Instance stores a reference to the Singleton CouchDb
    var instanceOfCouchDb;
    
    function initializeInstance() {
        // Singleton
        // Private methods and variables
        var nano = require('nano')('http://couchdb-ha.kwebbl.dev:5984');
        var db = nano.use('test_a_studenyak');
        
        /** @methd _onSelect
        * @privat
        * @param {function} onSelectFinished - callback
        *
        * @returns {function} callback for select
        */
        function onSelect(onSelectFinished) {
            /** @callback instanceOdCouchDb~_onSelect
            * @param {object} error - if select failed
            * @param {object} body - contains select result
            * Prepaires parameters for external callback invocation and call last one  
            */
            return function(error, body) {
                var result = {};
                if (error) {
                    onSelectFinished(new REngError(null, error), null);
                    return;
                }
                if (body.rows.length === 1) {
                    result = body.rows[0].doc;
                    console.log("found startDoc call_id: " + result.call_id);
                    onSelectFinished(null, result); 
                    return;
                }

                if (body.rows.length === 0) {
                    result.call_id = undefined;
                    optionsError = {code: 'ICID', 
                                    invalid: 'call_id', 
                                    description: 'call_id not found in database', 
                                    location: 'CouchDb.selectStartDoc'};
                    onSelectFinished(new REngError(optionsError), null);
                } else {
                    result = body.rows[0].doc;
                    optionsError = {code: 'ICID', 
                                    invalid: 'call_id', 
                                    description: 'found multiple call_id ' + result.call_id, 
                                    location: 'CouchDb.selectStartDoc',
                                    notice: 'used one record only _id: ' + result._id};
                    //console.log("found startDoc call_id: " + result.call_id);
                    var error = new REngError(optionsError);
                    error.log();
                    onSelectFinished(null, result); 
                }
                
            }
        };
        
        return {
            /** @method insert
            * Inserts into CouchDB. Calls callback when finished
            * @param {object} doc - an object is needed to be inserted
            * @param {function} callback - function name
            *
            * @return {REngError} - error if is used without callback           
            */
            insert: function (doc, onInsertFinished) {
                if (!onInsertFinished || typeof(onInsertFinished) !== 'function') 
                    var optionsError = {code: 'CMISS', 
                                        invalid: 'callback', 
                                        description: 'callback missing or not a function', 
                                        location: 'CouchDb.insert'};
                    return new REngError(optionsError);
                db.insert(doc, {}, function(error, result) {
                    if (!error) {
                        onInsertFinished (null, result);
                    }
                    else {
                        onInsertFinished (new REngError(null, error), null);
                    }
                });
            },
            
           /** @method selectStartDoc 
            * Selects start doc by the call_id
            * @param {string} searchingKey - key for searching doc
            *    searchingKey ~ stopMsg.call_id
            * @param {function} onSelectFinished - function name to process result
            *
            * Uses the first doc only even if another exist //TODO
            * 
            * @return {REngError} - error if is used without callback  
            */
            selectStartDoc: function (searchingKey, onSelectFinished) { 
                var design = "calls";
                var view = "selectCallId";
                var startMsg = {};
                var errOptions;
                
                if (!onSelectFinished || typeof(onSelectFinished) !== 'function') {
                    errOptions = {code: 'CMISS', 
                                  invalid: 'callback', 
                                  description: 'callback is missing or not a function', 
                                  source: 'CouchDb.selectStartDoc'}
                    return new REngError(errOptions);
                }
                // body includes general info + rows with result
                var options = {key: searchingKey, include_docs: true};
                var onSelectCb = onSelect(onSelectFinished);
                db.view(design, view, options, onSelectCb);
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
