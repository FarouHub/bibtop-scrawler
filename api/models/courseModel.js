'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var priceSchema = new Schema({
  prix: Number,
  date: Date,
  type: String
});

var epreuveSchema = new Schema({
  name: String,
  description: String,
  distance: Number,
  maxinscription : Number,
  prices: [priceSchema]
});

var CourseSchema = new Schema({
  
  title: {
    type: String
  },
  start_date: {
    type: Date
  },
  end_date: {
    type: Date
  },
  region: {
    type: String
  },
  commune: {
    type: String
  },
  commune_req: {
    type: String
  },
  contact: {
    type: String
  },
  phone: {
    type: String
  },
  mail: {
    type: String
  },
  url_club: {
    type: String
  },
  urlid: {
    type: String
  },
  random: {
	  type: String  
  },
  lat: {
    type: Number  
  },
  long: {
    type: Number  
  },
  depart: {
    type: String
  },
  service:{
    type: String
  },
  recompences: {
    type: String
  },
  animation: {
    type: String
  },
  epreuves: [epreuveSchema]
  /*
  type: {
    type: [{
      type: String,
      enum: ['Trail', 'Cross', 'Course']
    }],
    default: ['Course']
  }*/
});

module.exports = mongoose.model('course', CourseSchema);
