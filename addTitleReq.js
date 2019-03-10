var config = require("./config");

var mongoose = require('mongoose');
var epreuveModel = require('./api/models/epreuveModel');
var Epreuve = mongoose.model('epreuve');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect(config.mongodb);

let query = {};
query.urlid = {$regex: 'alsace-en-courant'};
Epreuve.deleteMany(query, function(){ console.log('requete ok') });
/*
Epreuve.find({}, function(err, findResult) {
    if (err){
        logger.error('Unable to find the race' + err);
    }else{
        for(let tmpEpreuve of findResult){

            Epreuve.findById(tmpEpreuve._id, function(e, i){
                i.set( {'title_req': getFormatName(tmpEpreuve.title)});
                i.save(function(err, doc){
                    if(err){
                        console.log(err);
                    }
                });
            });
            
        }
    }
});
*/
function getFormatName(input) {
    let result = input.normalize('NFD').replace(/[\u0300-\u036f]/gm, "");
    result = result.replace(/\W/gm, "");
    return result.toUpperCase();
}
