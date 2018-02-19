'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PriceSchema = new Schema({
    prix: Number,
    date: Date,
    type: String
});

var EpreuveSchema = new Schema({
    name: String,
    description: String,
    distance: Number,
    maxinscription : Number,
    title: String,
    start_date: Date,
    end_date: Date,
    region: String,
    commune: String,
    commune_req: String,
    contact: String,
    phone: String,
    mail: String,
    url_club: String,
    urlid: String,
    random: String,
    lat: Number,
    long: Number,
    depart: String,
    service:String,
    recompences: String,
    animation: String,
    epreuves: [{ type: Schema.Types.ObjectId, ref: 'epreuve' }],
    prices: [PriceSchema]
});
  
module.exports = mongoose.model('epreuve', EpreuveSchema);